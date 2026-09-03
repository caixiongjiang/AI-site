/**
 * 检查自定义主题色 token 是否真的编译出了 CSS。
 *
 * 为什么需要这个脚本：Tailwind 对未定义的 utility 是**静默丢弃**的。写错
 * `text-muted-foreground`（config 里没有这个 token）不会报错、不会警告，
 * 只是那个类不产出任何 CSS，元素继承父级颜色，看起来"能跑"。这类 bug 曾经
 * 无声积累到 3 处 47 个调用点，其中包括整个会话列表选中态背景消失
 * （`bg-primary/8` —— Tailwind 的 opacity scale 是 5 的倍数，8 不在其中）。
 *
 * 检查思路：一个类如果在源码里被使用，却在构建产物 CSS 中不存在对应选择器，
 * 那它就是死类。这条判据不依赖对 Tailwind 内部规则的假设，因此不会随版本失效。
 *
 * 用法：先 `next build`，再 `npm run check:tokens`。
 */
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIRS = ["components", "app", "lib"];

/** Tailwind 支持颜色的 utility 前缀 */
const COLOR_PREFIXES = [
  "text", "bg", "border", "ring", "divide", "fill", "stroke",
  "placeholder", "shadow", "outline", "from", "to", "via",
  "accent", "caret", "decoration",
];

/** 从 tailwind.config.ts 里读出自定义颜色名，避免新增 token 后本脚本漏检 */
function readCustomColorNames() {
  const cfg = readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8");
  const block = cfg.match(/colors:\s*\{([\s\S]*?)\n {6}\}/);
  if (!block) {
    throw new Error(
      "无法从 tailwind.config.ts 解析 colors 块——若配置结构已变更，请同步更新本脚本",
    );
  }
  // 顶层键：缩进恰好 8 空格的 `name:`
  return [...block[1].matchAll(/^ {8}([\w-]+):/gm)].map((m) => m[1]);
}

/** 构建产物里实际存在的类名（剥掉 hover:/focus: 等变体前缀与 CSS 转义反斜杠） */
function readEmittedClasses() {
  const files = globSync(".next/static/chunks/*.css", { cwd: ROOT });
  if (files.length === 0) {
    console.error(
      "找不到构建产物 CSS。请先运行 `npx next build`，再执行本检查。",
    );
    process.exit(2);
  }
  const css = files
    .map((f) => readFileSync(path.join(ROOT, f), "utf8"))
    .join("");

  const emitted = new Set();
  for (const [, raw] of css.matchAll(/\.((?:[\w-]|\\.)+)/g)) {
    // CSS 里变体前缀是转义冒号：.hover\:bg-primary\/90
    emitted.add(raw.split("\\:").pop().replaceAll("\\", ""));
  }
  return emitted;
}

function collectUsages(colorNames) {
  const pattern = new RegExp(
    String.raw`\b(?:${COLOR_PREFIXES.join("|")})-(?:${colorNames.join("|")})` +
      String.raw`(?:-[a-z]+)?(?:/\d+)?\b`,
    "g",
  );

  const usages = new Map();
  const files = SRC_DIRS.flatMap((d) =>
    globSync(`${d}/**/*.{ts,tsx}`, { cwd: ROOT }),
  );
  for (const file of files) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    for (const [cls] of src.matchAll(pattern)) {
      if (!usages.has(cls)) usages.set(cls, new Set());
      usages.get(cls).add(file);
    }
  }
  return usages;
}

const colorNames = readCustomColorNames();
const emitted = readEmittedClasses();
const usages = collectUsages(colorNames);

const dead = [...usages].filter(([cls]) => !emitted.has(cls));

if (dead.length === 0) {
  console.log(
    `✓ ${usages.size} 个自定义色类全部有对应 CSS（token: ${colorNames.join(", ")}）`,
  );
  process.exit(0);
}

console.error(`✗ ${dead.length} 个类在源码中使用但未产出任何 CSS：\n`);
for (const [cls, files] of dead.sort((a, b) => a[0].localeCompare(b[0]))) {
  console.error(`  ${cls}`);
  for (const f of [...files].sort()) console.error(`      ${f}`);
}
console.error(
  "\n常见原因：token 名在 tailwind.config.ts 中不存在，" +
    "或 opacity 修饰符不在 Tailwind 的 opacity scale（5 的倍数）内。",
);
process.exit(1);
