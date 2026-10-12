#!/usr/bin/env node
// deepseekimagen CLI
//   dimg --prompt "..." [--ratio 1:1] [--model gpt-image-2.5-ext] [--out DIR] [--images 1] [--json]
//   dimg --prompt-file prompt.txt        # 中文提示词推荐走文件，避免 Windows 命令行编码问题
//   dimg --check | --models | --ledger [--tail 10]
//
// 注意：全程不使用 process.exit()，一律设置 process.exitCode 后自然收尾。
// 原因：在 Windows 上带着未清理的 fetch/undici handle 调 process.exit() 会触发
//       libuv 断言 "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" 并崩溃。
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { loadConfig, requireApiKey, skillRoot } from '../src/config.mjs';
import { Apimart, ApimartError } from '../src/apimart.mjs';
import { DEFAULT_MODEL, MODELS, estimateUsd, isLocalAlternative, listModels, normalizeRatio, resolveModel } from '../src/models.mjs';
import { record, summarize } from '../src/ledger.mjs';
import { CliError, c, die, ensureDir, fmtUsd, imageSize, log, maskKey, sha256Buf, shortHash, slugify, tsCompact, warn } from '../src/util.mjs';
import { parseCliArgs } from '../src/args.mjs';

main().then(
  (code) => { process.exitCode = code ?? 0; },
  (err) => {
    if (err instanceof CliError) {
      console.error(c.red('错误:'), err.message);
      process.exitCode = err.code;
    } else {
      console.error(c.red('未预期错误:'), err?.stack || String(err));
      process.exitCode = 1;
    }
  },
);

async function main() {
  const argv = parseCliArgs(process.argv.slice(2));

  if (argv.help || argv.h) { printHelp(); return 0; }

  const cfg = loadConfig({ configPath: argv.config });

  if (argv.check) return doCheck(argv, cfg);
  if (argv.models) return doModels(argv, cfg);
  if (argv.ledger) return doLedger(argv, cfg);
  if (argv.action) return doAction(argv, cfg);
  return doGenerate(argv, cfg);
}

// ─────────────────────────── 子命令 ───────────────────────────

async function doCheck(argv, cfg) {
  log(c.bold('deepseekimagen 自检'));
  log('');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  ok(`Node ${process.versions.node}`, nodeMajor >= 18);
  if (nodeMajor < 24 && cfg.proxy) warn('配置了 proxy 但 Node < 24，NODE_USE_ENV_PROXY 可能不生效');

  log(`  配置文件   : ${cfg._configPath || c.yellow('未找到（正在用默认值）')}`);
  log(`  base_url   : ${cfg.base_url}`);
  log(`  代理       : ${cfg.proxy || c.dim('（直连，推荐）')}`);
  log(`  默认模型   : ${cfg.default_model}`);
  log(`  输出目录   : ${cfg.output_dir}`);
  log(`  台账目录   : ${cfg.ledger_dir}`);
  log(`  api_key    : ${maskKey(cfg.api_key)}`);
  log('');

  let key;
  try {
    key = requireApiKey(cfg);
  } catch (e) {
    bad('API Key 缺失');
    log('');
    log(e.message);
    return 2;
  }
  ok('API Key 已配置', true);

  for (const [name, dir] of [['输出目录', cfg.output_dir], ['台账目录', cfg.ledger_dir]]) {
    try {
      ensureDir(dir);
      const probe = join(dir, `.write-probe-${Date.now()}`);
      writeFileSync(probe, 'ok');
      rmSync(probe, { force: true });
      ok(`${name}可写 (${dir})`, true);
    } catch (e) {
      ok(`${name}不可写 (${dir}): ${e.message}`, false);
    }
  }

  // 连通性 + 鉴权：GET /models 需要有效 Bearer
  const api = new Apimart(clientOpts(argv, cfg, key));
  try {
    const j = await api.listModels();
    const n = Array.isArray(j?.data) ? j.data.length : null;
    ok(`API 连通且鉴权通过${n != null ? `（返回 ${n} 个模型）` : ''}`, true);
  } catch (e) {
    if (e instanceof ApimartError && e.status === 401) {
      ok('API 鉴权失败（api_key 无效或已撤销）', false);
    } else if (e instanceof ApimartError && e.status === 403) {
      ok(`API 拒绝访问（403）：${e.message}`, false);
    } else {
      ok(`API 不通: ${e.message}`, false);
    }
  }

  log('');
  log(c.dim('提示：账户余额请用 apib.ai 后台查看；本工具只记录自己产生的花费。'));
  return 0;
}

