# deepseekimagen

用 [APIMart](https://apib.ai)（apib.ai）聚合 API **生图**的命令行工具，同时是一个可直接挂给 AI Agent 的 **Skill**。
零依赖（只用 Node 内置模块），自动落盘、自动记账。

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
| `--out <目录>` | 覆盖输出目录 |
| `--images <n>` | 张数（Midjourney 固定 4 张，忽略此项） |
| `--version <v>` | Midjourney 版本（如 `6.1` / `7`） |
| `--dry-run` | 只预演：打印模型/比例/张数/预估费用，**不提交、不花钱** |
| `--force` | 跳过单次费用上限保护 |
| `--json` | 以 JSON 输出结果 |
| `--config <路径>` | 指定配置文件 |

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

- **`proxy` 默认留空（直连）** —— 实测 apib.ai 直连 0.33s、走代理 1.5s，直连快约 3 倍。
  若你的网络确实需要代理，填 `http://127.0.0.1:7890` 之类；脚本会用 `NODE_USE_ENV_PROXY` 生效（需 Node ≥ 24）。
- 环境变量优先级高于配置文件：`APIMART_API_KEY` / `APIMART_BASE_URL` / `APIMART_PROXY` /
  `DEEPSEEKIMAGEN_OUTPUT` / `DEEPSEEKIMAGEN_LEDGER`

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
