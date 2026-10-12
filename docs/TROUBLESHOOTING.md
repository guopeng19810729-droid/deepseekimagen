# 排错与踩坑记录

本文所有条目都是**实测踩出来的**，不是推测。

---

## 一、先跑自检

```bash
node scripts/gen.mjs --check
```

它会逐项报告：Node 版本、配置文件位置、密钥是否就绪、API 连通与鉴权、输出/台账目录可写性。

---

## 二、错误对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| `401 unauthorized` / `API 鉴权失败` | 密钥错、没填、或已撤销 | 填 `config.json` 的 `api_key`，或用 `APIMART_API_KEY` 环境变量 |
| `403 forbidden` | 边缘规则或权限 | 见下文「UA 被拦」 |
| `size must be auto or one of 1:1, 16:9, ...` | 传了像素值 | 改传**比例**（`--ratio 1:1`） |
| `parameter "size" is not supported for asynchronous xAI image tasks` | 该模型不收 `size` | 省略 `--ratio`（如 `grok-imagine-*`） |
| `unsupported image aspect ratio "1024:1024"` | Gemini 系只认比例 | 改 `--ratio 1:1` |
| `model_price_error: ratio or price is not configured` | 该模型平台没开价 | 换模型（316 个里不是每个可用） |
| 提交成功但任务 `failed` | 该模型/参数不可用 | 换模型或换参数。注意失败的**不一定扣费**（实测 `imagen-4.0-apimart` 失败时 cost=0） |
| 任务长时间 `pending`/`processing` | 排队或模型慢 | 脚本轮询到 `poll_timeout_ms`（默认 5 分钟）。`gpt-image-2.5-ext` 实测约 60 秒 |
| 图片 URL 打不开 | **平台结果 URL 24 小时过期** | 脚本已即时下载落盘；**不要只保存 URL** |
| 中文变乱码 | 命令行传中文的编码问题 | 用 `--prompt-file`（脚本用 UTF-8 读取） |
| `Invalid task ID.` | 查询任务时 id 格式不对 | 正常现象，不需要管（自检里用它探测连通性） |

---

## 三、平台行为上的坑（写代码时会撞）

### 1. 异步任务制，不是同步返回

```
① POST /v1/images/generations  {model, prompt, n, size}
   → {"code":200,"data":[{"status":"submitted","task_id":"task_..."}]}
② GET  /v1/tasks/{task_id}     轮询到 status=completed
   → {"status":"completed","cost":0.0085,"result":{"images":[{"url":["https://..."]}]}}
③ 下载 url
```

按 OpenAI 同步接口的直觉写会拿不到图。**Midjourney 还要换个端点**（`/v1/midjourney/generations`）。

### 2. 结果 URL 24 小时过期（精确验证过）

`expires_at - completed = 86400` 秒，正好 24 小时。**必须即时下载**。

### 3. 扩展名不可信 —— 必须按魔数判

同一个平台上同时存在两种情况：

- URL 以 `.png` 结尾，内容实际是 **JPEG**（`gpt-image-2.5-ext`、`qwen-image-3.0`）
- URL 以 `.png` 结尾，内容确实是 PNG（`grok-imagine-image` 反过来是 JPEG）

**踩过两次**（一次还把 `.jpg` 存成了 PNG 导致图片工具拒绝打开）。
本工具用 `detectFormat()` 按魔数判定：

```
PNG  89 50 4E 47
JPEG FF D8 FF
WebP 52 49 46 46 ... 57 45 42 50
GIF  47 49 46 38
```

### 4. `size` 参数各家不统一

见 `docs/MODELS.md` 第四节。总结：**一律用比例，别用像素**。

### 5. 提交后 `pending` 就能读到 `cost`，但**不能取消**

任务一提交，`GET /v1/tasks/{id}` 就带 `cost` / `credits_cost` 了。
但**没有取消端点**（`DELETE /tasks/{id}`、`POST /tasks/{id}/cancel` 等 6 种写法全部 404），
也**没有估价接口**（试了 7 个路径全 404）。
→ **想拿单价就必须真跑一次并付费。**

### 6. `/v1/models/{id}` 与实际能力不一致

