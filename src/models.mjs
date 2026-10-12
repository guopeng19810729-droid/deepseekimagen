// 模型注册表：能力、参考价（apib.ai 黄金档，2026-10-10 抓取）、支持的尺寸参数形式
// 价格是“参考价”，实际以任务返回的 cost 字段为准（脚本会记录真实花费）。

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

export const MODELS = {
  // ── 默认主力（按张计费，便宜且指令遵循好）────────────────
  'gpt-image-2.5-ext': {
    endpoint: 'images', usd: 0.0085, unit: '张', ratios: GPT_IMAGE_RATIOS,
    note: '默认主力。5 考点实测 5/5，全场最便宜',
  },
  // ── 同价位段备选 ──────────────────────────────────────────
  'z-image-turbo': { endpoint: 'images', usd: 0.01, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里 turbo，4 秒出图', localAlt: true },
  'seedream-5-0-flash': { endpoint: 'images', usd: 0.0137, unit: '张', ratios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], note: '字节，快；实测位置约束会丢' },
  'seedream-5-0-pro': { endpoint: 'images', usd: 0.0146, unit: '张', ratios: ['1:1', '1K', '2K'], note: '字节，多规格按档位加价' },
  'grok-imagine-image': { endpoint: 'images', usd: 0.016, unit: '张', ratios: null, note: 'xAI，不支持 size，默认输出 1248x832 非方形' },
  'seedream-4-0': { endpoint: 'images', usd: 0.0195, unit: '张', ratios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], note: '字节上一代' },
  'qwen-image-3.0': { endpoint: 'images', usd: 0.0206, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里；实测咬痕/细节糊，最贵且画质一般' },
  'wan2.7-image': { endpoint: 'images', usd: 0.0216, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里', localAlt: true },
  'flux-2-pro': { endpoint: 'images', usd: 0.024, unit: '张', ratios: ['1MP', '2MP', '3MP', '4MP'], note: 'FLUX', localAlt: true },
  'seedream-4-5': { endpoint: 'images', usd: 0.026, unit: '张', ratios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], note: '字节' },
  'seedream-5-0-lite': { endpoint: 'images', usd: 0.028, unit: '张', ratios: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], note: '字节' },
  'qwen-image-3.0-pro': { endpoint: 'images', usd: 0.0286, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里 pro' },
  'dall-e-3': { endpoint: 'images', usd: 0.032, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: 'OpenAI 老模型' },
  'flux-kontext-pro': { endpoint: 'images', usd: 0.032, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '适合参考图编辑' },
  'flux-3-image': { endpoint: 'images', usd: 0.0328, unit: '张', ratios: ['768SQ', '1K', '1.5K', '2K', '4K'], note: 'FLUX3；规格跨度极大，最高 $0.4856，务必锁 size' },
  'imagen-4.0-apimart': { endpoint: 'images', usd: 0.04, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: 'Google imagen（实测提交后任务 failed，慎用）' },
  'grok-imagine-image-quality': { endpoint: 'images', usd: 0.04, unit: '张', ratios: null, note: 'xAI 高质量档' },
  'wan2.7-image-pro': { endpoint: 'images', usd: 0.0544, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里 pro', localAlt: true },
  'flux-2-max': { endpoint: 'images', usd: 0.056, unit: '张', ratios: ['1MP', '2MP', '3MP', '4MP'], note: 'FLUX 顶配', localAlt: true },

  // ── 平台新增（2026-10-12 由 `--models --live` 发现；价格待补）────────────
  // 这些 id 在平台 /models 里确实存在，但我手上还没有它们的价格（定价页需重新抓取）。
  // 显式标 pricing:'unknown' 而不是留空 —— 否则费用闸门会静默失效：
  // estimateUsd 返回 null，单次上限保护对它们等于没有。
  'gpt-image-2.5-flare': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GPT_IMAGE_RATIOS, note: '2.5 系新档，价格待补' },
  'gpt-image-2.5-sunburst': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GPT_IMAGE_RATIOS, note: '2.5 系新档，价格待补' },
  'gemini-nano-banana-2.1-ext': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GEMINI_RATIOS, note: 'nano-banana 系新命名（旧 nano-banana-*-ext 已全部下线），价格待补' },
  'gemini-3-pro-image-preview': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini 3 图像预览，价格待补' },
  'gemini-3.1-flash-image-preview': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini 3.1 图像预览，价格待补' },
  'gemini-3.1-flash-lite-image': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: GEMINI_RATIOS, note: 'Gemini 3.1 轻量图像，价格待补' },
  'grok-imagine-1.5-apimart': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: null, note: 'xAI（旧 grok-imagine-1.5-ext 已下线），价格待补' },
  'grok-imagine-2.0-ext': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: null, note: 'xAI 2.0，价格待补' },
  'grok-imagine-image-2.0': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: null, note: 'xAI 2.0，价格待补' },
  'flux-2-flex': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: ['1MP', '2MP', '3MP', '4MP'], note: 'FLUX（旧 flux-2 已下线）', localAlt: true },
  'flux-kontext-max': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: 'FLUX kontext 顶配（旧 flux-kontext 已下线）', localAlt: true },
  'qwen-image-2.0': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里（本机可本地跑，不必走 API）', localAlt: true },
  'qwen-image-2.0-pro': { endpoint: 'images', pricing: 'unknown', usd: null, unit: '张', ratios: ['1:1', '16:9', '9:16'], note: '阿里 pro', localAlt: true },

  // ── 按 Token 计费（价格不可预估，慎用）──────────────────
  'gpt-image-2-official': { endpoint: 'images', pricing: 'token', usd: null, unit: 'Token', ratios: GPT_IMAGE_RATIOS, note: '官方直连，按 token 计（图片输出约 $24/M），成本不可预估' },

  // ── Midjourney：走专用端点，一次出 4 张 ─────────────────
  midjourney: {
    endpoint: 'midjourney', usd: 0.04504, unit: '次(4张)', ratios: MJ_RATIOS,
    note: '专用端点。一次 imagine 出 2x2 九宫格 = 4 张，单张约 $0.0113。油画/摄影风格强，"数量+特定位置"类组合约束会衰减',
    versions: ['6.1', '7', '8.1', '8.2'],
  },
};

