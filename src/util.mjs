// 通用工具：参数解析、日志、密钥掩码、图片格式判定、文件名 slug
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** 解析 --key value / --key=value / --flag 形式 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a === 'string' && a.startsWith('--')) {
      const raw = a.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) {
        out[raw.slice(0, eq)] = raw.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || (typeof next === 'string' && next.startsWith('--'))) {
        out[raw] = true;
      } else {
        out[raw] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** 只显示前缀，绝不打印完整 key */
export function maskKey(k) {
  if (!k) return '(空)';
  return `${k.slice(0, 8)}…(${k.length} 字符)`;
}

/** 按魔数判断真实图片格式 —— 平台的扩展名不可信，这个方法踩过两次坑 */
export function detectFormat(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.length >= 6 && b.toString('ascii', 0, 3) === 'GIF') return 'gif';
  return 'bin';
}

/** 生成安全的文件名片段：保留中文（便于在资源管理器里辨认），去掉 Windows 非法字符 */
export function slugify(text, max = 40) {
  const s = String(text || '')
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')      // Windows 非法字符
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff-]/g, '') // 只留字母数字、汉字、日文假名、连字符
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  const cut = s.slice(0, max).replace(/-+$/g, '');
  return cut || 'img';
}

/** 提示词短哈希，保证同名不覆盖、便于去重 */
export function shortHash(text, len = 8) {
  return createHash('sha1').update(String(text ?? '')).digest('hex').slice(0, len);
}

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

export function readJsonSafe(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function tsCompact(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

export function log(...a) {
  console.log(...a);
}
export function warn(...a) {
  console.warn(c.yellow('警告:'), ...a);
}
/** CLI 可预期的错误：抛出后由入口统一收尾，避免 process.exit 触发 libuv 断言 */
export class CliError extends Error {
  constructor(msg, code = 1) {
    super(msg);
    this.code = code;
  }
}

export function die(msg, code = 1) {
  throw new CliError(msg, code);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function fmtUsd(n) {
  return `$${Number(n).toFixed(4)}`;
}