`z-image-turbo` / `deepseek-v4.1-flash` / `wan2.7-image` 在这个端点上报
「does not exist」，**但 `z-image-turbo` 实际能正常出图**。
→ **不能用它校验模型是否存在**，以 `--models` 清单和实测为准。

### 7. `supported_endpoint_types` 字段不可靠

`/v1/models` 的该字段只标了 18 个图像模型，实际有 51 个。

### 8. 提交参数错误会被 400 挡住，且不产生任务

例如 `prompt` 为空 → `400 {"error":{"message":"`prompt` parameter is required..."}}`，
**这类请求不扣费**。所以可以用「故意缺参数的探针」来验证端点存在性而不用花钱。

### 9. ⚠️ Midjourney 的 `upscale` 是**收费空操作**（跨版本实测 3 次，共 $0.16512）

**现象**：调用 `POST /v1/midjourney/generations/upscale` 放大第 4 张切片，
平台返回 `action=UPSCALE`、`status=SUCCESS`、新 task_id、新 URL，并**正常扣费 $0.05504** ——
但下载回来的文件与原图**逐字节完全相同**（SHA256 一致），分辨率也没变。

**实测记录（2026-10-12）**：

| # | imagine 版本 / 比例 | 调用方式 | 结果 | 扣费 | 与原图对比 |
|---|---|---|---|---|---|
| 1 | v8.2 / 9:16 | `{"task_id":"...","index":4}` | SUCCESS | $0.05504 | **SHA256 相同，816×1456 未变** |
| 2 | v8.2 / 9:16 | `{"task_id":"...","custom_id":"MJ::JOB::upsample::4::6acc604e..."}` | SUCCESS | $0.05504 | **SHA256 相同，816×1456 未变** |
| 3 | **v6.1 / 1:1** | `{"task_id":"...","index":1}` | SUCCESS | $0.05504 | **SHA256 相同，1024×1024 未变** |

原始哈希（可作为比对基准）：

* v8.2 原图 ④ 与两次放大输出：`1D4F752F799014A0 EAAB46D9C001AA32 ADAAD816DFD5EDC5 82782E3795E9AC72`
* v6.1 tile1 与放大输出：`308400F4E594F76B...`

**排除了三种可能**：

1. **不是参数用错** —— `index` 的自动匹配显然是成功的（它确实定位到了目标切片，否则应报错），
   而文档建议的 `custom_id` 兜底方式给出**完全相同**的结果。
2. **不是 v8.2 特有** —— 第 3 次用 **v6.1**（1:1）重跑整个链路，放大输出与 tile1 **逐字节相同**。
3. **不是"MJ 新版本 U 键本身就不放大"** —— 即便 MJ 官方改了 U 键语义，
   也不可能连一个字节都不差；逐字节相同只能说明**返回的就是原文件**。

**结论**：provider 端的 `upscale` 动作**全线未实际执行**，但照常计费（且比 imagine 还贵 $0.01）。

**建议**：

* 需要放大时**优先用本地放大器**（Real-ESRGAN / 4x-UltraSharp 等，通常比 MJ 自带 upscale 更能补细节），
  或先 `--dry-run` 确认预算再试。
* 这条**已跨版本验证**（v6.1 与 v8.2，1:1 与 9:16），可以认为当前 provider 全线如此。
  但**不代表其他后续动作同样失效** —— `variation` / `reroll` / `zoom` / `pan` / `inpaint`
  我尚未实测，用之前建议按同样方法验证。

**如何自行校验**（不要只看 HTTP 200 / status=SUCCESS）：

```bash
# 下载放大结果后，与原图比对
certutil -hashfile original.png SHA256
certutil -hashfile upscaled.png SHA256
# 两者一致 => 平台没有真的放大
```

> 教训：**异步任务「成功」不等于「做了事」**。凡是付费的后处理动作，
> 都应该做一次「输出 vs 输入」的等价性检查（哈希或分辨率），否则会为无效操作反复付费。

### 10. 内容安全审核被拒：表现为「任务 failed」而不是 HTTP 错误

**现象**：`POST /images/generations` 返回 `HTTP 200` + `task_id`，一切正常，
但轮询时任务变成 `failed`：

