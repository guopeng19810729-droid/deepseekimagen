# deepseekimagen

用 [APIMart](https://apib.ai)（apib.ai）聚合 API **生图**的命令行工具，同时是一个可直接挂给 AI Agent 的 **Skill**。
零依赖（只用 Node 内置模块），自动落盘、自动记账。

[![CI](https://github.com/guopeng19810729-droid/deepseekimagen/actions/workflows/ci.yml/badge.svg)](https://github.com/guopeng19810729-droid/deepseekimagen/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![node](https://img.shields.io/badge/node-%3E%3D18-blue)

```bash
node scripts/gen.mjs --prompt-file prompt.txt --ratio 1:1
# → F:\deepseekimagen\2026-10-12\20261012-113710-一只戴眼镜的橘猫-c917cb-01.png
#   花费 $0.0085   已写入台账
```

---

## 为什么是这个默认模型

同一提示词、同一尺寸，对 7 个闭源生图模型做过 5 考点横评（数量 / 特定位置 / 空间关系 / 光照方向 / 文字渲染）：

| 模型 | 价格/张 | 命中 | 备注 |
|---|---|---|---|
| **`gpt-image-2.5-ext`** | **$0.0085** | **5/5** | **默认。最便宜且最好** |
| `gpt-image-2-ext` | $0.0085 | 5/5 | 同价 |
| `nano-banana-2-ext` | $0.015 | 5/5 | Gemini，暖调自然 |
| `seedream-5-0-flash` | $0.0137 | 4/5 | 位置约束会丢 |
| `grok-imagine-image` | $0.016 | 3.5/5 | 画成切面非咬痕；非方形输出 |
| `qwen-image-3.0` | $0.0206 | 5/5 | 最贵，细节糊 |
| `midjourney` | $0.04504/次（4 张） | 3.5/5 | 油画风强；"数量+特定位置"会衰减 |

**结论：最便宜的反而是最好的** —— 所以默认 `gpt-image-2.5-ext`，Midjourney 只在需要创意/艺术风格时手动切。

详见 [`docs/MODELS.md`](docs/MODELS.md)。

> ⚠️ 上表是 **2026-10-10** 的实测记录，其中的 `nano-banana-2-ext` 等 id 平台后来已**改名或下线**
> （见下方「价格表会过期」）。结论（谁便宜、谁跟得准）仍然有效，但**模型 id 请以 `--models` 为准**。

---

## 效果示例

以下都是本工具直接产出的原图（每张图旁边的 sidecar JSON 里存着完整提示词与参数）：

| 戏曲女神 | 女仆 Cosplay（Midjourney） | 女仆 Cosplay（本地 Qwen-Image） |
|---|---|---|
| [![戏曲女神](docs/images/example-opera.jpg)](docs/images/example-opera.jpg) | [![女仆 MJ](docs/images/example-maid-mj.jpg)](docs/images/example-maid-mj.jpg) | [![女仆 本地](docs/images/example-maid-local.jpg)](docs/images/example-maid-local.jpg) |
| `gpt-image-2.5-ext` · $0.0085 | `midjourney` · $0.045/次 | 本地 ComfyUI · **免费** |

**每张图的完整提示词、模型参数、真实扣费、task_id** 都在 [`docs/images/SOURCES.md`](docs/images/SOURCES.md)，
可直接复现。同一提示词在不同引擎上的差异、以及「精确姿势/机位该用谁」的实测结论见 [`docs/MODELS.md`](docs/MODELS.md)。

> 仓库里存的是**等比压缩到宽 640 的 JPEG**（8.1 MB → 495.8 KB），避免为示例图把仓库撑大。

---

## 快速开始

### 0. 前置

- **Node ≥ 18**（推荐 ≥ 24；用代理时需要 ≥ 24）
- 一个 apib.ai / APIMart 的 API Key（`sk-` 开头）

### 1. 装成技能（推荐，AI 可直接调用）

```powershell
pwsh -File setup.ps1
```

它做三件事：把本仓库挂成 `~/.agents/skills/deepseek-imagen` 的 **Junction**（两边同一份文件）、
从模板生成 `config.json`、并确认 `config.json` 已被 `.gitignore` 挡住。

### 2. 填 Key

打开 `config.json`，填 `api_key`。**也可以用环境变量**（优先级更高）：

```powershell
$env:APIMART_API_KEY = "sk-..."
```

### 3. 自检

```bash
node scripts/gen.mjs --check
```

逐项报告：Node 版本、配置文件位置、密钥、API 连通与鉴权、输出/台账目录可写性。

### 4. 出图

```bash
# 预演（不花钱，先看模型/比例/预估费用）
node scripts/gen.mjs --prompt "a red apple on a white table" --dry-run

# 真出图。中文提示词请写进文件再传（避开 Windows 命令行编码问题）
node scripts/gen.mjs --prompt-file prompt.txt --ratio 16:9

# 需要程序解析时加 --json
node scripts/gen.mjs --prompt-file prompt.txt --ratio 1:1 --json
```

---

## 模型路由约定

| 用户怎么说 | 用什么 | 约价 |
|---|---|---|
| 「生图」「生成图片」「画一张」 | `gpt-image-2.5-ext`（默认） | $0.0085/张 |
| 明确说「midjourney」「MJ」 | `midjourney` | $0.045/次（**固定 4 张**） |
| 明确点名其他模型 | 按点名 | 见 `--models` |

**尺寸必须是比例**：`1:1` / `16:9` / `9:16` / `4:3` / `3:4` / `3:2` / `2:3`。
也接受中文说法 `方图` / `横图` / `竖图`。
传 `1024x1024` 这类**像素值会被 API 拒绝**（HTTP 400）。

`--models` 里标了 `[本地可跑]` 的是 ComfyUI 之类能本地出的（z-image / wan / flux / qwen≤2.1）——
本机有本地管线时不必花这个钱。

---

## CLI 参考

```
dimg --prompt "<提示词>" [选项]
dimg --prompt-file prompt.txt [选项]
dimg --check | --models | --ledger [--tail N]
```

| 选项 | 说明 |
|---|---|
| `--model <id>` | 指定模型（默认取 `config.default_model`） |
| `--ratio <比例>` | `1:1` / `16:9` / `9:16` …，也接受 `方图/横图/竖图` |
| `--ar` / `--aspect` / `--aspect-ratio` | `--ratio` 的别名（`--ar 9:16` 与 Midjourney 写法一致） |
| `--size <比例>` | 也可用；但 `--size 1024x1024` 这类**像素值会明确报错**（平台只认比例） |
| `--out <目录>` | 覆盖输出目录 |
| `--images <n>` | 张数（Midjourney 固定 4 张，忽略此项） |
| `--version <v>` | Midjourney 版本（如 `6.1` / `7` / `8.2`） |
| `--no-retry` | 关闭网络重试（默认 GET 重试全部可重试错误；POST 只重试"确定未送达"的错误） |
| `--models --live [--all]` | 对比平台 `/models`，检查本地价格表是否已过期（发现失效 id 则**退出码 4**） |
| `--dry-run` | 只预演：打印模型/比例/张数/预估费用，**不提交、不花钱** |
| `--force` | 跳过单次费用上限保护 |
| `--json` | 以 JSON 输出结果 |
| `--config <路径>` | 指定配置文件 |

### 价格表会过期（重要）

`src/models.mjs` 里的价格是**手工维护**的 —— 平台的模型清单接口**不返回价格**。
而平台改名的速度很快：**10-10 抄的表，10-12 就已经有 9 个 id 失效了**
（`nano-banana-*-ext` 整族改成 `gemini-nano-banana-2.1-*`、`grok-imagine-1.5-ext` 改成
`grok-imagine-1.5-apimart`、`flux-2` / `flux-kontext` 分别改成 `flux-2-flex` / `flux-kontext-max`……）。

所以定期跑一次：

```bash
node scripts/gen.mjs --models --live
```

它会告出「清单里有、平台已没有」的 id（**这是唯一真正可行动的漂移信号**；反方向多出来的
绝大多数是 LLM/视频/音频等非生图模型）。有漂移时退出码为 **4**，可以挂到定时任务或 CI 上。

平台新增、但我还没拿到价格的模型，会以 `pricing: 'unknown'` 显式标注，`--models` 里显示
**「价格未知」**，生成时也会明确告警 —— 因为**费用上限保护对它们失效**（无法预估费用）。
绝不静默留一个没有价格的条目，这是有测试钉住的不变量。

---

## 网络重试策略（重要）

判断依据是**「重试会不会造成重复扣费」**：

| 请求类型 | 重试范围 |
|---|---|
| `GET`（查任务、查模型，幂等） | 网络错误、429、5xx **全部重试**，指数退避 + 抖动 |
| **`POST`（提交生成，会产生费用）** | **只重试"确定没送达"的错误**：`ECONNREFUSED` / `ENOTFOUND` / `EAI_AGAIN` / `ENETUNREACH` / 连接超时，以及 `429`（服务端明确未处理）。**`UND_ERR_HEADERS_TIMEOUT` / `UND_ERR_BODY_TIMEOUT` / `ECONNRESET` 一律不重试** —— 请求可能已被处理，重试有重复扣费风险 |

提交时会附带一个 `Idempotency-Key` 头（同一逻辑提交在重试间复用）。平台是否支持该头尚未验证，
但发送无害，且一旦支持即可让重试变得安全。用 `--no-retry` 可完全关闭。

---

## 输出与台账

```
F:\deepseekimagen\                     ← 图片（config.output_dir，默认在仓库外）
└── 2026-10-12\
    ├── 20261012-113710-一只戴眼镜的橘猫-c917cb-01.png
    └── 20261012-113710-一只戴眼镜的橘猫-c917cb-01.png.json   ← sidecar：完整提示词与参数

<技能目录>\data\                       ← 台账（已 gitignore）
├── ledger.csv                         ← 一行一次生成：时间/模型/比例/张数/花费/task_id/文件/提示词哈希
└── sidecar\20261012-113710-c917cb5faca6.json
```

设计要点：

- **图片与台账都在仓库外或已忽略路径**，不会误提交
- **每张图旁边有 sidecar JSON**，所以图片目录是自描述的 —— 三个月后还能查出它是哪个提示词、哪个模型、花了多少
- **格式按魔数判定**，不信平台给的扩展名（实测踩过两次：URL 写 `.png` 实际是 JPEG，反之也有）
- **结果 URL 24 小时过期**，所以脚本是「提交 → 轮询 → 立即下载落盘」，不必担心只存了链接

查看汇总：

```bash
node scripts/gen.mjs --ledger --tail 5
```

---

## 费用保护

- `--dry-run` 先预演，**不花钱**
- 预估超过 `config.max_cost_usd_per_request`（默认 $0.30）会被拒绝，需显式 `--force`
- 按 Token 计费的模型（`gpt-image-*-official` 等）**费用不可预估**，脚本会警告 —— 不建议主动用
- 真实花费以任务返回的 `cost` 字段为准，脚本会记进台账

---

## 配置

`config.json`（从 `config.example.json` 复制，**已 gitignore，永不会进仓**）：

```json
{
  "api_key": "sk-...",
  "base_url": "https://api.apib.ai/v1",
  "proxy": "",
  "output_dir": "F:\\deepseekimagen",
  "ledger_dir": "",
  "default_model": "gpt-image-2.5-ext",
  "default_ratio": "1:1",
  "max_cost_usd_per_request": 0.3
}
```

- **`proxy` 默认留空（直连）** —— 实测 apib.ai 的 `/models` 完整请求：**直连平均 240ms，走代理平均 786ms**
  （约 3.3 倍；代理首次请求还有明显的冷启动开销，1825ms → 之后约 440ms）。
  代理是给「某些被墙站点」用的，不是给这里用的。若确需代理，填 `http://127.0.0.1:7890` 之类；
  脚本会用 `NODE_USE_ENV_PROXY` 生效（需 Node ≥ 24），该分支已对真实接口验证可用。
- 环境变量优先级高于配置文件：`APIMART_API_KEY` / `APIMART_BASE_URL` / `APIMART_PROXY` /
  `DEEPSEEKIMAGEN_OUTPUT` / `DEEPSEEKIMAGEN_LEDGER`

---

## 测试与 CI

```bash
node --test      # 52 个测试，零依赖，约 1.5 秒
npm run lint     # 语法检查
```

覆盖的关键行为：

- **重试策略**：写操作「哪些错误能重试、哪些不能」用测试钉死 —— 这直接关系到会不会重复扣费
- **参数别名与友好报错**：`--ar` 归一、`--size` 传像素必须报错
- **图片格式与尺寸**：PNG / JPEG / WebP 的魔数与宽高解析（不依赖任何图像库）
- **台账**：CSV 转义（提示词含逗号/引号/换行）、失败任务留痕、按模型汇总
- **配置**：文件 → 环境变量覆盖、相对路径解析、代理开关、缺 Key 时的友好报错

`.github/workflows/ci.yml` 在每次 push 时跑：**ubuntu 20/22/24 加 windows 24 四档**、语法检查、
CLI 冒烟、参数别名回归、**密钥扫描**（含「`config.json` 绝不被追踪」「无运行数据入库」
「无编辑器临时文件入库」的硬校验）。

> 说明：CI 只覆盖**第一步（API）**。本地 ComfyUI 那条路依赖本机 GPU 与数十 GB 模型文件，
> GitHub 的 runner 上没有，天然无法在那里验证。

### 维护 CI 时注意（真实踩过的坑）

1. **测试不能有平台假设**。曾经把 `output_dir` 写死成 `F:\deepseekimagen`，
   而在 POSIX 上 `path.posix.isAbsolute('F:\...')` 是 `false`，测试在 Linux 上必挂 ——
   **在 Windows 本地永远测不出来**，这就是加 windows/ubuntu 双平台矩阵的原因。
2. **GitHub 用 `bash -e -o pipefail`**。检查"预期失败"的命令时**不要让它直接进管道**：
   `if node <会失败> | grep -q X; then` 里 pipefail 会让整条管道取到失败码，
   即使 grep 匹配成功也走 else。要用 `out=$(cmd 2>&1 || true)` 再判断。
3. **别用正则往 YAML 里插代码**。用脚本替换生成的 YAML 很容易把引号/换行搞坏，
   而坏掉的 workflow 只会在下一次 push 时才暴露。

---

## 排错

先跑 `--check`。常见问题与完整坑表见 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)。

---

## 它是怎么跑起来的（技术要点）

APIMart 的图像/视频生成是**异步任务制**，不是 OpenAI 那种同步返回：

```
① POST /v1/images/generations   {model, prompt, n, size}      ← size 是比例，不是像素
   → {"code":200,"data":[{"status":"submitted","task_id":"task_..."}]}

② GET  /v1/tasks/{task_id}                                     ← 轮询
   → {"status":"completed","cost":0.0085,"result":{"images":[{"url":["https://..."]}]}}
   （Midjourney 走专用端点 POST /v1/midjourney/generations，一次返回 4 个 URL）

③ 下载 URL → 按魔数判格式 → 落盘
```

---

## License

MIT
