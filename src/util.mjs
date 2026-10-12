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

/** buffer 的 SHA256（大写十六进制），用于「输出 vs 输入」等价性校验 */
export function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

/**
 * 从图片字节里读宽高（不依赖任何图像库）。
 * PNG 直接读 IHDR；JPEG 扫 SOF 段；WebP 支持 VP8X / VP8L / VP8。
 * 返回 { w, h }，读不出时为 { w: null, h: null }。
 */
export function imageSize(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const fmt = detectFormat(b);
  try {
    if (fmt === 'png') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (fmt === 'jpg') {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        // SOF0..SOF15（排除 DHT=0xC4 / JPG=0xC8 / DAC=0xCC）
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        }
        i += 2 + len;
      }
      return { w: null, h: null };
    }
    if (fmt === 'webp') {
      const fourcc = b.toString('ascii', 12, 16);
      if (fourcc === 'VP8X') {
        const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
        const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
        return { w, h };
      }
      if (fourcc === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (fourcc === 'VP8 ') {
        return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      }
      return { w: null, h: null };
    }
  } catch {
    return { w: null, h: null };
  }
  return { w: null, h: null };
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
