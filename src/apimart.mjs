// APIMart(apib.ai) 客户端：异步任务制
//   图像：POST /images/generations  → {data:[{task_id}]}
//   提交后轮询 GET /tasks/{id}      → data.result.images[0].url = URL 数组
//   MJ：  POST /midjourney/generations → 同上，但一次出 4 张
// 零依赖：只用 Node 内置 fetch（>=18）。需要代理时由 config.mjs 设置 NODE_USE_ENV_PROXY。
import { detectFormat, sleep, c } from './util.mjs';

const DONE = new Set(['completed', 'succeeded', 'success']);
const FAIL = new Set(['failed', 'error', 'cancelled', 'canceled']);

export class ApimartError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class Apimart {
  constructor({ apiKey, baseUrl, pollIntervalMs = 3000, pollTimeoutMs = 300000, verbose = false }) {
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.pollIntervalMs = pollIntervalMs;
    this.pollTimeoutMs = pollTimeoutMs;
    this.verbose = verbose;
  }

  async #req(path, { method = 'GET', body, timeoutMs = 120000 } = {}) {
    const url = `${this.baseUrl}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
      if (!res.ok) {
        const msg = json?.error?.message || json?.message || text?.slice(0, 300) || res.statusText;
        throw new ApimartError(`HTTP ${res.status}: ${msg}`, { status: res.status, body: json ?? text });
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 提交图像任务。size 传比例；模型不支持 size 时自动省略。 */
  async submitImage({ model, prompt, ratio, n = 1 }) {
    const body = { model, prompt, n };
    if (ratio) body.size = ratio;
    const json = await this.#req('/images/generations', { method: 'POST', body });
    const item = json?.data?.[0] || json?.data || json;
    const taskId = item?.task_id || item?.id;
    if (!taskId) throw new ApimartError(`提交后没拿到 task_id，原始响应：${JSON.stringify(json).slice(0, 300)}`);
    return { taskId, raw: json };
  }

  /** 提交 Midjourney imagine 任务（专用端点，不需要 model 字段，但传了也不报错） */
  async submitMidjourney({ model = 'midjourney', prompt, ratio, version }) {
    const body = { model, prompt };
    if (ratio) body.size = ratio;
    if (version) body.version = version;
    const json = await this.#req('/midjourney/generations', { method: 'POST', body });
    const item = json?.data?.[0] || json?.data || json;
    const taskId = item?.task_id || item?.id;
    if (!taskId) throw new ApimartError(`提交后没拿到 task_id，原始响应：${JSON.stringify(json).slice(0, 300)}`);
    return { taskId, raw: json };
  }

  /** 连通性 + 鉴权探测：GET /models 需要有效 Bearer */
  async listModels() {
    return this.#req('/models');
  }

  async getTask(taskId) {
    return this.#req(`/tasks/${encodeURIComponent(taskId)}`);
  }

  /** MJ 专用查询：拿到九宫格 + 4 切片 + 可交互按钮 */
  async getMidjourney(taskId) {
    return this.#req(`/midjourney/${encodeURIComponent(taskId)}`);
  }

  /** 轮询直到终态；返回 { status, cost, urls, data } */
  async poll(taskId, { onTick } = {}) {
    const t0 = Date.now();
    for (;;) {
      const json = await this.getTask(taskId);
      const d = json?.data ?? json;
      const status = d?.status ?? 'unknown';
      if (onTick) onTick({ status, progress: d?.progress, elapsedMs: Date.now() - t0 });
      else if (this.verbose) {
        process.stderr.write(`\r  ${c.dim(`状态 ${status} 进度 ${d?.progress ?? '?'} ${Math.round((Date.now() - t0) / 1000)}s`)}   `);
      }

      if (DONE.has(status)) {
        if (!this.verbose && !onTick) process.stderr.write('\r' + ' '.repeat(60) + '\r');
        return { status, cost: d?.cost ?? null, credits: d?.credits_cost ?? null, urls: extractUrls(d), data: d };
      }
      if (FAIL.has(status)) {
        if (!this.verbose && !onTick) process.stderr.write('\r' + ' '.repeat(60) + '\r');
        return { status, cost: d?.cost ?? 0, urls: [], data: d };
      }
      if (Date.now() - t0 > this.pollTimeoutMs) {
        throw new ApimartError(`轮询超时（${this.pollTimeoutMs}ms），task_id=${taskId} 仍在 ${status}`);
      }
      await sleep(this.pollIntervalMs);
    }
  }

  /** 下载并返回 { buf, format } —— 扩展名不可信，格式按魔数判定 */
  async download(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 180000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new ApimartError(`下载失败 HTTP ${res.status}: ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { buf, format: detectFormat(buf) };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 从任务 data 里递归收集所有图片 URL（普通模型 1 个、MJ 4 个） */
export function extractUrls(data) {
  const urls = [];
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(v) && !seen.has(v)) {
        seen.add(v);
        urls.push(v);
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.values(v).forEach(walk); }
  };
  walk(data?.result ?? data);
  return urls;
}
