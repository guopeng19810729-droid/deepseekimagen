// 配置加载：默认值 → 配置文件 → 环境变量（后者覆盖前者）
// api_key 读取优先级：APIMART_API_KEY 环境变量 > config.json 的 api_key
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { readJsonSafe } from './util.mjs';

/** 技能包根目录（本文件在 <root>/src/config.mjs） */
export function skillRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export const DEFAULTS = {
  api_key: '',
  base_url: 'https://api.apib.ai/v1',
  proxy: '',
  output_dir: './out',
  ledger_dir: '',
  default_model: 'gpt-image-2.5-ext',
  midjourney_model: 'midjourney',
  default_ratio: '1:1',
  max_cost_usd_per_request: 0.3,
  poll_interval_ms: 3000,
  poll_timeout_ms: 300000,
};

/** 候选配置文件，按顺序找，先找到的胜出 */
export function configCandidates(explicitPath) {
  const list = [];
  if (explicitPath) list.push(resolve(explicitPath));
  list.push(resolve(process.cwd(), 'config.json'));
  list.push(join(skillRoot(), 'config.json'));
  list.push(join(homedir(), '.config', 'deepseekimagen', 'config.json'));
  return list;
}

export function loadConfig({ configPath } = {}) {
  const candidates = configCandidates(configPath);
  let fileCfg = null;
  let usedPath = null;
  for (const p of candidates) {
    if (existsSync(p)) {
      const j = readJsonSafe(p);
      if (j) {
        fileCfg = j;
        usedPath = p;
        break;
      }
    }
  }

  const cfg = { ...DEFAULTS, ...(fileCfg || {}) };
  const notes = [];

  // 环境变量覆盖
  if (process.env.APIMART_API_KEY) {
    cfg.api_key = process.env.APIMART_API_KEY;
    notes.push('api_key 来自环境变量 APIMART_API_KEY');
  }
  if (process.env.APIMART_BASE_URL) cfg.base_url = process.env.APIMART_BASE_URL;
  if (process.env.APIMART_PROXY) cfg.proxy = process.env.APIMART_PROXY;
  if (process.env.DEEPSEEKIMAGEN_OUTPUT) cfg.output_dir = process.env.DEEPSEEKIMAGEN_OUTPUT;
  if (process.env.DEEPSEEKIMAGEN_LEDGER) cfg.ledger_dir = process.env.DEEPSEEKIMAGEN_LEDGER;

  // 路径补全：相对路径按“配置文件所在目录”解析，没有配置文件则按技能包根目录
  const base = usedPath ? dirname(usedPath) : skillRoot();
  cfg.output_dir = isAbsolute(cfg.output_dir) ? cfg.output_dir : resolve(base, cfg.output_dir);
  if (!cfg.ledger_dir) cfg.ledger_dir = join(skillRoot(), 'data');
  else cfg.ledger_dir = isAbsolute(cfg.ledger_dir) ? cfg.ledger_dir : resolve(base, cfg.ledger_dir);

  cfg._configPath = usedPath;
  cfg._candidates = candidates;
  cfg._notes = notes;

  // 代理：Node >= 24 用 NODE_USE_ENV_PROXY 生效；必须在首次 fetch 之前设置
  if (cfg.proxy) {
    process.env.HTTP_PROXY = cfg.proxy;
    process.env.HTTPS_PROXY = cfg.proxy;
    process.env.NODE_USE_ENV_PROXY = '1';
    notes.push(`走代理 ${cfg.proxy}（需 Node >= 24）`);
  }

  return cfg;
}

/** 失败时给出可操作的指引，而不是让用户对着 401 猜 */
export function requireApiKey(cfg) {
  if (cfg.api_key && String(cfg.api_key).trim()) return cfg.api_key;
  const lines = [
    '没有找到 API Key。请任选一种方式配置：',
    '',
    '  方式 A（推荐）在配置文件中填写：',
    `    1) 复制 ${join(skillRoot(), 'config.example.json')} 为 ${join(skillRoot(), 'config.json')}`,
    '    2) 把 "api_key" 填上你的 apib.ai / APIMart 密钥（sk- 开头）',
    '',
    '  方式 B 用环境变量：',
    '    PowerShell:  $env:APIMART_API_KEY="sk-..."',
    '    bash:        export APIMART_API_KEY="sk-..."',
    '',
    '  已查找过的位置：',
    ...cfg._candidates.map((p) => `    - ${p}`),
  ];
  const err = new Error(lines.join('\n'));
  err.friendly = true;
  throw err;
}

/** setup 用：把缺省的 config.json 从模板生成出来 */
export function scaffoldConfig() {
  const target = join(skillRoot(), 'config.json');
  if (existsSync(target)) return { created: false, path: target };
  const tpl = readFileSync(join(skillRoot(), 'config.example.json'), 'utf8');
  writeFileSync(target, tpl, 'utf8');
  return { created: true, path: target };
}