function doModels(argv, cfg) {
  const want = MODELS[cfg.default_model] ? cfg.default_model : DEFAULT_MODEL;
  log(c.bold('可用图像模型（参考价 = apib.ai 黄金档；实际以任务返回的 cost 为准）'));
  log('');
  log(`  ${'模型'.padEnd(24)} ${'参考价'.padEnd(13)} ${'尺寸参数'.padEnd(16)} 说明`);
  log('  ' + '─'.repeat(112));
  for (const m of listModels()) {
    const price = m.pricing === 'token' ? '按Token计' : m.usd != null ? `${fmtUsd(m.usd)}/${m.unit}` : '—';
    const sizes = m.ratios === null ? '不支持size' : m.ratios.includes('auto') ? '比例(auto+10档)' : m.ratios.join('/');
    const tags = [];
    if (m.id === want) tags.push('[默认]');
    if (m.endpoint === 'midjourney') tags.push('[MJ]');
    if (isLocalAlternative(m.id)) tags.push(c.dim('[本地可跑]'));
    log(`  ${m.id.padEnd(24)} ${price.padEnd(13)} ${sizes.padEnd(16)} ${m.note ?? ''} ${tags.join(' ')}`);
  }
  log('');
  log(c.dim('惯例：说"生图"用默认模型；明确说 midjourney / MJ 才走 Midjourney 通道。'));
  log(c.dim('尺寸一律用比例（1:1 / 16:9 / 9:16 ...）；传像素值如 1024x1024 会被 API 拒绝。'));
  return 0;
}