```json
{"code":"task_failed",
 "message":"Your request did not pass content safety review. Please adjust your prompt or input files and try again.",
 "type":"task_failed"}
```

**要点**：

* **不扣费**。实测同一题材连续两次被拒，账户台账金额未变（与文档的「失败自动退款」一致）。
* **提交成功 ≠ 任务会成功**。错误只在轮询阶段暴露，所以客户端必须把 `status=failed`
  当失败处理 —— 只看提交返回的 200 会以为排队成功。
* 触发点是**提示词的组合语义，不是单个词**。实测同一题材的**中文原版与英文改写版都被拒**，
  说明与提示词语言、与措辞优化无关，是题材本身。
* 本工具会把失败任务也写进台账（`images=0`、含 `detail`），便于事后审计。

**写人像/商业摄影类提示词时值得注意**：

* **不要写「明确成年 / clearly adult」这类年龄声明**。这类"澄清"经常被审核当成可疑信号；
  用 `young adult woman` 正常描述即可，不需要额外强调。
* 容易**累积**触发的组合：**贴身衣物 + 强调半透明/透出肤色 + 镜头对着身体局部 +
  卧姿或慵懒表情**。单看每一条都很正常，叠在一起会被判为性暗示。
* 如果目标确实是**时尚/人像摄影**方向的图，把镜头改成常规三分之四人像机位、
  衣物写成不透明材质、去掉「轻微透出肤色」「嘴唇微张」「慵懒」这类描写，通常即可通过。
* 若必须保留原构图，请**调整拍摄简报本身**（换场景、换服装设定、换构图思路），
  而不是逐词试探审核边界 —— 后者既低效，也不该做。

### 11. Midjourney 的提示词长度限制：报错说「1024 字符」，但实测口径不是字符数

**现象**：提交时返回 `HTTP 200` + `task_id`，轮询变成 `failed`：

```
upstream code=9: upstream submit failure: RELAX@...:
提示词过长,目前支持1024以下字符的提示词
(可能与 prompt 过长(3440 字符) 有关,建议精简 prompt 后重试)
```

**实测数据（2026-10-12，MJ 通道 `/v1/midjourney/generations`）**：

| 语言 | 提示词长度 | 额外内容 | 结果 |
|---|---|---|---|
| 英文 | **1,834 字符** | 无 `--no` | ✅ **通过** |
| 英文 | 1,780 字符 | 含 `--stylize --chaos` + 较短 `--no` | ✅ 通过（2026-10-10） |
| 英文 | 3,422 字符 | 含 24 项 `--no` 清单 | ❌ 被拒 |
| 中文 | **829 字符** | 无 | ❌ 被拒（同样报 1024） |
| 中文 | 1,434 字符 | 无 | ❌ 被拒 |

**结论**：

* 报错里的「1024 字符」**与实测不符** —— 1780 和 1834 字符的英文都通过了。
  不要按 1024 去卡，会白白砍掉一半有效提示词。
* **中文被显著"惩罚"**：829 个中文字符就被拒，而 1834 个英文字符能过。
  说明内部口径更接近 **token 或字节**，而不是字符数。**MJ 提示词应优先写英文。**
* **长 `--no` 清单可能是诱因之一**：3422 字符那次带了 24 项 `--no`，
  去掉 `--no` 后 1834 字符通过。
* **可用的经验安全区**：**英文 ≤ ~1800 字符、避免长 `--no` 清单**。
  超了就是免费失败（失败不计费），可以放心试；但别把中文长提示词直接丢给 MJ。
* 失败**不计费**，所以可以用"提交→被拒→缩短→重提"的方式零成本试探边界。

---

## 四、网络相关的坑

### 1. apib.ai **不需要代理**（直连明显更快）

实测（本机，`/models` 完整请求 —— **必须读完全部 body 并多次采样**，单次测量会被进程启动
与代理冷启动严重带偏）：

| 通道 | Node fetch（4 次） | 平均 | curl（3 次） | 平均 |
|---|---|---|---|---|
| **直连** | 390 / 156 / 227 / 185 ms | **240 ms** | 0.99 / 0.86 / 1.15 s | **1.00 s** |
| 走代理 127.0.0.1:29290 | **1825** / 441 / 432 / 445 ms | 786 ms | 2.72 / 2.38 / 2.32 s | 2.47 s |

