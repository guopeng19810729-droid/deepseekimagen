// 参数别名归一测试 —— 包括「--size 传像素」这个本项目最常见的坑必须给出明确报错
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArgAliases, parseCliArgs } from '../src/args.mjs';

test('--ratio 原样保留', () => {
  assert.equal(parseCliArgs(['--ratio', '9:16']).ratio, '9:16');
});

test('--ar / --aspect / --aspect-ratio / --aspect_ratio 都归一为 ratio', () => {
  for (const flag of ['--ar', '--aspect', '--aspect-ratio', '--aspect_ratio']) {
    assert.equal(parseCliArgs([flag, '16:9']).ratio, '16:9', `${flag} 应归一为 ratio`);
  }
});

test('显式 --ratio 优先于别名', () => {
  const a = parseCliArgs(['--ar', '16:9', '--ratio', '1:1']);
  assert.equal(a.ratio, '1:1');
});

test('--size 传比例可用', () => {
  assert.equal(parseCliArgs(['--size', '9:16']).ratio, '9:16');
});

test('--size 传像素值：明确报错并给出正确用法', () => {
  for (const bad of ['1024x1024', '1024X768', '512×512', '832*1472']) {
    assert.throws(
      () => parseCliArgs(['--size', bad]),
      (err) => {
        assert.match(err.message, /只接受\*\*比例\*\*|只接受\*\*比例\*\*/);
        assert.match(err.message, /1:1/);
        return true;
      },
      `--size ${bad} 应被拒绝`,
    );
  }
});

test('--no-retry 把 retries 置 0', () => {
  assert.equal(parseCliArgs(['--no-retry']).retries, 0);
  assert.equal(parseCliArgs(['--json']).retries, undefined);
});

test('normalizeArgAliases 返回同一个对象（便于链式使用）', () => {
  const a = { ar: '4:3' };
  assert.equal(normalizeArgAliases(a), a);
});
