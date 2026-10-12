// 台账测试：一次生成一行、失败也留痕、汇总正确
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ledgerPaths, readLedger, record, summarize } from '../src/ledger.mjs';

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'dimg-ledger-'));
  return { dir: d, cleanup: () => rmSync(d, { recursive: true, force: true }) };
}

test('首次写入会建表头，内容可读回', () => {
  const t = tmp();
  try {
    record(t.dir, {
      model: 'gpt-image-2.5-ext', ratio: '1:1', images: 1, costUsd: 0.0085, credits: 0.085,
      taskId: 'task_a', format: 'png', bytes: 1234, file: 'C:/x/a.png', prompt: 'a red apple',
    });
    const rows = readLedger(t.dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].model, 'gpt-image-2.5-ext');
    assert.equal(rows[0].cost_usd, '0.0085');
    assert.equal(rows[0].task_id, 'task_a');
    assert.equal(rows[0].prompt_head, 'a red apple');
    const csv = readFileSync(ledgerPaths(t.dir).csv, 'utf8');
    assert.match(csv.split('\n')[0], /^time,model,ratio,images,cost_usd/);
  } finally { t.cleanup(); }
});

test('失败任务也能留痕（images=0、空文件字段不炸）', () => {
  const t = tmp();
  try {
    record(t.dir, {
      model: 'gpt-image-2.5-ext', ratio: '9:16', images: 0, costUsd: 0, credits: null,
      taskId: 'task_fail', format: '', bytes: 0, file: '', prompt: 'rejected prompt',
    }, { sidecarExtra: { failed: true, status: 'failed', detail: { code: 'task_failed' } } });
    const rows = readLedger(t.dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].images, '0');
    assert.equal(rows[0].file, '');
    assert.equal(rows[0].format, '');
  } finally { t.cleanup(); }
});

test('提示词含逗号/引号/换行时 CSV 仍可正确解析', () => {
  const t = tmp();
  try {
    const tricky = 'a "quoted", comma\nand newline 中文';
    record(t.dir, {
      model: 'midjourney', ratio: null, images: 4, costUsd: 0.04504, credits: 0.45,
      taskId: 'task_q', format: 'png', bytes: 1, file: 'C:/x/b.png', prompt: tricky,
    });
    const rows = readLedger(t.dir);
    assert.equal(rows.length, 1, '含换行的字段不应被拆成两行');
    assert.equal(rows[0].model, 'midjourney');
  } finally { t.cleanup(); }
});

test('sidecar 里保存完整提示词（图片目录自描述）', () => {
  const t = tmp();
  try {
    const full = 'x'.repeat(2000);
    const { sidecar } = record(t.dir, {
      model: 'm', ratio: '1:1', images: 1, costUsd: 0, taskId: 'task_s',
      format: 'png', bytes: 1, file: 'C:/x/c.png', prompt: full,
    });
    const meta = JSON.parse(readFileSync(sidecar, 'utf8'));
    assert.equal(meta.prompt, full, 'sidecar 应保存未被截断的提示词');
    assert.equal(meta.prompt.length, 2000);
  } finally { t.cleanup(); }
});

test('summarize 按模型汇总次数/张数/花费', () => {
  const t = tmp();
  try {
    record(t.dir, { model: 'a', ratio: '1:1', images: 1, costUsd: 0.01, taskId: 't1', format: 'png', bytes: 1, file: 'f1', prompt: 'p1' });
    record(t.dir, { model: 'a', ratio: '1:1', images: 2, costUsd: 0.02, taskId: 't2', format: 'png', bytes: 1, file: 'f2', prompt: 'p2' });
    record(t.dir, { model: 'b', ratio: '1:1', images: 4, costUsd: 0.05, taskId: 't3', format: 'png', bytes: 1, file: 'f3', prompt: 'p3' });
    const s = summarize(t.dir);
    assert.equal(s.rows.length, 3);
    assert.equal(s.images, 7);
    assert.ok(Math.abs(s.total - 0.08) < 1e-9);
    assert.equal(s.byModel.get('a').n, 2);
    assert.equal(s.byModel.get('a').images, 3);
    assert.equal(s.byModel.get('b').usd, 0.05);
  } finally { t.cleanup(); }
});

test('空台账不报错', () => {
  const t = tmp();
  try {
    assert.deepEqual(readLedger(t.dir), []);
    const s = summarize(t.dir);
    assert.equal(s.rows.length, 0);
    assert.equal(s.total, 0);
  } finally { t.cleanup(); }
});

// ── 回归：曾经因为只判断 `if (entry.file)`，相对路径会被按 CWD 解析，
//    把 f1.json 之类写进仓库根目录并被 git 提交。────────────────────
test('相对路径的 file 不会把 sidecar 写进当前工作目录', () => {
  const t = tmp();
  const probe = join(process.cwd(), 'f1.json');
  rmSync(probe, { force: true });
  try {
    record(t.dir, {
      model: 'a', ratio: '1:1', images: 1, costUsd: 0.01, credits: null,
      taskId: 't1', format: 'png', bytes: 1, file: 'f1', prompt: 'p1',
    });
    assert.equal(existsSync(probe), false, '相对路径不应在当前工作目录留下 sidecar');
  } finally {
    rmSync(probe, { force: true });
    t.cleanup();
  }
});

test('绝对路径的 file 会在图片旁写 sidecar（图片目录自描述）', () => {
  const t = tmp();
  try {
    const outDir = join(t.dir, 'out');
    mkdirSync(outDir, { recursive: true });
    const img = join(outDir, 'x.png');
    writeFileSync(img, 'fake');
    record(t.dir, {
      model: 'a', ratio: '1:1', images: 1, costUsd: 0.01, credits: null,
      taskId: 't2', format: 'png', bytes: 1, file: img, prompt: '完整提示词',
    });
    assert.ok(existsSync(`${img}.json`), '绝对路径应在图旁写 sidecar');
    const meta = JSON.parse(readFileSync(`${img}.json`, 'utf8'));
    assert.equal(meta.prompt, '完整提示词');
  } finally { t.cleanup(); }
});
