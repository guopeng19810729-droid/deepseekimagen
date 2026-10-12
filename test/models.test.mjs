// 模型注册表测试：别名解析、比例归一与报错、费用估算
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MODEL, MODELS, compareRegistry, estimateUsd, isLocalAlternative, listModels, normalizeRatio, resolveModel,
} from '../src/models.mjs';

test('默认模型是 gpt-image-2.5-ext（全网最便宜且 5 考点满分）', () => {
  assert.equal(DEFAULT_MODEL, 'gpt-image-2.5-ext');
});

test('resolveModel：正式 id、别名、大小写都认', () => {
  assert.equal(resolveModel('gpt-image-2.5-ext'), 'gpt-image-2.5-ext');
  assert.equal(resolveModel('GPT-Image-2.5-EXT'), 'gpt-image-2.5-ext');
  assert.equal(resolveModel('默认'), DEFAULT_MODEL);
  assert.equal(resolveModel('mj'), 'midjourney');
  assert.equal(resolveModel('midjourney'), 'midjourney');
  assert.equal(resolveModel(''), null);
  assert.equal(resolveModel('no-such-model'), null);
});

test('normalizeRatio：比例、中文说法、全角冒号都能归一', () => {
  assert.equal(normalizeRatio('1:1', 'gpt-image-2.5-ext'), '1:1');
  assert.equal(normalizeRatio('方图', 'gpt-image-2.5-ext'), '1:1');
  assert.equal(normalizeRatio('横图', 'gpt-image-2.5-ext'), '16:9');
  assert.equal(normalizeRatio('竖版', 'gpt-image-2.5-ext'), '9:16');
  assert.equal(normalizeRatio('9：16', 'gpt-image-2.5-ext'), '9:16');
});

test('normalizeRatio：空值取默认 1:1（若支持）', () => {
  assert.equal(normalizeRatio('', 'gpt-image-2.5-ext'), '1:1');
});

test('normalizeRatio：不支持的尺寸抛错并列出可用值', () => {
  assert.throws(() => normalizeRatio('1024x1024', 'gpt-image-2.5-ext'), /不支持尺寸/);
  assert.throws(() => normalizeRatio('7:3', 'gpt-image-2.5-ext'), /支持：/);
});

test('normalizeRatio：不接受 size 的模型返回 null（grok 系）', () => {
  assert.equal(normalizeRatio('1:1', 'grok-imagine-image'), null);
  assert.equal(MODELS['grok-imagine-image'].ratios, null);
});

test('estimateUsd：按张计费乘张数；MJ 按次；token 计费返回 null', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `期望 ${b}，实际 ${a}`);
  close(estimateUsd('gpt-image-2.5-ext', 1), 0.0085);
  close(estimateUsd('gpt-image-2.5-ext', 3), 0.0255);
  close(estimateUsd('midjourney', 4), 0.04504);   // MJ 按次数，不乘张数
  assert.equal(estimateUsd('gpt-image-2-official', 1), null, 'token 计费不可预估');
  assert.equal(estimateUsd('no-such-model', 1), null);
});

test('isLocalAlternative：本地可跑的模型被标记', () => {
  assert.equal(isLocalAlternative('z-image-turbo'), true);
  assert.equal(isLocalAlternative('flux-2-max'), true);
  assert.equal(isLocalAlternative('gpt-image-2.5-ext'), false);
  assert.equal(isLocalAlternative('midjourney'), false);
});

test('listModels 按价格升序，且可过滤掉本地可跑的', () => {
  const all = listModels();
  const prices = all.filter((m) => m.usd != null).map((m) => m.usd);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), '应按价格升序');
  const noLocal = listModels({ includeLocal: false });
  assert.ok(noLocal.length < all.length);
  assert.ok(noLocal.every((m) => !m.localAlt));
});

test('每个模型都带有 endpoint 与说明，避免清单残缺', () => {
  for (const [id, m] of Object.entries(MODELS)) {
    assert.ok(m.endpoint === 'images' || m.endpoint === 'midjourney', `${id} endpoint 非法`);
    assert.ok(typeof m.note === 'string' && m.note.length > 0, `${id} 缺少说明`);
    assert.ok(m.usd == null || Number.isFinite(m.usd), `${id} 价格必须是数字或 null`);
  }
});

