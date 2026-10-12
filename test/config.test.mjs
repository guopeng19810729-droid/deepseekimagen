// 配置加载测试：文件 → 环境变量覆盖、相对路径解析、代理开关、缺 key 的友好报错
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { DEFAULTS, loadConfig, requireApiKey, skillRoot } from '../src/config.mjs';

const ENV_KEYS = ['APIMART_API_KEY', 'APIMART_BASE_URL', 'APIMART_PROXY', 'DEEPSEEKIMAGEN_OUTPUT', 'DEEPSEEKIMAGEN_LEDGER', 'NODE_USE_ENV_PROXY', 'HTTPS_PROXY', 'HTTP_PROXY'];

function withEnv(patch, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, patch);
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

function tmpConfig(obj) {
  const dir = mkdtempSync(join(tmpdir(), 'dimg-cfg-'));
  const p = join(dir, 'config.json');
  writeFileSync(p, JSON.stringify(obj), 'utf8');
  return { dir, path: p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('显式指定的配置文件被读取，未给的字段回落默认值', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: 'sk-from-file', default_ratio: '16:9' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.api_key, 'sk-from-file');
    assert.equal(cfg.default_ratio, '16:9');
    assert.equal(cfg.base_url, DEFAULTS.base_url);
    assert.equal(cfg._configPath, t.path);
  } finally { t.cleanup(); }
}));

test('环境变量优先于配置文件', () => withEnv({ APIMART_API_KEY: 'sk-from-env' }, () => {
  const t = tmpConfig({ api_key: 'sk-from-file' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.api_key, 'sk-from-env');
    assert.ok(cfg._notes.some((n) => n.includes('APIMART_API_KEY')));
  } finally { t.cleanup(); }
}));

test('相对 output_dir 按配置文件所在目录解析', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: 'sk-x', output_dir: './out' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.output_dir, join(t.dir, 'out'));
  } finally { t.cleanup(); }
}));

test('绝对 output_dir 保持原样（按当前平台的绝对路径语义）', () => withEnv({}, () => {
  // 注意：Windows 的 'F:\x' 在 POSIX 上不是绝对路径（path.posix.isAbsolute 为 false），
  // 所以这里按平台取一个真正的绝对路径。写死 Windows 路径会让这个测试在 Linux CI 上失败
  // —— 这正是 CI 第一次跑起来时抓到的问题。
  const abs = process.platform === 'win32' ? 'F:\\deepseekimagen' : '/var/tmp/deepseekimagen';
  assert.ok(isAbsolute(abs), '测试自身的前提：这必须是当前平台上的绝对路径');
  const t = tmpConfig({ api_key: 'sk-x', output_dir: abs });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.output_dir, abs, '绝对路径不应被重新解析');
    assert.ok(isAbsolute(cfg.output_dir));
  } finally { t.cleanup(); }
}));

test('ledger_dir 留空时落在技能包内的 data/', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: 'sk-x', ledger_dir: '' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.ledger_dir, join(skillRoot(), 'data'));
  } finally { t.cleanup(); }
}));

test('配置了 proxy 会开启 NODE_USE_ENV_PROXY 并设置 HTTPS_PROXY', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: 'sk-x', proxy: 'http://127.0.0.1:7890' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.proxy, 'http://127.0.0.1:7890');
    assert.equal(process.env.NODE_USE_ENV_PROXY, '1');
    assert.equal(process.env.HTTPS_PROXY, 'http://127.0.0.1:7890');
    assert.equal(process.env.HTTP_PROXY, 'http://127.0.0.1:7890');
  } finally { t.cleanup(); }
}));

test('重试相关的默认值存在且合理', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: 'sk-x' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.equal(cfg.retries, 3);
    assert.ok(cfg.retry_base_ms > 0);
    assert.ok(cfg.retry_max_ms >= cfg.retry_base_ms);
  } finally { t.cleanup(); }
}));

test('缺 key 时给出可操作指引，且不泄露任何密钥', () => withEnv({}, () => {
  const t = tmpConfig({ api_key: '' });
  try {
    const cfg = loadConfig({ configPath: t.path });
    assert.throws(
      () => requireApiKey(cfg),
      (err) => {
        assert.ok(err.friendly, '应标记为友好错误');
        assert.match(err.message, /没有找到 API Key/);
        assert.match(err.message, /config\.example\.json/);
        assert.match(err.message, /APIMART_API_KEY/);
        assert.match(err.message, /已查找过的位置/);
        return true;
      },
    );
  } finally { t.cleanup(); }
}));

test('skillRoot 指向仓库根目录（含 SKILL.md）', () => {
  assert.ok(existsSync(join(skillRoot(), 'SKILL.md')), 'skillRoot 应包含 SKILL.md');
});
