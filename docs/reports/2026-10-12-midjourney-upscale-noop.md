# Bug report — `POST /v1/midjourney/generations/upscale` is billed but returns the original image unchanged

**Reported:** 2026-10-12
**Reporter:** API user (Gold tier), account `guopeng19810729@gmail.com`
**Endpoint:** `https://api.apib.ai/v1/midjourney/generations/upscale`
**Severity:** High — silent paid no-op, affects every upscale call until fixed

---

## Summary

`POST /v1/midjourney/generations/upscale` returns `HTTP 200`, a new `task_id`, `action=UPSCALE`,
`status=SUCCESS` (and `SUCCESS` from `GET /v1/tasks/{id}`), and **is billed normally** —
but the resulting image is **byte-for-byte identical to the source tile**, with the **same resolution**.
The upscale is not performed; only the charge is.

Reproduced **3 times** across two Midjourney versions and both documented parameter styles
(`index` auto-matching and explicit `custom_id`).

---

## Impact

* Users pay `$0.05504` per upscale call and receive no new asset.
* The failure is **silent**: every status field reports success, so client code cannot detect it
  without hashing input and output.
* Note that `upscale` costs **more** than `imagine` (`$0.05504` vs `$0.04504`) while producing nothing.
* Any downstream workflow that assumes `success ⇒ new image` will silently publish/service the original.

---

## Environment

| Item | Value |
|---|---|
| Base URL | `https://api.apib.ai/v1` |
| Model | `midjourney` |
| Imagine endpoint | `POST /v1/midjourney/generations` |
| Upscale endpoint | `POST /v1/midjourney/generations/upscale` |
| Query endpoints | `GET /v1/tasks/{task_id}`, `GET /v1/midjourney/{task_id}` |
| Auth | `Authorization: Bearer <token>` |

---

## Reproduction (minimal)

### 1. Submit an Imagine job

```bash
curl -X POST https://api.apib.ai/v1/midjourney/generations \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a single red apple on a white ceramic plate, soft morning light, minimalist photorealistic food photography --ar 1:1 --v 6.1"}'
# -> {"code":200,"data":[{"status":"submitted","task_id":"task_01M4Q61J33TJCNPZQ1JKNFGCZ3"}]}
```

### 2. Wait for `completed`, then download the tiles

```bash
curl -H "Authorization: Bearer $KEY" https://api.apib.ai/v1/tasks/task_01M4Q61J33TJCNPZQ1JKNFGCZ3
# -> result.images[0].url = [4 tile URLs]
```

### 3. Call upscale on tile 1

```bash
curl -X POST https://api.apib.ai/v1/midjourney/generations/upscale \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"task_id":"task_01M4Q61J33TJCNPZQ1JKNFGCZ3","index":1}'
# -> {"code":200,"data":[{"status":"submitted","task_id":"task_01M4Q65WTTWFDHTPE1HFMT0VT5"}]}
```

### 4. Compare hashes

```bash
sha256sum tile1.png upscaled.png
# Expected: different hashes, larger dimensions
# Actual:   identical hashes, identical dimensions
```

---

## Evidence — 3 independent runs

| # | Imagine | Params sent | Upscale task | Billed | Source | Upscale output | Same bytes? |
|---|---|---|---|---|---|---|---|
| 1 | v8.2, 9:16, `task_01M4Q5GCTRNAHY7X4DDZ42EVY7` | `{"task_id":"...","index":4}` | `task_01M4Q5V0A74QK67M3R0J9Q8T1B` | $0.05504 | 816×1456, `SHA256 1D4F752F799014A0EAAB46D9C001AA32ADAAD816DFD5EDC582782E3795E9AC72` | 816×1456, same SHA256 | **YES** |
| 2 | same imagine | `{"task_id":"...","custom_id":"MJ::JOB::upsample::4::6acc604e08e635c2f32316f0"}` | `task_01M4Q5XXX3NRXDYES82M62FSS1` | $0.05504 | (above) | 816×1456, same SHA256 | **YES** |
| 3 | **v6.1, 1:1**, `task_01M4Q61J33TJCNPZQ1JKNFGCZ3` | `{"task_id":"...","index":1}` | `task_01M4Q65WTTWFDHTPE1HFMT0VT5` | $0.05504 | 1024×1024, `SHA256 308400F4E594F76B2F8C8792...` | 1024×1024, same SHA256 | **YES** |

