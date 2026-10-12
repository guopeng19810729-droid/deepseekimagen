# 模型与价格

价格来源：**apib.ai 定价页（登录后，黄金档）**，2026-10-10 抓取。
**1 credit = $0.10**；黄金价 ≈ 官方价 × 80%。
实际花费以任务返回的 `cost` 字段为准。

> 抓取时的账户：黄金档，余额约 $9.5。

---

## 一、按张计费（推荐用这一类，价格可预估）

| 模型 | 参考价/张 | 尺寸参数 | 说明 |
|---|---|---|---|
| `gpt-image-2.5-ext` | **$0.0085** | 比例 | **默认。5 考点 5/5，最便宜且最好** |
| `gpt-image-2-ext` | $0.0085 | 比例 | 同价，构图略逊 |
| `z-image-turbo` | $0.01 | 比例 | 极快（实测 4 秒）｜**本地可跑** |
| `nano-banana-2-lite-ext` | $0.0125 | 比例 | Gemini 系最便宜档 |
| `nano-banana-ext` | $0.0125 | 比例 | Gemini 系 |
| `seedream-5-0-flash` | $0.0137 | 比例 | 字节，快；位置约束会丢 |
| `seedream-5-0-pro` | $0.0146 起 | 1:1/1K/2K | 多规格按档位加价 |
| `grok-imagine-1.5-ext` | $0.015 | **不支持 size** | xAI |
| `nano-banana-2-ext` | $0.015 | 比例 | Gemini，暖调自然 |
| `grok-imagine-image` | $0.016 | **不支持 size** | xAI；默认输出 1248×832 非方形 |
| `seedream-4-0` | $0.0195 | 比例 | 字节上一代 |
| `qwen-image-3.0` | $0.0206 | 1:1/16:9/9:16 | 阿里；实测细节偏糊 |
| `wan2.7-image` | $0.0216 | 比例 | 阿里｜**本地可跑** |
| `flux-2-pro` | $0.024 | 1MP~4MP | FLUX｜**本地可跑** |
| `seedream-4-5` | $0.026 | 比例 | 字节 |
| `seedream-5-0-lite` | $0.028 | 比例 | 字节 |
| `qwen-image-3.0-pro` | $0.0286 | 比例 | 阿里 pro |
| `nano-banana-pro-ext` | $0.03 | 比例 | Gemini pro 档 |
| `dall-e-3` | $0.032 | 1:1/16:9/9:16 | OpenAI 老模型 |
| `flux-kontext-pro` | $0.032 | 比例 | 适合参考图编辑 |
| `flux-3-image` | $0.0328 ~ **$0.4856** | 768SQ/1K/1.5K/2K/4K | ⚠️ 规格跨度 15 倍，务必锁 size |
| `imagen-4.0-apimart` | $0.04 | 比例 | ⚠️ 实测提交后任务 `failed`，慎用 |
| `grok-imagine-image-quality` | $0.04 | 不支持 size | xAI 高质量档 |
| `flux-2` | $0.04 ~ 0.16 | 1MP~4MP | FLUX｜**本地可跑** |
| `midjourney` | **$0.04504 / 次（4 张）** | 比例 | 专用端点；单张约 $0.0113 |
| `wan2.7-image-pro` | $0.0544 | 比例 | 阿里 pro｜**本地可跑** |
| `flux-2-max` | $0.056 ~ 0.128 | 1MP~4MP | FLUX 顶配｜**本地可跑** |
| `flux-kontext` | $0.064 | 比例 | 按张计费最贵的一档 |

**「本地可跑」** = ComfyUI / SD 之类能在本机出的开源模型（z-image / wan / flux / qwen≤2.1）。
本机有本地管线时，这些不必花钱走 API。

---

## 二、按 Token 计费（费用不可预估，不建议主动用）

