# 示例图溯源

README 里的示例图都是本工具直接产出的原图（为控制仓库体积，这里存的是**等比压缩到宽 640 的 JPEG**，
原图在各自的 `output_dir` 里）。每条都附上**完整提示词**，可直接复现。

> 压缩参数：LANCZOS 重采样 + JPEG q85 + progressive；原始 8.1 MB → 495.8 KB。

## 戏曲女神肖像

![戏曲女神肖像](example-opera.jpg)

| 项 | 值 |
|---|---|
| 模型 | `gpt-image-2.5-ext` |
| 比例 | `9:16` |
| 实际扣费 | $0.0085（台账记录的真实值） |
| task_id | `task_01M4Q5BNAJWM34NF07D67KJY0B` |
| 生成时间 | 2026-10-12T04:20:01.277Z |

完整提示词：

```text
An extraordinarily beautiful young East Asian woman, ethereal Chinese imperial opera goddess, delicate porcelain face, refined facial anatomy, melancholic almond-shaped eyes, subtle smoky eyeliner, soft muted rose lips, cold and distant expression, elaborate monumental Chinese phoenix crown adorned with intricate blue enamel filigree, antique silver ornaments, countless luminous white pearls, sculpted ivory flowers, flowing metallic botanical structures, luxurious traditional Chinese ceremonial robes in ivory white silk, exquisite hand-embroidered peonies in dusty teal blue, muted coral pink and antique gold, cascading pearl necklaces, delicate coral tassels, graceful slender feminine hand resting naturally against embroidered silk, five anatomically accurate fingers, elegant finger proportions, realistic joints, natural perspective, flowing oversized white silk sleeves, long black hair blowing dramatically in the wind, ancient Chinese palace architecture softly blurred in the background, dramatic close-up fashion portrait, slightly low camera angle, sophisticated asymmetrical composition, shallow depth of field, foreground silk softly out of focus, Chinese mysticism meets European Rococo ornamentation, Old Master painting color harmony, cinematic chiaroscuro, cool blue-gray atmosphere, delicate warm highlights, realistic porcelain skin texture, intricate textile details, restrained HDR, photorealistic fine art fashion photography, 85mm portrait lens, f/1.8, extraordinary craftsmanship, museum-quality visual aesthetics, elegant and haunting beauty. Anatomically correct hands with exactly five well-formed fingers, realistic joints and skin texture. Fine-art photographic realism only: no text, no watermark, no cartoon or anime styling, no plastic skin.
```

## 女仆 Cosplay（Midjourney）

![女仆 Cosplay（Midjourney）](example-maid-mj.jpg)

| 项 | 值 |
|---|---|
| 模型 | `midjourney` |
| 比例 | `9:16` |
| 实际扣费 | $0.04504（台账记录的真实值） |
| task_id | `task_01M4Q5GCTRNAHY7X4DDZ42EVY7` |
| 生成时间 | 2026-10-12T04:23:52.653Z |

完整提示词：

```text
An extraordinarily beautiful young East Asian woman, ethereal Chinese imperial opera goddess, delicate porcelain face, refined facial anatomy, melancholic almond-shaped eyes, subtle smoky eyeliner, soft muted rose lips, cold and distant expression, elaborate monumental Chinese phoenix crown adorned with intricate blue enamel filigree, antique silver ornaments, countless luminous white pearls, sculpted ivory flowers, flowing metallic botanical structures, luxurious traditional Chinese ceremonial robes in ivory white silk, exquisite hand-embroidered peonies in dusty teal blue, muted coral pink and antique gold, cascading pearl necklaces, delicate coral tassels, graceful slender feminine hand resting naturally against embroidered silk, five anatomically accurate fingers, elegant finger proportions, realistic joints, natural perspective, flowing oversized white silk sleeves, long black hair blowing dramatically in the wind, ancient Chinese palace architecture softly blurred in the background, dramatic close-up fashion portrait, slightly low camera angle, sophisticated asymmetrical composition, shallow depth of field, foreground silk softly out of focus, Chinese mysticism meets European Rococo ornamentation, Old Master painting color harmony, cinematic chiaroscuro, cool blue-gray atmosphere, delicate warm highlights, realistic porcelain skin texture, intricate textile details, restrained HDR, photorealistic fine art fashion photography, 85mm portrait lens, f/1.8, extraordinary craftsmanship, museum-quality visual aesthetics, elegant and haunting beauty --stylize 250 --chaos 8 --no extra fingers, fused fingers, malformed hands, distorted anatomy, plastic skin, cartoon, anime, text, watermark
```

## 橘猫测试图

![橘猫测试图](example-cat.jpg)

| 项 | 值 |
|---|---|
| 模型 | `gpt-image-2.5-ext` |
| 比例 | `1:1` |
| 实际扣费 | $0.0085（台账记录的真实值） |
| task_id | `task_01M4Q2X20RS8SE195K3JB0FGEJ` |
| 生成时间 | 2026-10-12T03:37:10.595Z |

完整提示词：

```text
一只戴着圆框眼镜的橘猫，坐在堆满书的木桌上，暖色台灯光从左侧照来，桌面有一杯冒热气的咖啡，写实摄影风格
```

## 女仆 Cosplay（本地 ComfyUI · Qwen-Image 2512）

![女仆 Cosplay（本地）](example-maid-local.jpg)

| 项 | 值 |
|---|---|
| 后端 | 本地 ComfyUI（`http://127.0.0.1:8000`），**未走 API、零费用** |
| 模型 | `qwen_image_2512_fp8_e4m3fn.safetensors` |
| 文本编码器 | `qwen_2.5_vl_7b_fp8_scaled.safetensors`（`type: qwen_image`） |
| VAE | `qwen_image_vae.safetensors` |
| LoRA | `Qwen-Image-Lightning-8steps-V2.0-bf16.safetensors`（strength 1.0） |
| 采样 | euler / simple / **8 步 / cfg 1.0** / denoise 1.0 |
| 尺寸 | 832×1472（约 9:16） |
| 耗时 | 52 秒（含模型首次加载） |

提示词与上面的原始中文版相同。**同一提示词在 z-image-turbo 上只要 15 秒，但指令跟随明显更弱**
（输出坐姿与常规机位，没执行"侧卧 + 广角近摄"的构图要求）。引擎分工结论见 [`../MODELS.md`](../MODELS.md)。

---

## 怎么复现

```bash
# 把上面的提示词存成 UTF-8 文件（中文建议走文件，避开 Windows 命令行编码问题）
node scripts/gen.mjs --prompt-file prompt.txt --ratio 9:16                       # 默认 gpt-image-2.5-ext
node scripts/gen.mjs --prompt-file prompt.txt --model midjourney --version 8.2 --ratio 9:16
```
