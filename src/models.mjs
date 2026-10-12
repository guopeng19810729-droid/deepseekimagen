// 模型注册表：能力、价格（apib.ai 定价页 · 黄金档）、支持的尺寸参数形式
//
// ⚠️ 权威源是**定价页快照** `docs/pricing/snapshot-*.json`，不是 `/models` 接口。
//    `/models` 已知会漏报图像模型（实测：它只标了 18 个图像模型，而当时实际有 51 个；
//    连能正常出图的 `z-image-turbo` 都会被它报成 "does not exist"）。
//    所以**绝不能用 `/models` 判断某个模型"是否存在"** —— 那会产出假阳性。
//    `test/pricing.test.mjs` 会用快照逐条校验本文件里的价格，改这里就必须与快照对齐。

/** 默认主力模型（性价比最高：最便宜且 5 考点全中） */
export const DEFAULT_MODEL = 'gpt-image-2.5-ext';
/** 创意/艺术场景的备选 */
export const MIDJOURNEY_MODEL = 'midjourney';

/** gpt-image 系支持的尺寸（必须传比例，传像素会 400） */
const GPT_IMAGE_RATIOS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];
/** gemini / nano-banana 系 */
const GEMINI_RATIOS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '2:1', '1:2'];
/** midjourney 只要比例 */
const MJ_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];
/** 常见视频/图像比例 */
const BASIC_RATIOS = ['1:1', '16:9', '9:16'];
/** seedream 系 */
const SEEDREAM_RATIOS = ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'];
/** FLUX 按像素档位 */
const FLUX_MP = ['1MP', '2MP', '3MP', '4MP'];