| 模型 | 文本输入 | 图片输入 | 图片输出 |
|---|---|---|---|
| `nano-banana-2-lite` | $0.2/M | $0.2/M | $24/M |
| `nano-banana` | $0.24/M | $0.24/M | $24/M |
| `nano-banana-2` | $0.4/M | $0.4/M | $48/M |
| `Nano Banana 2.1` | $1.2/M | $1.2/M | $24/M |
| `nano-banana-pro` | $1.6/M | $1.6/M | **$96/M** |
| `gpt-image-1-official` | $4/M | $8/M | $32/M |
| `gpt-image-1.5-official` | $4/M | $6.4/M | $25.6/M |
| `gpt-image-2-official` | $4/M | $6.4/M | $24/M |
| `gpt-image-2.5` | $4/M | $6.4/M | $24/M |
| `mai-image-2.6` | $4/M | $6.4/M | $30.4/M |
| `mai-image-2.6-flash` | $1.4/M | $2/M | $15.2/M |

---

## 三、5 考点横评（同一提示词）

提示词：

> Three ripe red apples on a wooden table, the middle one has a bite taken out of it, a small white ceramic cup stands to the left of the apples, soft morning sunlight comes in from the right side, the cup has a label reading "A1", photorealistic, sharp focus

考点：① 三个苹果 ② **中间**那个被咬 ③ 杯子在苹果**左边** ④ 光从**右边**来 ⑤ 标签写 **"A1"**

| 模型 | 价格/张 | ① | ② | ③ | ④ | ⑤ | 命中 |
|---|---|---|---|---|---|---|---|
| **`gpt-image-2.5-ext`** | $0.0085 | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| `gpt-image-2-ext` | $0.0085 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 |
| `nano-banana-2-ext` | $0.015 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 |
| `qwen-image-3.0` | $0.0206 | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 |
| `seedream-5-0-flash` | $0.0137 | ✅ | ❌ | ✅ | ✅ | ✅ | 4/5 |
| `grok-imagine-image` | $0.016 | ✅ | ❌ | ✅ | ✅ | ✅ | 3.5/5 |
| `midjourney` | $0.04504/次 | ⚠️ 1/4 | ❌ 0/4 | ✅ 4/4 | ✅ 4/4 | ✅ 4/4 | 3.5/5 |

**观察：**

- **最便宜的反而是最好的**（`gpt-image-2.5-ext` $0.0085 拿满分）
- **最贵的按张模型 `qwen-image-3.0`（2.4 倍价）细节最糊**
- `seedream-5-0-flash` 把被咬的苹果放在**前排**而非**中间** —— 位置约束丢失
- `grok-imagine-image` 画成**切开横截面**而不是咬痕，且输出非方形
- **Midjourney 的特征很明显**：空间关系（左/右）和文字渲染 **4/4 全中**，但
  「三个苹果 + 中间那个被咬」这类**数量 × 特定位置**的组合约束会被拆散
  （tile1 的中间苹果是"整齐切成两半"，tile3/4 有咬痕但咬的是前排）。
  它把 "photorealistic" 理解成**写实油画**而不是照片。
  → **MJ 适合氛围/风格/文字，不适合精确数量+位置约束**

**补充实测（2026-10-12）：MJ 会忽略「姿势 + 机位」这类构图约束，即使把它写在提示词最前面。**

一次服装/道具极复杂的人像需求（女仆装 + 巴洛克扶手椅 + 过膝袜 + 旧数码相机质感 + 9:16），
提示词**以机位和姿势开头**、并明确要求「侧卧蜷缩、镜头在腿部前方、强近大远小透视」。
结果 4 张全部是**常规坐姿 + 标准三分之四机位** —— 姿势与透视两个要求被完全忽略；
而**服装层次、荷叶边、双层袜口、菱形拉扣扶手椅、女仆发箍、暖光氛围全部准确还原**。

→ 可复用的分工经验：

| 需求类型 | 该用谁 |
|---|---|
| 服装/道具/材质/氛围/风格/文字 | **Midjourney** |
| 精确姿势、机位、透视、数量、空间关系、多约束指令跟随 | **gpt-image-2.5-ext** |