/** 别名 → 正式模型 id */
const ALIASES = new Map(Object.entries({
  'default': DEFAULT_MODEL, '默认': DEFAULT_MODEL, '2.5': 'gpt-image-2.5-ext', 'gpt-image-2.5': 'gpt-image-2.5-ext',
  mj: 'midjourney', mid: 'midjourney', 'mj-fast': 'midjourney',
  nano: 'gemini-nano-banana-2.1-ext', 'banana': 'gemini-nano-banana-2.1-ext',
  seedream: 'seedream-5-0-pro', qwen: 'qwen-image-3.0', grok: 'grok-imagine-image',
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

/** 预估单次费用；按 token 计费的模型返回 null（不可预估） */
export function estimateUsd(model, images = 1) {
  const spec = MODELS[model];
  if (!spec) return null;
  if (spec.pricing === 'token' || spec.usd == null) return null;
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
 * 对比本地价格表与平台实际返回的模型清单（纯函数，便于测试）。
 *
 * 方向说明：平台的 `/models` 包含**全部模态**（LLM / 视频 / 音频 / 向量…），
 * 所以「平台有、清单没有」绝大多数只是非生图模型，参考价值低；
 * 真正可行动的是「清单有、平台没有」—— 那意味着清单里的 id 已下线或改名，价格表该更新了。
 */
export function compareRegistry(platformIds, { registry = MODELS } = {}) {
  // 过滤 null/undefined/空串再转字符串，避免把 'null'/'undefined' 当成真实模型 id
  const set = new Set(
    (platformIds || []).filter((x) => x != null && x !== '').map((x) => String(x)),
  );
  const localIds = Object.keys(registry);
  return {
    platformCount: set.size,
    localCount: localIds.length,
    /** 清单里有、平台已没有 —— 需要人工核对 */
    missingOnPlatform: localIds.filter((id) => !set.has(id)),
    /** 平台有、清单未收录 —— 可能只是别的模态 */
    notInRegistry: [...set].filter((id) => !Object.prototype.hasOwnProperty.call(registry, id)),
  };
}