// 这条不变量很重要：绝不允许出现「usd 为空但没有 pricing 标注」的条目。
// 否则 estimateUsd 会静默返回 null，费用上限保护对该模型等于没有 —— 用户会在不知情下超额消费。
test('价格字段自洽：usd 为 null 时必须显式标注 pricing', () => {
  for (const [id, m] of Object.entries(MODELS)) {
    if (m.usd == null) {
      assert.ok(
        m.pricing === 'token' || m.pricing === 'unknown',
        `${id} 的 usd 为空却没有标注 pricing（会让费用闸门静默失效）`,
      );
    } else {
      assert.ok(m.usd > 0, `${id} 的价格必须为正数`);
      assert.equal(m.pricing, undefined, `${id} 有真实价格就不该再标 pricing`);
    }
  }
});

test('estimateUsd：不可预估的模型一律返回 null（调用方必须据此告警）', () => {
  for (const [id, m] of Object.entries(MODELS)) {
    if (m.pricing === 'token' || m.pricing === 'unknown' || m.usd == null) {
      assert.equal(estimateUsd(id, 1), null, `${id} 不可预估时必须返回 null`);
    } else {
      assert.ok(estimateUsd(id, 1) > 0, `${id} 有价格就该算出正数`);
    }
  }
});

// ── compareRegistry：清单新鲜度检查（--models --live 的核心逻辑）──────────
// 这个函数必须保证：只有「清单里有、平台没有」才算需要人工处理的漂移。
// 反方向（平台多出来的模型）绝大多数是 LLM/视频/音频等非生图模型，不该报警。

test('compareRegistry：完全一致时不报漂移', () => {
  const ids = Object.keys(MODELS);
  const r = compareRegistry(ids);
  assert.deepEqual(r.missingOnPlatform, []);
  assert.deepEqual(r.notInRegistry, []);
  assert.equal(r.platformCount, ids.length);
  assert.equal(r.localCount, ids.length);
});

test('compareRegistry：清单里有、平台没有 → missingOnPlatform（唯一可行动的漂移信号）', () => {
  const ids = Object.keys(MODELS).filter((id) => id !== 'midjourney');
  const r = compareRegistry(ids);
  assert.deepEqual(r.missingOnPlatform, ['midjourney']);
});

test('compareRegistry：平台多出来的模型只进 notInRegistry，不算漂移', () => {
  const ids = [...Object.keys(MODELS), 'deepseek-v4', 'some-llm'];
  const r = compareRegistry(ids);
  assert.deepEqual(r.missingOnPlatform, [], '平台多出模型不应被当作漂移');
  assert.deepEqual([...r.notInRegistry].sort(), ['deepseek-v4', 'some-llm']);
});

test('compareRegistry：忽略 null / undefined / 空串，并自动去重', () => {
  const ids = [...Object.keys(MODELS), null, undefined, '', 'midjourney', 'midjourney'];
  const r = compareRegistry(ids);
  assert.deepEqual(r.missingOnPlatform, []);
  assert.deepEqual(r.notInRegistry, []);
  assert.equal(r.platformCount, Object.keys(MODELS).length, '重复项与空值都不该被计入');
});

test('compareRegistry：空清单会把全部本地模型标为缺失（调用方必须先判空）', () => {
  const r = compareRegistry([]);
  assert.equal(r.missingOnPlatform.length, Object.keys(MODELS).length);
  assert.equal(r.platformCount, 0);
});

test('compareRegistry：可传入自定义 registry，便于隔离测试', () => {
  const registry = { a: { endpoint: 'images', usd: 1, note: 'x' }, b: { endpoint: 'images', usd: 2, note: 'y' } };
  const r = compareRegistry(['a', 'z'], { registry });
  assert.deepEqual(r.missingOnPlatform, ['b']);
  assert.deepEqual(r.notInRegistry, ['z']);
  assert.equal(r.localCount, 2);
});