export const MODELS = {
  // ── 默认主力（按张计费，便宜且指令遵循好）────────────────
  'gpt-image-2.5-ext': {
    endpoint: 'images', usd: 0.0085, unit: '张', ratios: GPT_IMAGE_RATIOS,
    note: '默认主力。5 考点实测 5/5，全场最便宜',
  },
  'gpt-image-2-ext': {
    endpoint: 'images', usd: 0.0085, unit: '张', ratios: GPT_IMAGE_RATIOS,
    note: '与 2.5-ext 同价',
  },

  // ── gpt-image 官方直连（按 token，费用不可预估）──────────
  'gpt-image-1-official': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '官方直连，输入 $4/M' },
  'gpt-image-1.5-official': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '官方直连，输入 $4 / 输出 $8 · 每 100 万 token' },
  'gpt-image-2-official': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '官方直连，输入 $4/M' },
  'gpt-image-2.5': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '按 token，输入 $4/M' },
  'gpt-image-2.5-sunburst': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '按 token，输入 $4/M' },

  // ── Gemini / nano-banana 系 ──────────────────────────────
  'gemini-nano-banana-2.1-ext': { endpoint: 'images', usd: 0.02, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini nano-banana 2.1 按张档（定价页显示名 "Nano Banana 2.1" 是按 token 档）' },
  'nano-banana-2-ext': { endpoint: 'images', usd: 0.015, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini，暖调自然' },
  'nano-banana-2-lite-ext': { endpoint: 'images', usd: 0.0125, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini 最便宜一档' },
  'nano-banana-ext': { endpoint: 'images', usd: 0.0125, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini' },
  'nano-banana-pro-ext': { endpoint: 'images', usd: 0.03, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini pro 档' },
  'nano-banana': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $0.24 / 输出 $2 · 每 100 万' },
  'nano-banana-2': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $0.4 / 输出 $2.4 · 每 100 万' },
  'nano-banana-2-lite': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $0.2 / 输出 $1.2 · 每 100 万' },
  'nano-banana-pro': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $1.6 / 输出 $9.6 · 每 100 万' },
  'gemini-nano-banana-2.1': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '定价页显示名 "Nano Banana 2.1"；输入 $1.2 / 输出 $6 · 每 100 万' },

  // ── xAI（不支持 size 参数）───────────────────────────────
  'grok-imagine-1.5-ext': { endpoint: 'images', usd: 0.015, unit: '张', ratios: null, note: 'xAI 1.5，不支持 size' },
  'grok-imagine-1.5-edit-ext': { endpoint: 'images', usd: 0.015, unit: '张', ratios: null, note: 'xAI 1.5 编辑档，不支持 size' },
  'grok-imagine-2.0-ext': { endpoint: 'images', usd: 0.015, unit: '张', ratios: null, note: 'xAI 2.0，不支持 size' },
  'grok-imagine-image': { endpoint: 'images', usd: 0.016, unit: '张', ratios: null, note: 'xAI，不支持 size，默认输出 1248x832 非方形' },
  'grok-imagine-image-2.0': { endpoint: 'images', usd: 0.032, unit: '张', ratios: null, note: 'xAI 2.0，不支持 size' },
  'grok-imagine-image-quality': { endpoint: 'images', usd: 0.04, unit: '张', ratios: null, note: 'xAI 高质量档，不支持 size' },

  // ── 字节 seedream ────────────────────────────────────────
  'seedream-5-0-flash': { endpoint: 'images', usd: 0.0137, unit: '张', ratios: SEEDREAM_RATIOS, note: '字节，快；实测位置约束会丢' },
  'seedream-5-0-pro': { endpoint: 'images', usd: 0.0146, unit: '张', ratios: ['1:1', '1K', '2K'], note: '字节，多规格按档位加价' },
  'seedream-4-0': { endpoint: 'images', usd: 0.0195, unit: '张', ratios: SEEDREAM_RATIOS, note: '字节上一代' },
  'seedream-4-5': { endpoint: 'images', usd: 0.026, unit: '张', ratios: SEEDREAM_RATIOS, note: '字节' },
  'seedream-5-0-lite': { endpoint: 'images', usd: 0.028, unit: '张', ratios: SEEDREAM_RATIOS, note: '字节' },

  // ── 阿里 qwen-image / wan ────────────────────────────────
  'qwen-image-2.0': { endpoint: 'images', usd: 0.02, unit: '张', ratios: BASIC_RATIOS, note: '阿里（本机可本地跑，不必走 API）', localAlt: true },
  'qwen-image-2.0-pro': { endpoint: 'images', usd: 0.05, unit: '张', ratios: BASIC_RATIOS, note: '阿里 pro（本机可本地跑）', localAlt: true },
  'qwen-image-3.0': { endpoint: 'images', usd: 0.0206, unit: '张', ratios: BASIC_RATIOS, note: '阿里；实测咬痕/细节糊，比 2.0 更贵画质更一般' },
  'qwen-image-3.0-pro': { endpoint: 'images', usd: 0.0286, unit: '张', ratios: BASIC_RATIOS, note: '阿里 pro' },
  'wan2.7-image': { endpoint: 'images', usd: 0.0216, unit: '张', ratios: BASIC_RATIOS, note: '阿里', localAlt: true },
  'wan2.7-image-pro': { endpoint: 'images', usd: 0.0544, unit: '张', ratios: BASIC_RATIOS, note: '阿里 pro', localAlt: true },

  // ── FLUX ─────────────────────────────────────────────────
  'flux-2-pro': { endpoint: 'images', usd: 0.024, unit: '张', ratios: FLUX_MP, note: 'FLUX', localAlt: true },
  'flux-2': { endpoint: 'images', usd: 0.04, unit: '张', ratios: FLUX_MP, note: 'FLUX', localAlt: true },
  'flux-2-max': { endpoint: 'images', usd: 0.056, unit: '张', ratios: FLUX_MP, note: 'FLUX 顶配', localAlt: true },
  'flux-3-image': { endpoint: 'images', usd: 0.0328, unit: '张', ratios: ['768SQ', '1K', '1.5K', '2K', '4K'], note: 'FLUX3；规格跨度极大，最高 $0.4856，务必锁 size', localAlt: true },
  'flux-kontext-pro': { endpoint: 'images', usd: 0.032, unit: '张', ratios: BASIC_RATIOS, note: '适合参考图编辑', localAlt: true },
  'flux-kontext': { endpoint: 'images', usd: 0.064, unit: '张', ratios: BASIC_RATIOS, note: '按张计费最贵的一档', localAlt: true },

  // ── 其他 ─────────────────────────────────────────────────
  'z-image-turbo': { endpoint: 'images', usd: 0.01, unit: '张', ratios: BASIC_RATIOS, note: '阿里 turbo，实测 15~18 秒出图', localAlt: true },
  'dall-e-3': { endpoint: 'images', usd: 0.032, unit: '张', ratios: BASIC_RATIOS, note: 'OpenAI 老模型' },
  'imagen-4.0-apimart': { endpoint: 'images', usd: 0.04, unit: '张', ratios: BASIC_RATIOS, note: 'Google imagen（实测提交后任务 failed，慎用）' },
  'mai-image-2.6': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $4/M（尺寸支持未实测）' },
  'mai-image-2.6-flash': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GEMINI_RATIOS, note: '按 token，输入 $1.4/M（尺寸支持未实测）' },

  // ── Midjourney：走专用端点，一次出 4 张 ─────────────────
  midjourney: {
    endpoint: 'midjourney', usd: 0.04504, unit: '次(4张)', ratios: MJ_RATIOS,
    note: '专用端点。一次 imagine 出 2x2 九宫格 = 4 张，单张约 $0.0113。风格/工艺感强，但"数量+特定位置"与"姿势/机位"类约束会衰减',
    versions: ['6.1', '7', '8.1', '8.2'],
  },
};

/** 别名 → 正式模型 id */
const ALIASES = new Map(Object.entries({
  'default': DEFAULT_MODEL, '默认': DEFAULT_MODEL, '2.5': 'gpt-image-2.5-ext', 'gpt-image-2.5': 'gpt-image-2.5-ext',
  mj: 'midjourney', mid: 'midjourney', 'mj-fast': 'midjourney',
  nano: 'nano-banana-2-ext', 'banana': 'nano-banana-2-ext',
  seedream: 'seedream-5-0-pro', qwen: 'qwen-image-2.0', grok: 'grok-imagine-image',
}));

export function resolveModel(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (MODELS[key]) return key;
  if (ALIASES.has(key)) return ALIASES.get(key);
  // 大小写不敏感匹配
  const hit = Object.keys(MODELS).find((m) => m.toLowerCase() === key);
  return hit || null;
}

/** 判断某个模型是不是“本机可以本地跑”的那类（z-image / wan / flux / qwen<=2.1） */
export function isLocalAlternative(model) {
  return Boolean(MODELS[model]?.localAlt);
}

const RATIO_WORDS = new Map(Object.entries({
  '方图': '1:1', '正方': '1:1', '正方形': '1:1', square: '1:1', '1：1': '1:1',
  '横图': '16:9', '横版': '16:9', '宽屏': '16:9', landscape: '16:9', wide: '16:9', '16：9': '16:9',
  '竖图': '9:16', '竖版': '9:16', '手机': '9:16', portrait: '9:16', '9：16': '9:16',
  '4：3': '4:3', '3：4': '3:4', '3：2': '3:2', '2：3': '2:3',
}));

/** 把用户写的尺寸归一成模型接受的比例；不接受则抛出可读错误 */
export function normalizeRatio(input, model) {
  const spec = MODELS[model];
  if (!spec) throw new Error(`未知模型: ${model}`);
  if (spec.ratios === null) return null; // 该模型不接受 size
  const raw = String(input ?? '').trim();
  if (!raw) return spec.ratios.includes('1:1') ? '1:1' : spec.ratios[0];
  const mapped = RATIO_WORDS.get(raw.toLowerCase()) || RATIO_WORDS.get(raw) || raw;
  if (spec.ratios.includes(mapped)) return mapped;
  throw new Error(
    `模型 ${model} 不支持尺寸 "${raw}"。支持：${spec.ratios.join(', ')}\n` +
    `（提示：像素值如 1024x1024 会被拒绝，必须用比例）`
  );
}

/** 预估单次费用；按 token 计费或价格未知时返回 null（不可预估） */
export function estimateUsd(model, images = 1) {
  const spec = MODELS[model];
  if (!spec) return null;
  if (spec.pricing === 'token' || spec.pricing === 'unknown' || spec.usd == null) return null;
  return spec.usd * (spec.endpoint === 'midjourney' ? 1 : images);
}

/** 给 --models 用的清单（按价格排序，标注本地可跑） */
export function listModels({ includeLocal = true } = {}) {
  return Object.entries(MODELS)
    .filter(([, v]) => includeLocal || !v.localAlt)
    .sort((a, b) => (a[1].usd ?? 1e9) - (b[1].usd ?? 1e9))
    .map(([id, v]) => ({ id, ...v }));
}

/**
 * 对比本地清单与平台 `/models` 返回的 id 列表（纯函数，便于测试）。
 *
 * ⚠️ **只作参考，不能当"模型是否存在"的裁判。** `/models` 已知会漏报图像模型
 * （实测只标 18 个图像模型而实际有 51 个；能正常出图的 `z-image-turbo` 也会被它报成不存在）。
 * 2026-10-12 就因为它误判，把 9 个定价页上仍在售的模型当成了"已下线"。
 * 所以两个方向都只是**线索**：
 *   - `missingOnPlatform`：清单里有、`/models` 没报 —— 需人工核对定价页，**不代表已下线**
 *   - `notInRegistry`：`/models` 有、清单没有 —— 可能只是非生图模型，**也可能定价页没上架（不可用）**
 * 真正的权威是定价页快照，见 `test/pricing.test.mjs`。
 */
export function compareRegistry(platformIds, { registry = MODELS } = {}) {
  const set = new Set(
    (platformIds || []).filter((x) => x != null && x !== '').map((x) => String(x)),
  );
  const localIds = Object.keys(registry);
  return {
    platformCount: set.size,
    localCount: localIds.length,
    missingOnPlatform: localIds.filter((id) => !set.has(id)),
    notInRegistry: [...set].filter((id) => !Object.prototype.hasOwnProperty.call(registry, id)),
  };
}
