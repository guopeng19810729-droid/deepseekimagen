# 可直接发送的报告（二）：内容安全审核拒绝的申诉/咨询

> **状态：已提交。** 2026-10-12 通过 APIMart 工单系统提交，
> 工单号 **`TK-261012-3WYEKTTP`**，关联任务 `task_01M4QAB23JF9AV6EXDD7FXAS66`，状态：待处理。
>
> 注意：APIMart 的工单表单有字段限制（标题 ≤80 字符、详细描述 20~2000 字符、**关联任务必填**），
> 所以实际提交的是**压缩后的中文版**，并非下面这份较长的英文稿。
> 压缩版留档在 `F:\deepseekwork\APIMart-工单-待提交.txt`。
>
> 下面的英文稿保留作参考 —— 若需要转发给上游模型厂商，用它更合适。

> 用法：把下面 `---` 之间的正文复制进邮件或工单。英文。
> 这份是**咨询 + 申诉**，不是 bug 报告 —— 目的是问清口径、看看有没有复核通道。

---

**Subject:** Question about content safety review rejections — request for guidance or manual review (3 rejections, account guopeng19810729@gmail.com)

Hello,

I'd like to ask about the content safety review on image generation, because I'm getting rejections on
a prompt that I believe is a normal fashion/cosplay portrait, and I'd like to understand the boundary
and whether there is a review or appeal process.

**What happens**

The submit call returns HTTP 200 with a `task_id` as usual, and then the task fails during polling:

```json
{"code":"task_failed",
 "message":"Your request did not pass content safety review. Please adjust your prompt or input files and try again.",
 "type":"task_failed"}
```

(No charge is applied — I confirmed that, thank you.)

**What I submitted — 3 attempts, 3 rejections**

All three describe the same thing: **one fully clothed adult woman in a black-and-white French maid
cosplay outfit, photographed sitting/reclining on a deep burgundy velvet antique armchair in a dim
vintage interior**, vertical 9:16, in a 2000s–2010s Japanese cosplay-photography style. The prompt
explicitly asks for normal full clothing coverage and lists things to avoid (no nudity, no bare legs,
no fishnets, no suggestive content).

| # | Task ID | Prompt language | Notes |
|---|---|---|---|
| 1 | `task_01M4QAAFZNCR8EG87PWW18SM9E` | English | my own structured rewrite of the brief |
| 2 | `task_01M4QAB23JF9AV6EXDD7FXAS66` | **Chinese** | the user's original brief, submitted verbatim |
| 3 | `task_01M4QAHFX1TWFMW9CH3NTNYH14` | English | **softened version**: opaque over-the-knee socks instead of semi-sheer, standard three-quarter camera instead of a low leg-level angle, neutral closed-mouth expression, no age wording |

**Why I'm asking**

* Both the English and the original Chinese version were rejected, so this is not a translation or
  phrasing issue on my side.
* The softened version (#3) removed every element I could think of that might read as suggestive —
  sheer hosiery, the low camera angle at the legs, the parted-lip/lazy expression, the explicit
  age clarification — and it was **still** rejected. At that point I could not tell what the system
  is objecting to, and I don't want to keep probing the boundary by trial and error.
* I understand the content is a "maid cosplay" portrait, and I appreciate that that costume genre
  may carry associations in training data. My intent is a costume/fashion portrait, not adult content.

**Requests**

1. Is there any way to get the specific reason, or a **manual review / appeal** for a rejected task?
2. If the maid-costume genre itself is disallowed on this platform, could you say so explicitly?
   I'd rather know the rule than guess, and I'll simply change the brief.
3. Are there any documented prompt guidelines for cosplay/fashion/portrait photography
   (what's allowed regarding hosiery, camera angle, reclining poses)? Even a short note would help.
4. Is the review done by your side or passed through from the upstream model provider? If it's the
   latter, is there a provider whose policy differs that you can route portrait work to?

I'm not asking to bypass any policy — I'd like to understand it, and if the answer is "this genre
is not supported", that's a perfectly fine answer and I'll adjust.

Thank you,
[你的名字]

---

## 发送前的准备（给你的备忘）

- 三个 task_id 已列在表里，方便对方直接查日志
- 如果你手上有被拒那张的**参考图或同类合规案例**，附上会更有说服力
- 建议明确写一句：**「我不要求绕过审核，只想了解规则」** —— 这能显著提高得到实质回复的概率
  （正文里已经有了，保留它）
- 如果对方明确回复"该题材不支持"，我们就在第一步的路由规则里写明：人像/服装类走哪条路