**直连快约 3.3 倍（Node）/ 2.5 倍（curl）**，所以 `config.proxy` 默认留空。
注意代理**首次请求有冷启动开销**（1825ms，之后降到 ~440ms）—— 只测一次很容易得出错误结论。
代理分支已对真实接口验证可用（直连与代理都能拿到 316 个模型），只是更慢。

⚠️ 但**别的站点可能需要代理** —— 比如 Cloudflare 上的站点在同样环境下直连约 **40% 失败**。
要不要代理取决于**目标站点**，不是全局设置。

### 2. 某些 UA 会被 Cloudflare 边缘拦（403）

实测一组（打同一台 Cloudflare 站点）：

| User-Agent | 结果 |
|---|---|
| `Python-urllib/3.13`、`Python-urllib/3.11` | **403** |
| `libwww-perl/6.67` | **403** |
| `python-urllib/3.13`（首字母小写） | 200 |
| requests / aiohttp / Wget / Go / node-fetch / okhttp / Java / curl / 浏览器 / 空 UA | 200 |

**精确匹配且大小写敏感**，而且发生在**鉴权之前**（连无需鉴权的健康检查都拦）。
用 Python `urllib` 默认 UA 调这类站点会拿到 403 而查不到原因 —— 加一个自定义 UA 即可。

### 3. Node 用代理要显式开启

Node 内置 `fetch` **不读**系统代理设置。要么 Node ≥ 24 用
`NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY=...`（本工具在 `config.proxy` 非空时自动开启），
要么显式配 `ProxyAgent`（需额外依赖）。本工具选了前者，保持零依赖。

---

## 五、PowerShell / Windows 的坑（用命令行操作时）

### 1. 变量名**大小写不敏感** —— 我因为这个得出过假结论

```powershell
$h = Invoke-RestMethod ...   # 本想存结果
$H = @{ Authorization = ... } # 这是同一个变量！headers 被覆盖
```

后果：后续请求全部异常，我还基于错误输出报过「某板块 0 帖」的假结论。
**用 `$hdr` 这类不会撞的名字。**

### 2. `for` 循环的第三段可以省略 —— 漏了就变无限循环

```powershell
for ($i = 1; $i -le 3) { ... }        # ✗ 漏了 $i++，死循环！
foreach ($i in 1..3) { ... }          # ✓ 安全
```

我因此在一轮测试里**误发了 310 篇重复帖**（约 1.7 帖/秒 × 3 分钟），
全部清理掉了，但这个教训值得记：**批量写操作一定用 `foreach` 或带自增的 `for`，并加数量上限。**

### 3. 命令行传中文会乱码

用 `--prompt-file` 写文件再传（UTF-8 无 BOM）：

```powershell
[System.IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding($false)))
```

### 4. `Invoke-RestMethod` 可能对某些大响应体解析失败

报错里 HTTP 状态码是空的（不是 HTTP 错误）。改用 `curl.exe -s` 看原始响应。
本工具用 Node，不受影响。

---

## 六、设计上刻意做的取舍

| 取舍 | 原因 |
|---|---|
| 零依赖（只用 Node 内置） | 降低安装与维护成本；不需要 `npm install` |
| 默认直连、代理可选 | 实测直连快 3 倍；代理是给特定站点用的 |
| 图片默认写到仓库外 | 避免误提交；图片是产物不是源码 |
| 每张图旁边写 sidecar JSON | 图片目录自描述 —— 三个月后还能查出提示词与花费 |
| 台账用 CSV 而非数据库 | 可以直接用 Excel 打开、grep、追加；无并发需求 |
| 格式按魔数判定 | 平台扩展名不可信，实测踩过两次 |
| 一律用比例而非像素 | 平台就是这么设计的（传像素必 400） |
| 用 `process.exitCode` 而不是 `process.exit()` | Windows 上带着未清理的 fetch handle 调 `process.exit()` 会触发 libuv 断言崩溃 |
