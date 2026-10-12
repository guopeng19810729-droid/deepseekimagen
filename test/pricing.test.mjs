// 价格一致性测试：用**定价页快照**逐条校验 src/models.mjs。
//
// 为什么必须用快照、而不是 `/models` 接口：
//   `/models` 已知会漏报图像模型（实测它只标了 18 个图像模型，而当时实际有 51 个；
//   连能正常出图的 `z-image-turbo` 都被它报成 "does not exist"）。
//   2026-10-12 就因为拿它当"模型是否存在"的裁判，把 9 个定价页上仍在售的模型
//   误判成"已下线"并从清单里删掉 —— 这个测试就是为了让那类错误在本地就暴露。
//
// 快照来源：登录后人工保存定价页（Ctrl+S），再用脚本抽出模型与价格。
// 平台改价/改名后，重新保存一次快照即可 —— 这个测试会立刻指出哪些条目对不上。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../src/models.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP_DIR = join(ROOT, 'docs', 'pricing');
const files = existsSync(SNAP_DIR) ? readdirSync(SNAP_DIR).filter((f) => /^snapshot-.*\.json$/.test(f)).sort() : [];
const latest = files[files.length - 1];
const snap = latest ? JSON.parse(readFileSync(join(SNAP_DIR, latest), 'utf8')) : null;

/** 定价页上的**显示名** → 我们的 API id（只有不一致的才需要列在这里） */
const DISPLAY_TO_ID = {
  'DALL-E 3': 'dall-e-3',
  Midjourney: 'midjourney',
  'Nano Banana 2.1': 'gemini-nano-banana-2.1',
};
const toId = (name) => DISPLAY_TO_ID[name] ?? name;

/**
 * 价格比对必须带容差 —— 因为**定价页会四舍五入，而清单里存的是实测精确值**。
 * 例：Midjourney 页面显示 `$0.045/次`，实际扣费是 0.4504 credits = $0.04504。
 * 容差取「1e-4 与 0.5% 中的较大者」：既能容纳页面舍入，又能抓住真正的改价
 * （例如清单 0.02 vs 快照 0.025 会被判为不一致）。
 */
const near = (a, b) => Math.abs(a - b) <= Math.max(1e-4, Math.abs(b) * 0.005);

test('定价页快照存在且结构正确', () => {
  assert.ok(latest, 'docs/pricing/ 下应有 snapshot-*.json（登录后保存定价页并抽取）');
  assert.ok(Array.isArray(snap.image) && snap.image.length > 20, `快照应含生图模型清单，实际 ${snap?.image?.length}`);
  assert.ok(snap.image.every((m) => m.name && m.kind), '快照每行应有 name 与 kind');
});

test('清单里按张计费的模型，价格必须与快照完全一致', () => {
  const priced = snap.image.filter((m) => m.kind === 'per_image');
  assert.ok(priced.length > 20, `快照里按张计费的模型应有 20+ 个，实际 ${priced.length}`);
  for (const s of priced) {
    const id = toId(s.name);
    const local = MODELS[id];
    assert.ok(local, `快照里的 ${s.name}（id=${id}）在清单里缺失 —— 不该删掉仍在售的模型`);
    assert.ok(
      near(local.usd, s.usd),
      `${id} 价格与快照不一致：清单 ${local.usd} vs 快照 ${s.usd}（容差内允许页面舍入）`,
    );
    assert.equal(local.pricing, undefined, `${id} 有真实价格就不该标 pricing`);
  }
});

test('清单里按张计费的条目都必须能在快照里找到（防止收录定价页没有的模型）', () => {
  const snapIds = new Set(snap.image.map((m) => toId(m.name)));
  for (const [id, m] of Object.entries(MODELS)) {
    if (m.endpoint === 'midjourney') continue;      // MJ 在快照里是「按次」那一行
    if (m.usd == null || m.pricing === 'token') continue;
    assert.ok(
      snapIds.has(id),
      `${id} 有价格但快照里没有它 —— 只在 /models 出现、定价页未上架的模型不该按"可买"写进清单`,
    );
  }
});

test('快照里按 token 计费的模型，清单里也必须标成 token（若已收录）', () => {
  for (const s of snap.image.filter((m) => m.kind === 'token')) {
    const local = MODELS[toId(s.name)];
    if (!local) continue;                            // 允许清单只收录其中一部分
    assert.equal(local.pricing, 'token', `${toId(s.name)} 在定价页是按 token，清单里标错了`);
    assert.equal(local.usd, null, `${toId(s.name)} 按 token 计费时 usd 应为 null`);
  }
});

test('快照里按次计费的模型（Midjourney）价格一致', () => {
  for (const s of snap.image.filter((m) => m.kind === 'per_call')) {
    const local = MODELS[toId(s.name)];
    if (!local) continue;
    assert.ok(
      near(local.usd, s.usd),
      `${toId(s.name)} 按次价格与快照不一致：清单 ${local.usd} vs 快照 ${s.usd}`,
    );
  }
});

// 容差本身也要有测试 —— 否则一个过松的容差会让上面几条断言变成摆设
test('容差既能容纳页面舍入，也不会漏掉真实改价', () => {
  assert.equal(near(0.04504, 0.045), true, '页面把 0.04504 显示成 0.045，应被容纳');
  assert.equal(near(0.0085, 0.0085), true, '完全相等');
  assert.equal(near(0.02, 0.025), false, '差 0.005（25%）必须判为不一致');
  assert.equal(near(0.05, 0.052), false, '差 4% 应超出 0.5% 容差');
  assert.equal(near(0.0286, 0.0285), true, '万分之一的差异应视为一致');
});
