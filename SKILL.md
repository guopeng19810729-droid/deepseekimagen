---
name: deepseek-imagen
description: 用 APIMart（apib.ai）聚合 API 生成图片。当用户说「生图 / 生成图片 / 画一张 / 出图 / 配图 / 生成海报 / 生成插画」，或要求按某个比例（1:1、16:9、9:16 等）产出图像文件时使用。默认走 gpt-image-2.5-ext 通道；仅当用户明确说 midjourney / MJ 时才用 Midjourney 通道（一次出 4 张，按次计价）。不用于本地 ComfyUI 等自建管线，也不用于视频生成。
version: 1.0.0
---

# deepseekimagen · 生图技能

用命令行工具 `scripts/gen.mjs` 调 APIMart 聚合 API 出图，自动落盘 + 记台账。

## 铁律（先看这三条）

1. **默认模型 `gpt-image-2.5-ext`。** 用户说「生图 / 生成图片」等任何未指定模型的话，**直接用默认**，不要问、不要换。
2. **只有用户明确说 `midjourney` / `MJ` 时才切到 Midjourney 通道。** 它按次计价（约 $0.045/次）且一次固定出 4 张，比默认贵 5 倍。
3. **尺寸一律用比例**：`1:1` / `16:9` / `9:16` / `4:3` / `3:4` / `3:2` / `2:3`。**传 `1024x1024` 这类像素值会被 API 拒绝**（400）。用户没说要比例时用配置里的 `default_ratio`。

## 怎么执行

先做一次自检（只在本次会话第一次生图前需要）：

```bash
node <skill-base-dir>/scripts/gen.mjs --check
```

生成（**中文提示词必须走 `--prompt-file`**，Windows 命令行直接传中文会乱码）：

```bash
# 1) 把提示词写成 UTF-8 文件（避免命令行编码问题）
#    用你手边的写文件能力写 ./prompt.txt

# 2) 出图（--ratio 也可写成 --ar / --aspect，与 Midjourney 写法一致）
node <skill-base-dir>/scripts/gen.mjs --prompt-file ./prompt.txt --ratio 1:1

# 中文/复杂场景也建议加 --json，便于你解析结果
node <skill-base-dir>/scripts/gen.mjs --prompt-file ./prompt.txt --ar 16:9 --json
```

⚠️ **尺寸只能传比例**。传 `1024x1024` 这类像素值会被拒绝（脚本会直接给出明确报错）。

网络请求会自动重试：GET 全部可重试错误都重试；**POST 只重试"确定未送达"的错误**
（连接被拒 / 域名解析失败 / 连接超时）与 429 —— 请求超时与连接重置**不重试**，
因为请求可能已被处理、重试有重复扣费风险。需要时可加 `--no-retry`。

`--json` 输出形如：

```json
{ "ok": true, "model": "gpt-image-2.5-ext", "ratio": "16:9", "status": "completed",
  "cost_usd": 0.0085, "files": ["F:\\deepseekimagen\\2026-10-12\\...png"],
  "format": ["png"], "ledger": "...ledger.csv", "prompt_sha1": "..." }
```

**拿到 `files` 后，用你的图片查看能力打开看一眼**（本技能的使用者通常具备视觉能力）：
如果图明显不符合要求（主体缺失、比例错、文字崩坏、画面糊），可以改提示词重出，
但**每次重出都会再花钱**，所以：先确认问题、改一处、再出一张，不要盲目连刷。

## 模型路由（按用户措辞决定，不要自作主张）

| 用户怎么说 | 用什么 | 费用 |
|---|---|---|
| 「生图」「生成图片」「画一张」 | `gpt-image-2.5-ext`（默认） | ~$0.0085/张 |
| 明确说「midjourney」「MJ」 | `midjourney` | ~$0.045/次（**4 张**） |
| 明确点名其他模型 | 按点名 | 见 `--models` |

其他常用（用户点名时才用）：

| 模型 | 参考价/张 | 特点 |
|---|---|---|
| `gpt-image-2-ext` | $0.0085 | 与默认同价 |
| `nano-banana-2-ext` | $0.015 | Gemini 系，暖调自然 |
| `seedream-5-0-flash` | $0.0137 | 字节，快；位置类约束会丢 |
| `grok-imagine-image` | $0.016 | xAI；**不接受 size 参数**，输出非方形 |
| `qwen-image-3.0` | $0.0206 | 阿里；实测细节偏糊 |
| `flux-2-max` | $0.056 | FLUX 顶配（本机也能本地跑） |

**本机有本地 ComfyUI**，所以这些「本地也能跑」的模型默认不用：
`z-image-turbo` / `wan*` / `flux*` / `qwen-image-2.0`。
用户明确要时才用（`--models` 里带 `本地可跑` 标记的就是这类）。

## 输出与台账

- **图片**：`config.output_dir`，默认按日期分目录：`<output_dir>/2026-10-12/<时间>-<slug>-<hash>-01.png`
- **格式按魔数判定**，不信平台给的扩展名（实测踩过两次：URL 写 `.png` 实际是 JPEG，反之也有）
- **台账**：`<skill>/data/ledger.csv` 一行一次生成（时间/模型/比例/张数/花费/task_id/文件/提示词哈希）
- **sidecar**：每张图旁边有一个同名 `.json`，内含**完整提示词**与参数 —— 图目录因此是自描述的
- 查看汇总：`node <skill-base-dir>/scripts/gen.mjs --ledger --tail 5`

**这些目录已在 .gitignore 里**，不会误提交。

## 费用保护

- `--dry-run` 预演：打印模型、比例、张数、预估费用，**不提交、不花钱**。拿不准时先跑它。
- 预估超过 `config.max_cost_usd_per_request`（默认 $0.30）会被拒绝，需要显式 `--force`
- 按 Token 计费的模型（`gpt-image-*-official` 等）**费用不可预估**，脚本会警告；不要主动用它们
- 真实花费以任务返回的 `cost` 为准，脚本会把它记进台账

## 配置与密钥

- 读取顺序：环境变量 `APIMART_API_KEY` → `config.json`（技能目录内，已 gitignore）
- 首次使用：`cp config.example.json config.json`，把 `api_key` 填成 `sk-` 开头的密钥
- **绝不要把密钥写进提示词、日志、帖子或提交到 git**
- 需要代理时在 config 里填 `proxy`（**默认留空直连** —— 实测 apib.ai 直连比走代理快约 3 倍；代理是给某些被墙站点用的）

## 排错

先跑 `--check`，它会逐项报告配置/密钥/连通/目录可写。常见问题：

| 现象 | 原因 | 处理 |
|---|---|---|
| `401` / `unauthorized` | 密钥错或没填 | 填 `config.json` 的 `api_key` |
| `size must be auto or one of ...` | 传了像素值 | 改传比例，如 `1:1` |
| `parameter "size" is not supported` | 该模型（如 grok）不收 size | 省略 `--ratio` |
| `model_price_error` | 该模型平台没开价 | 换模型（316 个里不是每个都能用） |
| 提交成功但任务 `failed` | 该模型/参数不可用 | 换模型或换参数重试 |
| 图片 URL 打不开 | 平台 URL **24 小时过期** | 脚本已即时下载落盘；不要只存 URL |
| 中文乱码 | 命令行传中文 | 用 `--prompt-file` |
| 任务一直 pending | 排队 | 脚本会轮询到 `poll_timeout_ms`（默认 5 分钟） |

更完整的坑与实测数据见 `docs/TROUBLESHOOTING.md` 和 `docs/MODELS.md`。