function doLedger(argv, cfg) {
  const s = summarize(cfg.ledger_dir, { tail: Number(argv.tail || 0) });
  log(c.bold('生成台账'));
  log(`  台账文件: ${join(cfg.ledger_dir, 'ledger.csv')}`);
  log(`  总次数  : ${s.rows.length}`);
  log(`  总张数  : ${s.images}`);
  log(`  总花费  : ${fmtUsd(s.total)}`);
  if (s.byModel.size) {
    log('');
    log(`  ${'模型'.padEnd(26)} ${'次数'.padStart(6)} ${'张数'.padStart(6)} ${'花费'.padStart(12)}`);
    log('  ' + '─'.repeat(56));
    for (const [m, v] of [...s.byModel.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
      log(`  ${m.padEnd(26)} ${String(v.n).padStart(6)} ${String(v.images).padStart(6)} ${fmtUsd(v.usd).padStart(12)}`);
    }
  }
  if (s.recent.length) {
    log('');
    log(c.bold('  最近若干条：'));
    for (const r of s.recent) {
      log(`    ${r.time}  ${String(r.model).padEnd(22)} ${fmtUsd(Number(r.cost_usd || 0)).padStart(10)}  ${r.file}`);
    }
  }
  return 0;
}

async function doGenerate(argv, cfg) {
  const prompt = readPrompt(argv);
  if (!prompt) {
    die('没有提示词。用 --prompt "..." 或 --prompt-file <文件>。\n（中文提示词建议用 --prompt-file，可避开 Windows 命令行编码问题）');
  }

  const model = resolveModel(argv.model || cfg.default_model || DEFAULT_MODEL);
  if (!model) die(`未知模型 "${argv.model}"。用 --models 看可用清单。`);

  const spec = MODELS[model];
  const isMJ = spec.endpoint === 'midjourney';
  const ratio = normalizeRatioOrDie(argv.ratio ?? cfg.default_ratio, model);
  const images = isMJ ? 4 : Math.max(1, Number(argv.images || 1));
  if (argv.out) cfg.output_dir = resolve(String(argv.out));
  ensureDir(cfg.output_dir);

  const est = estimateUsd(model, images);
  if (est != null && est > cfg.max_cost_usd_per_request && !argv.force) {
    die(
      `预估费用 ${fmtUsd(est)} 超过上限 ${fmtUsd(cfg.max_cost_usd_per_request)}（config.max_cost_usd_per_request）。\n` +
      '确认要跑就加 --force。',
    );
  }
  if (spec.pricing === 'token') {
    warn(`模型 ${model} 按 Token 计费，费用无法预估，可能显著高于按张模型。`);
  }

  if (argv['dry-run']) {
    log(c.bold('--dry-run 预演（不会提交，不花钱）'));
    log(`  模型   : ${model}${isLocalAlternative(model) ? c.dim('  （本地也能跑，按需选择）') : ''}`);
    log(`  尺寸   : ${ratio ?? '（该模型不接收 size）'}`);
    log(`  张数   : ${images}${isMJ ? c.dim('（MJ imagine 固定 4 张）') : ''}`);
    log(`  预估   : ${est == null ? '不可预估' : fmtUsd(est)}`);
    log(`  提示词 : ${prompt.replace(/\s+/g, ' ').slice(0, 120)}${prompt.length > 120 ? '…' : ''}`);
    log(`  输出   : ${cfg.output_dir}`);
    return 0;
  }

  const key = requireApiKey(cfg);
  const api = new Apimart(clientOpts(argv, cfg, key));

  process.stderr.write(`  提交 ${model} … `);
  let submitted;
  const idem = randomUUID();   // 同一逻辑提交在重试时复用，降低重复扣费风险
  try {
    submitted = isMJ
      ? await api.submitMidjourney({ model, prompt, ratio, version: argv.version, idempotencyKey: idem })
      : await api.submitImage({ model, prompt, ratio, n: images, idempotencyKey: idem });
  } catch (e) {
    process.stderr.write('\n');
    die(`提交失败：${e.message}`);
  }
  process.stderr.write(`task_id=${submitted.taskId}\n`);

  const res = await api.poll(submitted.taskId, {
    onTick: ({ status, progress, elapsedMs }) => {
      process.stderr.write(`\r  ${c.dim(`状态 ${status} 进度 ${progress ?? '?'} ${Math.round(elapsedMs / 1000)}s`)}    `);
    },
  });
  process.stderr.write('\r' + ' '.repeat(72) + '\r');

  if (!res.urls.length) {
    const detail = res.data?.error ?? res.data ?? {};
    // 失败也要留痕（内容安全审核被拒时提交是 200，错误只在轮询阶段暴露）
    record(cfg.ledger_dir, {
      model,
      ratio,
      images: 0,
      costUsd: res.cost ?? 0,
      credits: res.credits ?? null,
      taskId: submitted.taskId,
      format: '',
      bytes: 0,
      file: '',
      prompt,
    }, { sidecarExtra: { failed: true, status: res.status, detail } });
    die(`任务 ${res.status}，没有拿到图片 URL。原始：${JSON.stringify(detail).slice(0, 400)}`);
  }

  const dayDir = join(cfg.output_dir, new Date().toISOString().slice(0, 10));
  ensureDir(dayDir);
  const slug = slugify(prompt.split(/\s+/).slice(0, 6).join('-'));
  const sha = shortHash(prompt, 6);
  const saved = [];
  for (let i = 0; i < res.urls.length; i++) {
    const { buf, format } = await api.download(res.urls[i]);
    const idx = res.urls.length > 1 ? String(i + 1).padStart(2, '0') : '01';
    const file = join(dayDir, `${tsCompact()}-${slug}-${sha}-${idx}.${format}`);
    writeFileSync(file, buf);
    saved.push({ file, format, bytes: buf.length });
  }

  const { sidecar, sha: psha } = record(cfg.ledger_dir, {
    model,
    ratio,
    images: res.urls.length,
    costUsd: res.cost,
    credits: res.credits,
    taskId: submitted.taskId,
    format: saved[0]?.format,
    bytes: saved.reduce((a, s) => a + s.bytes, 0),
    file: saved[0]?.file,
    prompt,
  }, { sidecarExtra: { urls: res.urls, status: res.status, files: saved.map((s) => s.file) } });

  const result = {
    ok: true,
    model,
    ratio: ratio ?? null,
    task_id: submitted.taskId,
    status: res.status,
    cost_usd: res.cost,
    credits: res.credits,
    files: saved.map((s) => s.file),
    format: saved.map((s) => s.format),
    bytes: saved.map((s) => s.bytes),
    ledger: join(cfg.ledger_dir, 'ledger.csv'),
    sidecar,
    prompt_sha1: psha,
  };

  if (argv.json) {
    log(JSON.stringify(result, null, 2));
  } else {
    log('');
    log(`${c.green('完成')}  模型 ${model}  尺寸 ${ratio ?? '—'}`);
    for (const s of saved) {
      log(`  ${c.bold('文件')} ${s.file}  ${c.dim(`(${s.format}, ${(s.bytes / 1024).toFixed(1)} KB)`)}`);
    }
    log(`  ${c.bold('花费')} ${res.cost != null ? fmtUsd(res.cost) : '未知'}${res.credits != null ? c.dim(` (${res.credits} credits)`) : ''}`);
    log(`  ${c.bold('台账')} ${join(cfg.ledger_dir, 'ledger.csv')}`);
    if (res.urls.length > 1) log(c.dim(`  该模型一次出了 ${res.urls.length} 张，已全部保存。`));
  }
  return 0;
}

/**
 * Midjourney 后续动作（upscale / variation / reroll / zoom / pan / inpaint ...）
 * 默认开启 --verify：把输出与源图做哈希+分辨率比对。
 * 若输出与某张源图**逐字节相同**，判定为「付费空操作」，打印告警并返回退出码 3。
 */
async function doAction(argv, cfg) {
  const action = String(argv.action).trim();
  const srcTask = argv.task ? String(argv.task).trim() : '';
  if (!srcTask) {
    die('--action 需要配合 --task <源任务 id>：源任务就是那次 imagine 返回的 task_id。');
  }

  // 已知价格的动作用来做费用闸门；未知价格为 null（不拦，但会提示）
  const KNOWN_ACTION_USD = { upscale: 0.05504 };
  const known = Object.prototype.hasOwnProperty.call(KNOWN_ACTION_USD, action);
  const est = known ? KNOWN_ACTION_USD[action] : null;
  if (est != null && est > cfg.max_cost_usd_per_request && !argv.force) {
    die(`动作 ${action} 预估 ${fmtUsd(est)} 超过上限 ${fmtUsd(cfg.max_cost_usd_per_request)}。确认要跑请加 --force。`);
  }

  const body = { task_id: srcTask };
  if (argv.index !== undefined) body.index = Number(argv.index);
  if (argv.direction) body.direction = String(argv.direction);
  if (argv['zoom-ratio'] !== undefined) body.zoom_ratio = Number(argv['zoom-ratio']);
  if (argv['custom-id']) body.custom_id = String(argv['custom-id']);
  if (argv.prompt || argv['prompt-file']) body.prompt = readPrompt(argv);
  if (argv['image-url']) body.image_url = String(argv['image-url']);

  const wantVerify = !argv['no-verify']; // 动作默认开启校验（校验本身免费）

  if (argv['dry-run']) {
    log(c.bold(`--dry-run 预演：动作 ${action}`));
    log(`  源任务 : ${srcTask}`);
    log(`  请求体 : ${JSON.stringify(body)}`);
    log(`  预估   : ${est == null ? c.yellow('平台未标价，未知') : fmtUsd(est)}`);
    log(`  校验   : ${wantVerify ? '开启（哈希+分辨率比对）' : '已用 --no-verify 关闭'}`);
    return 0;
  }

  const key = requireApiKey(cfg);
  const api = new Apimart(clientOpts(argv, cfg, key));
  if (!known) warn(`平台未给动作 ${action} 标价，实际费用以任务返回的 cost 为准。`);

  process.stderr.write(`  提交动作 ${action} … `);
  let submitted;
  try {
    submitted = await api.submitAction(action, body, { idempotencyKey: randomUUID() });
  } catch (e) {
    process.stderr.write('\n');
    die(`提交失败：${e.message}`);
  }
  process.stderr.write(`task_id=${submitted.taskId}\n`);

  const res = await api.poll(submitted.taskId, {
    onTick: ({ status, progress, elapsedMs }) => {
      process.stderr.write(`\r  ${c.dim(`状态 ${status} 进度 ${progress ?? '?'} ${Math.round(elapsedMs / 1000)}s`)}    `);
    },
  });
  process.stderr.write('\r' + ' '.repeat(72) + '\r');

  if (!res.urls.length) {
    const detail = res.data?.error ?? res.data ?? {};
    record(cfg.ledger_dir, {
      model: `midjourney@${action}`,
      ratio: null,
      images: 0,
      costUsd: res.cost ?? 0,
      credits: res.credits ?? null,
      taskId: submitted.taskId,
      format: '',
      bytes: 0,
      file: '',
      prompt: `[${action}] source=${srcTask}`,
    }, { sidecarExtra: { failed: true, action, status: res.status, detail } });
    die(`动作 ${action} 任务 ${res.status}，没有拿到图片 URL。原始：${JSON.stringify(detail).slice(0, 400)}`);
  }

  // 下载输出（同时记录哈希与分辨率，供校验用）
  const dayDir = join(cfg.output_dir, new Date().toISOString().slice(0, 10));
  ensureDir(dayDir);
  const saved = [];
  for (let i = 0; i < res.urls.length; i++) {
    const { buf, format } = await api.download(res.urls[i]);
    const idx = res.urls.length > 1 ? String(i + 1).padStart(2, '0') : '01';
    const file = join(dayDir, `${tsCompact()}-mj-${action}-${idx}.${format}`);
    writeFileSync(file, buf);
    const dim = imageSize(buf);
    saved.push({ file, format, bytes: buf.length, sha: sha256Buf(buf), w: dim.w, h: dim.h });
  }

  // ── 校验：输出 vs 源图 ────────────────────────────────────
  let verdict = null;
  if (wantVerify) {
    try {
      const src = await api.sourceImages(srcTask);
      const sources = [];
      for (const u of src.urls) {
        const { buf } = await api.download(u);
        sources.push({ sha: sha256Buf(buf), ...imageSize(buf) });
      }
      const noop = saved.filter((o) => sources.some((s) => s.sha === o.sha));
      const grew = saved.some((o) => sources.some((s) => s.w && o.w && o.w * o.h > s.w * s.h));
      verdict = { sources, noop, grew };
    } catch (e) {
      warn(`校验未完成（${e.message}）—— 这不代表动作有效，请自行比对。`);
    }
  }

  const { sidecar } = record(cfg.ledger_dir, {
    model: `midjourney@${action}`,
    ratio: null,
    images: saved.length,
    costUsd: res.cost,
    credits: res.credits,
    taskId: submitted.taskId,
    format: saved[0]?.format,
    bytes: saved.reduce((a, s) => a + s.bytes, 0),
    file: saved[0]?.file,
    prompt: `[${action}] source=${srcTask}`,
  }, { sidecarExtra: { action, source_task: srcTask, request: body, urls: res.urls, verify: verdict ? { sources: verdict.sources.length, noop: verdict.noop.length, resolution_increased: verdict.grew } : null } });

  const result = {
    ok: true,
    action,
    source_task: srcTask,
    task_id: submitted.taskId,
    status: res.status,
    cost_usd: res.cost,
    files: saved.map((s) => s.file),
    dimensions: saved.map((s) => (s.w ? `${s.w}x${s.h}` : null)),
    verify: verdict ? { sources: verdict.sources.length, noop: verdict.noop.length, resolution_increased: verdict.grew } : null,
    ledger: join(cfg.ledger_dir, 'ledger.csv'),
    sidecar,
  };

  if (argv.json) {
    log(JSON.stringify(result, null, 2));
  } else {
    log('');
    log(`${c.green('完成')}  动作 ${action}  ${res.cost != null ? fmtUsd(res.cost) : '费用未知'}`);
    for (const s of saved) {
      log(`  ${c.bold('文件')} ${s.file}  ${c.dim(`(${s.w ? `${s.w}x${s.h}, ` : ''}${s.format}, ${(s.bytes / 1024).toFixed(1)} KB)`)}`);
    }
  }

  // ── 判定为空操作：明确告警 + 非零退出码 ──────────────────
  if (verdict && verdict.noop.length) {
    log('');
    log(c.red('⚠ 检出「付费空操作」：输出与源图逐字节完全相同，平台没有真的执行这个动作。'));
    log(`  相同的源图数: ${verdict.noop.length} / ${saved.length} 张输出`);
    log(`  分辨率是否变大: ${verdict.grew ? '是' : c.red('否')}`);
    log(c.dim('  建议：停止对该动作继续付费；改用本地放大器等替代方案；并保留本条台账作为证据。'));
    return 3;
  }
  if (verdict && !verdict.grew && verdict.sources.length) {
    warn('输出与源图哈希不同（动作确实产生了新文件），但分辨率没有变大 —— 若你要的是放大，请确认是否符合预期。');
  }
  return 0;
}

// ─────────────────────────── 小工具 ───────────────────────────

function clientOpts(argv, cfg, apiKey) {
  return {
    apiKey: apiKey ?? cfg.api_key,
    baseUrl: cfg.base_url,
    pollIntervalMs: Number(cfg.poll_interval_ms) || 3000,
    pollTimeoutMs: Number(cfg.poll_timeout_ms) || 300000,
    verbose: Boolean(argv.verbose),
    retries: argv['no-retry'] ? 0 : Number(cfg.retries ?? 3),
    retryBaseMs: Number(cfg.retry_base_ms) || 600,
    retryMaxMs: Number(cfg.retry_max_ms) || 8000,
    onRetry: ({ attempt, delay, error, method, path }) => {
      warn(`请求失败（${method} ${path ? String(path).slice(0, 80) : ''}）：${error?.message || error}；${Math.round(delay)}ms 后进行第 ${attempt} 次重试`);
    },
  };
}

function readPrompt(argv) {
  if (argv['prompt-file']) {
    const p = resolve(String(argv['prompt-file']));
    if (!existsSync(p)) die(`提示词文件不存在: ${p}`);
    return readFileSync(p, 'utf8').trim();
  }
  if (typeof argv.prompt === 'string') return argv.prompt.trim();
  if (argv._.length) return argv._.join(' ').trim();
  return '';
}

function normalizeRatioOrDie(input, model) {
  try {
    return normalizeRatio(input, model);
  } catch (e) {
    die(e.message);
  }
}

function ok(label, good) {
  log(`  ${good ? c.green('✓') : c.red('✗')} ${label}`);
}
function bad(label) {
  log(`  ${c.red('✗')} ${label}`);
}

function printHelp() {
  log(`${c.bold('deepseekimagen')} — 用 APIMart(apib.ai) 生图

${c.bold('用法')}
  dimg --prompt "<提示词>" [选项]
  dimg --prompt-file prompt.txt [选项]        ← 中文提示词推荐（避开命令行编码问题）
  dimg --check                                自检：配置/密钥/连通/目录可写
  dimg --models                               列出可用模型与参考价
  dimg --ledger [--tail N]                    查看台账汇总

${c.bold('常用选项')}
  --model <id>      指定模型（默认取 config.default_model；说"生图"就用默认）
  --ratio <比例>    1:1 / 16:9 / 9:16 / 4:3 / 3:4 ... 也接受 方图/横图/竖图
                    别名：--ar / --aspect / --aspect-ratio；--size 9:16 亦可
                    （--size 1024x1024 这类像素值会明确报错，平台只认比例）
  --out <目录>      覆盖输出目录
  --images <n>      张数（Midjourney 固定 4 张，忽略此参数）
  --version <v>     Midjourney 版本（如 6.1 / 7 / 8.2）
  --no-retry        关闭网络重试（默认 GET 重试全部可重试错误，POST 只重试"确定未送达"的错误）
  --dry-run         只预演，不提交、不花钱
  --force           跳过单次费用上限保护
  --json            以 JSON 输出结果（便于程序解析）
  --config <路径>   指定配置文件

${c.bold('Midjourney 后续动作（用 imagine 的 task_id 做源）')}
  dimg --action <动作> --task <源task_id> [--index N] [--custom-id ID] [--no-verify]
  动作: upscale | variation | high-variation | low-variation | reroll | zoom | pan | inpaint
        | edits | blend | describe | remix-strong | remix-subtle | video
  参数: --index 1-4（U/V 目标）  --direction left|right|up|down（pan）
        --zoom-ratio N（zoom）    --custom-id 'MJ::JOB::...'（绕过自动匹配）
  ${c.bold('--verify')} 默认开启：把输出与源图做哈希+分辨率比对。
          检出「输出与源图逐字节相同」时告警并返回退出码 3（付费空操作）。
          用 --no-verify 关闭。

${c.bold('示例')}
  dimg --prompt-file p.txt --ratio 16:9
  dimg --prompt "a red apple" --ratio 1:1 --dry-run
  dimg --prompt "概念海报" --model midjourney --ratio 9:16
  dimg --action upscale --task task_01M4Q5GCTRNAHY7X4DDZ42EVY7 --index 4
  dimg --action upscale --task task_xxx --index 4 --dry-run
  dimg --ledger --tail 5
`);
}
