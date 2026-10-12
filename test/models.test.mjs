// 模型注册表测试：别名解析、比例归一与报错、费用估算
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MODEL, MODELS, estimateUsd, isLocalAlternative, listModels, normalizeRatio, resolveModel,
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