---

## 四、两个实测到的参数差异（写代码要注意）

1. **`size` 各家不统一**
   - `gpt-image-*`：只认比例（`1:1` / `16:9` …），传 `1024x1024` → **400**
     `size must be auto or one of 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 5:4, 4:5, 21:9`
   - `grok-imagine-*`：**完全不接受 `size`**
     `parameter "size" is not supported for asynchronous xAI image tasks`
   - seedream / qwen：吃比例，部分支持 `1K` / `2K` 档位写法
2. **Midjourney 走专用端点** `POST /v1/midjourney/generations`，**不需要 `model` 字段**，
   **没有 `n` 参数**（imagine 固定出 2×2 九宫格 = 4 张）。
   另有查询端点 `GET /v1/midjourney/{task_id}` 返回九宫格 URL + 4 个切片 URL +
   可交互按钮（`U1-U4` / `V1-V4` / reroll / pan / Zoom Out / Vary Region）。

---

## 五、Midjourney 的后续动作端点（完整清单）

`POST /v1/midjourney/generations/<action>`，全部异步任务制，各自独立计费
（计费键形如 `midjourney@<action>[-version][-speed]`）。

| 动作 | 路径 | 关键参数 |
|---|---|---|
| Imagine（出图） | `/generations` | `prompt`（可带原生 MJ 参数）、`size`（比例）、`version` |
| Blend（多图融合） | `/generations/blend` | 多张 `image_urls` |
| Describe（图生文） | `/generations/describe` | `image_url` |
| Edits（图像编辑） | `/generations/edits` | `image_url` + `prompt` |
| Upscale | `/generations/upscale` | `task_id` + `index`（1-4）或 `custom_id` |
| Variation | `/generations/variation` | `task_id` + `index` |
| High / Low Variation | `/generations/high-variation` · `/low-variation` | 同上 |
| Reroll（重跑） | `/generations/reroll` | `task_id` |
| Zoom out | `/generations/zoom` | `task_id` + `zoom_ratio` |
| Pan（平移扩图） | `/generations/pan` | `task_id` + `direction` |
| **Inpaint（局部重绘）** | `/generations/inpaint` | 进入 `MODAL` 状态，再用 `/modal` 提交蒙版 + 提示词 |
| Modal | `/generations/modal` | `mask` + `prompt` |
| Remix strong / subtle | `/generations/remix-strong` · `/remix-subtle` | 仅 v8.1 / v8.2 |
| Image-to-video | `/generations/video` | 按 `batch_size` 计费 |

**按钮 → 参数映射**：`GET /v1/midjourney/{task_id}` 返回 `buttons[].customId`
（形如 `MJ::JOB::upsample::4::6acc604e...`）。后续动作可以传 `index` / `direction` / `zoom_ratio`
让服务自动匹配，匹配失败时直接传 `custom_id`。

⚠️ **已实测：`upscale` 是收费空操作**（返回原图、SHA256 不变、照扣 $0.05504）——
详见 [`TROUBLESHOOTING.md` 第三节第 9 条](TROUBLESHOOTING.md#9-️-midjourney-的-upscale-是收费空操作实测-2-次共-011008)。
其余动作尚未实测，用前建议做「输出 vs 输入」的哈希比对。

---

## 六、平台侧的两个坑

1. **部分模型没开价**：`gemini-2.5-flash-image-preview` 返回
   `model_price_error: ratio or price is not configured`。
   316 个模型里**不是每个都能用**，先用 `--dry-run` 或小任务试。
2. **计费按 `--fast` 计**：Midjourney 文档说 `speed` 默认 relax，但平台实际自动追加了 `--fast`
   （返回的 `prompt_en` 结尾为 `... --ar 1:1 --v 6.1 --fast`）。要控成本需显式传 `speed`。

---

*数据来源：apib.ai 定价页（2026-10-10，黄金档）+ 本工具对同一提示词的实测扣费交叉验证。*
