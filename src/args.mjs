// CLI 参数解析与别名归一 —— 独立成模块，便于单元测试（导入它不会触发 CLI 主流程）
import { die, parseArgs } from './util.mjs';

/**
 * 参数别名归一：让人不用记住内部名字。
 *   --ar / --aspect / --aspect-ratio / --aspect_ratio  →  --ratio
 *   --size 9:16                                        →  --ratio 9:16
 *   --size 1024x1024                                   →  明确报错（这是本项目最常见的坑）
 *   --no-retry                                         →  retries = 0
 */
export function normalizeArgAliases(argv) {
  if (argv.ratio === undefined) {
    for (const k of ['ar', 'aspect', 'aspect-ratio', 'aspect_ratio']) {
      if (argv[k] !== undefined) { argv.ratio = argv[k]; break; }
    }
  }
  if (argv.size !== undefined && argv.ratio === undefined) {
    const s = String(argv.size).trim();
    if (/^\d+\s*[x×*]\s*\d+$/i.test(s)) {
      die(
        `--size 只接受**比例**，不能传像素值 "${s}"。\n` +
        '  这个平台的 size 参数是比例（会转成 Midjourney 的 --ar），传像素一律 400。\n' +
        '  正方形请写 --ratio 1:1，竖版 9:16，横版 16:9。',
      );
    }
    argv.ratio = s;
  }
  if (argv['no-retry']) argv.retries = 0;
  return argv;
}

export function parseCliArgs(argv) {
  return normalizeArgAliases(parseArgs(argv));
}