Every run returned `action=UPSCALE` and `status=SUCCESS` / `completed`.

In run 3 the upscaled output was hashed against **all four** source tiles — it matched tile 1 exactly
and none of the others, confirming the service re-served the requested source file.

**Total billed for these three no-op calls: $0.16512.**

### Raw responses (run 1)

Submit:

```json
{"code":200,"data":[{"status":"submitted","task_id":"task_01M4Q5V0A74QK67M3R0J9Q8T1B"}]}
```

Query `GET /v1/midjourney/task_01M4Q5V0A74QK67M3R0J9Q8T1B`:

```json
{"action":"UPSCALE","status":"SUCCESS","progress":"100%",
 "image_urls":["https://getapib.org/image/9998208220753303-d4167355-c601-4677-92a2-9ed48bf7f452-image_task_01M4Q5V0A74QK67M3R0J9Q8T1B_0.png"],
 "buttons":[...]}
```

Note: the returned URL is **new and distinct** from the source URL — only the image *content* is identical.

Query `GET /v1/tasks/task_01M4Q5V0A74QK67M3R0J9Q8T1B`:

```json
{"status":"completed","cost":0.05504,"credits_cost":0.5504,"progress":100,"actual_time":6}
```

---

## What we ruled out

| Hypothesis | Verdict | Why |
|---|---|---|
| Wrong parameter name | **Ruled out** | Both the documented `index` auto-match and the documented `custom_id` bypass produce identical results. `index` clearly matched correctly — it returned tile 4 / tile 1 respectively, not a random tile or an error. |
| Version-specific (v8.2 only) | **Ruled out** | Reproduced on **v6.1** as well (run 3), with the whole pipeline re-run from a fresh Imagine. |
| Midjourney changed "U" semantics in newer versions | **Ruled out** | Even if MJ's U button semantics changed, output could not be **byte-identical**. Byte-identity means the original file was returned unchanged. |
| Our download/client issue | **Ruled out** | Files were fetched from the returned URL; PNG magic bytes valid; the response's own size and content match the source exactly. |

---

## Additional finding — billing anomaly

| Action | Billed |
|---|---|
| `midjourney@imagine` | $0.04504 |
| `midjourney@upscale` | **$0.05504** |

`upscale` is priced **$0.01 higher** than `imagine` while producing no new asset.
Requesting a review of `midjourney@upscale` pricing/refund handling for affected calls.

---

## Suggested fixes

1. **Make the failure detectable.** If the upstream upscale job cannot be executed, return a failure
   (`status=FAILURE`, `fail_reason`) instead of `SUCCESS`, and apply the documented auto-refund path
   (`quota → 0`).
2. **Verify the artifact changed.** Before marking an upscale task successful, compare the produced
   asset against the source (hash and/or dimensions). If unchanged, treat as failure.
3. **Document the upscale contract.** What resolution/aspect should the output be? Is a
   same-resolution-but-different-render result acceptable? This helps callers assert correctness.
4. If upscale is intentionally a no-op for certain versions, return a clear error such as
   `upscale_not_supported_for_version` rather than billing silently.

---

## Request

* Please confirm whether this is a known/reported issue.
* Please advise whether the three affected calls ($0.16512) are eligible for refund/credit.
* Please confirm whether the other follow-up actions
  (`variation`, `high-variation`, `low-variation`, `reroll`, `zoom`, `pan`, `inpaint`)
  are verified working, or whether they share the same defect — we have **not** tested them
  and are currently unwilling to spend against them until upscale is resolved.

---

## Notes for the reporter (not for APIMart)

* Raw artifacts kept locally: source tiles, returned upscale files (deleted after hashing),
  and the ledger at `data/ledger.csv`.
* Related internal doc: [`../TROUBLESHOOTING.md`](../TROUBLESHOOTING.md) section 三.9.
* The general lesson recorded there: **an async task reporting success does not mean work was done** —
  any paid post-processing action should be checked with an input/output equivalence test.
