// 工具函数测试：参数解析、文件名、图片格式与尺寸（不依赖任何图像库）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, imageSize, maskKey, parseArgs, sha256Buf, slugify, tsCompact } from '../src/util.mjs';

// ── 构造最小合法图片字节（只满足魔数与尺寸字段）──────────────
function pngBytes(w, h) {
  const b = Buffer.alloc(26);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);              // IHDR 长度
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);              // 宽
  b.writeUInt32BE(h, 20);              // 高
  return b;
}
function jpegBytes(w, h) {
  const b = Buffer.alloc(11);
  b[0] = 0xff; b[1] = 0xd8;            // SOI
  b[2] = 0xff; b[3] = 0xc0;            // SOF0
  b.writeUInt16BE(17, 4);              // 段长
  b[6] = 8;                            // 精度
  b.writeUInt16BE(h, 7);               // 高
  b.writeUInt16BE(w, 9);               // 宽
  return b;
}
function webpVp8xBytes(w, h) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUInt32LE(10, 16);
  // 20..23 = flags
  const wm = w - 1, hm = h - 1;
  b[24] = wm & 0xff; b[25] = (wm >> 8) & 0xff; b[26] = (wm >> 16) & 0xff;
  b[27] = hm & 0xff; b[28] = (hm >> 8) & 0xff; b[29] = (hm >> 16) & 0xff;
  return b;
}

test('parseArgs 支持 --k v / --k=v / 裸开关', () => {
  const a = parseArgs(['--prompt', 'hello', '--ratio=9:16', '--json', '--dry-run']);
  assert.equal(a.prompt, 'hello');
  assert.equal(a.ratio, '9:16');
  assert.equal(a.json, true);
  assert.equal(a['dry-run'], true);
});

test('parseArgs：开关后面跟另一个开关时不会被吃成值', () => {
  const a = parseArgs(['--json', '--ratio', '1:1']);
  assert.equal(a.json, true);
  assert.equal(a.ratio, '1:1');
});

test('slugify：保留中文、去掉 Windows 非法字符、限长', () => {
  assert.equal(slugify('一只戴眼镜的橘猫'), '一只戴眼镜的橘猫');
  assert.equal(slugify('a red apple on a white table'), 'a-red-apple-on-a-white-table');
  assert.equal(slugify('海报：赛博朋克城市 / 夜景?? *'), '海报赛博朋克城市-夜景');
  assert.equal(slugify(''), 'img');
  assert.equal(slugify('!!!'), 'img');
  assert.ok(slugify('x'.repeat(200), 40).length <= 40);
});

test('detectFormat 按魔数判定四种格式', () => {
  assert.equal(detectFormat(pngBytes(4, 4)), 'png');
  assert.equal(detectFormat(jpegBytes(4, 4)), 'jpg');
  assert.equal(detectFormat(webpVp8xBytes(4, 4)), 'webp');
  assert.equal(detectFormat(Buffer.from('GIF89a')), 'gif');
  assert.equal(detectFormat(Buffer.from('not an image')), 'bin');
});

test('imageSize 正确读取 PNG / JPEG / WebP 的宽高', () => {
  assert.deepEqual(imageSize(pngBytes(816, 1456)), { w: 816, h: 1456 });
  assert.deepEqual(imageSize(jpegBytes(1024, 768)), { w: 1024, h: 768 });
  assert.deepEqual(imageSize(webpVp8xBytes(512, 512)), { w: 512, h: 512 });
});

test('imageSize 对垃圾数据返回 null 而不是抛错', () => {
  assert.deepEqual(imageSize(Buffer.from('xxxx')), { w: null, h: null });
  assert.deepEqual(imageSize(Buffer.alloc(0)), { w: null, h: null });
});

test('sha256Buf 稳定且为大写十六进制', () => {
  const h1 = sha256Buf(Buffer.from('abc'));
  const h2 = sha256Buf(Buffer.from('abc'));
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9A-F]{64}$/);
  assert.equal(h1, 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
});

test('maskKey 绝不泄露完整密钥', () => {
  const key = 'sk-1234567890abcdefghijklmnop';
  const masked = maskKey(key);
  assert.ok(!masked.includes(key));
  assert.ok(masked.startsWith('sk-12345'));
  assert.equal(maskKey(''), '(空)');
});

test('tsCompact 生成按时间排序的文件名片段', () => {
  const s = tsCompact(new Date(2026, 9, 12, 14, 0, 4));
  assert.equal(s, '20261012-140004');
});
