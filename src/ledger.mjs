// 台账：每次生成记一行 CSV + 每张图一个 sidecar JSON
// 目的：三个月后还能知道 a3f9.png 是哪个提示词、哪个模型、花了多少钱生成的
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { ensureDir, shortHash, tsCompact } from './util.mjs';

const HEADER = [
  'time', 'model', 'ratio', 'images', 'cost_usd', 'credits',
  'task_id', 'format', 'bytes', 'file', 'prompt_sha1', 'prompt_head',
].join(',');

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ledgerPaths(ledgerDir) {
  return {
    dir: ledgerDir,
    csv: join(ledgerDir, 'ledger.csv'),
    sidecarDir: join(ledgerDir, 'sidecar'),
  };
}

/**
 * 记录一次生成。entry:
 *  { model, ratio, images, costUsd, credits, taskId, format, bytes, file, prompt, sidecar }
 */
export function record(ledgerDir, entry, { sidecarExtra = {} } = {}) {
  const { csv, sidecarDir } = ledgerPaths(ledgerDir);
  ensureDir(ledgerDir);
  if (!existsSync(csv)) writeFileSync(csv, HEADER + '\n', 'utf8');

  const prompt = String(entry.prompt ?? '');
  const sha = shortHash(prompt, 12);
  const head = prompt.replace(/\s+/g, ' ').slice(0, 80);

  const row = [
    new Date().toISOString(), entry.model, entry.ratio ?? '', entry.images ?? 1,
    entry.costUsd ?? '', entry.credits ?? '', entry.taskId ?? '',
    entry.format ?? '', entry.bytes ?? '', entry.file ?? '', sha, head,
  ].map(csvCell).join(',');
  appendFileSync(csv, row + '\n', 'utf8');

  // sidecar：完整提示词与参数，放在图旁边也放一份（图目录自描述）
  const meta = {
    time: new Date().toISOString(),
    model: entry.model,
    ratio: entry.ratio ?? null,
    images: entry.images ?? 1,
    cost_usd: entry.costUsd ?? null,
    credits: entry.credits ?? null,
    task_id: entry.taskId ?? null,
    file: entry.file ?? null,
    format: entry.format ?? null,
    bytes: entry.bytes ?? null,
    prompt_sha1: sha,
    prompt,
    ...sidecarExtra,
  };
  ensureDir(sidecarDir);
  const sideName = `${tsCompact()}-${sha}.json`;
  const sidePath = join(sidecarDir, sideName);
  writeFileSync(sidePath, JSON.stringify(meta, null, 2), 'utf8');

  // 在图片旁再写一份 sidecar，让图片目录自描述。
  // 教训：只在 file 是**绝对路径**时才写。曾经这里只判断 `if (entry.file)`，
  // 于是调用方传相对路径（例如单测里的 'f1'）时会按 CWD 解析，
  // 把 f1.json 写进当前工作目录 —— 结果在仓库根目录留下了 f1/f2/f3.json 并被提交。
  if (entry.file && isAbsolute(String(entry.file))) {
    try {
      writeFileSync(`${entry.file}.json`, JSON.stringify(meta, null, 2), 'utf8');
    } catch { /* 图目录不可写就算了，台账还在 */ }
  }

  return { csv, sidecar: sidePath, sha };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function readLedger(ledgerDir) {
  const { csv } = ledgerPaths(ledgerDir);
  if (!existsSync(csv)) return [];
  const lines = readFileSync(csv, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = parseCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

export function summarize(ledgerDir, { tail = 0 } = {}) {
  const rows = readLedger(ledgerDir);
  const byModel = new Map();
  let total = 0;
  let images = 0;
  for (const r of rows) {
    const cost = Number(r.cost_usd || 0);
    total += cost;
    images += Number(r.images || 0);
    const cur = byModel.get(r.model) || { n: 0, usd: 0, images: 0 };
    cur.n++;
    cur.usd += cost;
    cur.images += Number(r.images || 0);
    byModel.set(r.model, cur);
  }
  return { rows, total, images, byModel, recent: tail > 0 ? rows.slice(-tail) : [] };
}
