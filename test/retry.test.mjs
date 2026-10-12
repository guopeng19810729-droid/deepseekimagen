// 重试策略测试 —— 这是本项目最需要守住的行为：
// 写操作（POST）重试不当会造成重复扣费，所以「哪些错误能重试」必须有测试钉住。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Apimart } from '../src/apimart.mjs';

const client = (opts = {}) => new Apimart({
  apiKey: 'sk-test', baseUrl: 'https://example.invalid/v1',
  retries: 3, retryBaseMs: 1, retryMaxMs: 2, ...opts,
});

const jsonRes = (obj, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  text: async () => JSON.stringify(obj),
});

const netErr = (code) => { const e = new Error('network ' + code); e.code = code; return e; };

/** 用桩替换 globalThis.fetch，跑完自动还原 */
async function withFetch(stub, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

test('GET：网络错误会重试，最终成功', async () => {
  const calls = [];
  await withFetch(async () => {
    calls.push(1);
    if (calls.length < 3) throw netErr('ECONNRESET');
    return jsonRes({ data: [] });
  }, async () => {
    const r = await client().listModels();
    assert.deepEqual(r, { data: [] });
    assert.equal(calls.length, 3, '应在第 3 次成功');
  });
});

test('GET：5xx 会重试', async () => {
  const calls = [];
  await withFetch(async () => {
    calls.push(1);
    if (calls.length < 2) return jsonRes({ error: { message: 'server boom' } }, 503);
    return jsonRes({ ok: 1 });
  }, async () => {
    const r = await client().listModels();
    assert.deepEqual(r, { ok: 1 });
    assert.equal(calls.length, 2);
  });
});

test('GET：4xx 不重试，直接抛错', async () => {
  const calls = [];
  await withFetch(async () => { calls.push(1); return jsonRes({ error: { message: 'bad request' } }, 400); }, async () => {
    await assert.rejects(() => client().listModels(), /HTTP 400/);
    assert.equal(calls.length, 1, '4xx 不应重试');
  });
});

test('POST：连接被拒（确定没送达）会重试', async () => {
  const calls = [];
  await withFetch(async () => {
    calls.push(1);
    if (calls.length < 2) throw netErr('ECONNREFUSED');
    return jsonRes({ data: [{ task_id: 'task_x' }] });
  }, async () => {
    const r = await client().submitImage({ model: 'm', prompt: 'p' });
    assert.equal(r.taskId, 'task_x');
    assert.equal(calls.length, 2);
  });
});

test('POST：请求超时/连接重置（可能已被处理）**不重试** —— 防重复扣费', async () => {
  for (const code of ['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ECONNRESET']) {
    const calls = [];
    await withFetch(async () => { calls.push(1); throw netErr(code); }, async () => {
      await assert.rejects(() => client().submitImage({ model: 'm', prompt: 'p' }));
      assert.equal(calls.length, 1, `${code} 不应重试（否则可能重复扣费）`);
    });
  }
});

test('POST：5xx 不重试（结果不明）', async () => {
  const calls = [];
  await withFetch(async () => { calls.push(1); return jsonRes({ error: { message: 'x' } }, 502); }, async () => {
    await assert.rejects(() => client().submitImage({ model: 'm', prompt: 'p' }), /HTTP 502/);
    assert.equal(calls.length, 1);
  });
});

test('POST：429 会重试（服务端明确未处理）', async () => {
  const calls = [];
  await withFetch(async () => {
    calls.push(1);
    if (calls.length < 2) return jsonRes({ error: { message: 'rate limited' } }, 429);
    return jsonRes({ data: [{ task_id: 'task_y' }] });
  }, async () => {
    const r = await client().submitImage({ model: 'm', prompt: 'p' });
    assert.equal(r.taskId, 'task_y');
    assert.equal(calls.length, 2);
  });
});

test('retries=0 时不重试', async () => {
  const calls = [];
  await withFetch(async () => { calls.push(1); throw netErr('ECONNREFUSED'); }, async () => {
    await assert.rejects(() => client({ retries: 0 }).listModels());
    assert.equal(calls.length, 1);
  });
});

test('onRetry 回调会被调用，并带上次数与延迟', async () => {
  const seen = [];
  await withFetch(async () => { throw netErr('ECONNREFUSED'); }, async () => {
    await assert.rejects(() => client({ retries: 2, onRetry: (info) => seen.push(info) }).listModels());
  });
  assert.equal(seen.length, 2, '重试 2 次应回调 2 次');
  assert.deepEqual(seen.map((s) => s.attempt), [1, 2]);
  assert.ok(seen.every((s) => Number.isFinite(s.delay) && s.delay >= 0));
});

test('提交时带上 Idempotency-Key 头', async () => {
  let seenHeaders = null;
  await withFetch(async (_url, init) => {
    seenHeaders = init.headers;
    return jsonRes({ data: [{ task_id: 'task_z' }] });
  }, async () => {
    await client().submitImage({ model: 'm', prompt: 'p', idempotencyKey: 'idem-123' });
  });
  assert.equal(seenHeaders['Idempotency-Key'], 'idem-123');
});

test('extractUrls：能从嵌套结构里收集去重后的图片 URL', async () => {
  const { extractUrls } = await import('../src/apimart.mjs');
  const urls = extractUrls({
    result: { images: [{ url: ['https://a/1.png', 'https://a/2.jpg'] }, { url: ['https://a/1.png'] }] },
  });
  assert.deepEqual(urls, ['https://a/1.png', 'https://a/2.jpg']);
});
