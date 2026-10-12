# 可直接发送的报告（一）：Midjourney `upscale` 计费但返回原图

> 用法：把下面 `---` 之间的正文复制进邮件或工单即可。英文，因为 APIMart 文档是英文。
> 完整技术报告（含原始响应）在 [`2026-10-12-midjourney-upscale-noop.md`](./2026-10-12-midjourney-upscale-noop.md)，可作附件。

---

**Subject:** Bug report — `POST /v1/midjourney/generations/upscale` is billed but returns the original image unchanged (3 reproductions, account guopeng19810729@gmail.com)

Hello,

I'd like to report a reproducible billing/functional bug on the Midjourney upscale endpoint.

**Summary**

`POST /v1/midjourney/generations/upscale` returns HTTP 200, a new `task_id`, `action=UPSCALE`
and `status=SUCCESS`, and is billed normally — but the resulting image is **byte-for-byte identical
to the source tile**, at the **same resolution**. The upscale is not performed; only the charge is.

**Reproductions — 3 independent runs, all billed $0.05504**

| # | Imagine task | Upscale request | Upscale task | Result |
|---|---|---|---|---|
| 1 | `task_01M4Q5GCTRNAHY7X4DDZ42EVY7` (v8.2, 9:16) | `{"task_id":"...","index":4}` | `task_01M4Q5V0A74QK67M3R0J9Q8T1B` | 816×1456, SHA256 `1D4F752F…AC72` — same as source |
| 2 | same | `{"task_id":"...","custom_id":"MJ::JOB::upsample::4::6acc604e08e635c2f32316f0"}` | `task_01M4Q5XXX3NRXDYES82M62FSS1` | identical, same SHA256 |
| 3 | `task_01M4Q61J33TJCNPZQ1JKNFGCZ3` (**v6.1**, 1:1) | `{"task_id":"...","index":1}` | `task_01M4Q65WTTWFDHTPE1HFMT0VT5` | 1024×1024, same SHA256 as tile 1 |

Total billed for these three no-op calls: **$0.16512**.

**Minimal reproduction**

```bash
# 1) imagine
curl -X POST https://api.apib.ai/v1/midjourney/generations \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"prompt":"a single red apple on a white ceramic plate --ar 1:1 --v 6.1"}'
# -> task_id = task_01M4Q61J33TJCNPZQ1JKNFGCZ3

# 2) wait for completed, download the tiles from result.images[0].url

# 3) upscale tile 1
curl -X POST https://api.apib.ai/v1/midjourney/generations/upscale \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"task_id":"task_01M4Q61J33TJCNPZQ1JKNFGCZ3","index":1}'
# -> HTTP 200, new task_id, action=UPSCALE, status=SUCCESS, billed $0.05504

# 4) compare
sha256sum tile1.png upscaled.png     # identical
```

The returned URL is new and distinct from the source URL — only the image content is identical.

**What I ruled out**

* **Not a parameter mistake** — both the documented `index` auto-match and the documented `custom_id`
  bypass produce identical results, and `index` clearly matched the correct tile (it returned tile 4 /
  tile 1 respectively, not a random tile and not an error).
* **Not version-specific** — reproduced on **v6.1** as well as v8.2, with the whole pipeline re-run
  from a fresh imagine.
* **Not a "Midjourney changed the U-button semantics" issue** — even if that were true, output could not
  be byte-identical; byte-identity means the original file was returned unchanged.
* **Not a client/download issue** — PNG magic bytes valid, size and content match the source exactly.

**Billing anomaly**

`midjourney@upscale` is billed at **$0.05504** while `midjourney@imagine` is **$0.04504** — the
non-working action costs more than the working one.

**Requests**

1. Please confirm whether this is a known issue.
2. Please advise whether the three affected calls (**$0.16512**) are eligible for refund or credit.
3. Please confirm whether the other follow-up actions — `variation`, `high-variation`, `low-variation`,
   `reroll`, `zoom`, `pan`, `inpaint` — are verified working, or whether they share this defect.
   I have not tested them and would prefer not to spend against them until upscale is resolved.
4. Suggested hardening on your side: mark the task `FAILURE` (with `fail_reason`) and use the documented
   auto-refund path when the upstream job cannot be executed, rather than reporting `SUCCESS`; and
   optionally assert that the produced asset differs from the source before marking success.

Happy to provide the full raw request/response logs and the downloaded files if useful.

Thank you,
[你的名字]

---

## 发送前的准备（给你的备忘）

- 附件建议：`docs/reports/2026-10-12-midjourney-upscale-noop.md`
- 可附上本地留存的证据：`data/ledger.csv` 里那 3 条 `$0.0550` 记录（含 task_id）
- 建议同时说明你的账号档位（黄金档）与问题首次出现时间（2026-10-12）
