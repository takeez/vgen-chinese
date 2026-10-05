/**
 * 覆盖率自测：拿从 vgen.co 真实扒下来的文案去撞词库。
 *
 *   node verify.mjs
 *
 * 用的是产物里的真引擎（见 harness.mjs），不是手抄的复刻版。
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './harness.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const { TERMS, REGEX_RULES, lookup } = loadEngine();

/* ---------------------------------------------------------- 读样本 */

const samples = readFileSync(join(ROOT, 'harvest', 'clean2.txt'), 'utf8')
  .split('\n')
  .map((l) => {
    /* 格式是「次数<TAB>原文」。取第一个 tab 之后的部分 */
    const i = l.indexOf('\t');
    return (i >= 0 ? l.slice(i + 1) : l).trim();
  })
  .filter(Boolean);

/* ---------------------------------------------------------- 跑 */

const hits = [];
const misses = [];
for (const s of samples) {
  const out = lookup(s);
  if (out === undefined) misses.push(s);
  else hits.push([s, out]);
}

const pct = ((hits.length / samples.length) * 100).toFixed(1);

console.log('词条总数   : ' + Object.keys(TERMS).length);
console.log('正则规则   : ' + REGEX_RULES.length);
console.log('样本总数   : ' + samples.length);
console.log('命中       : ' + hits.length + '  (' + pct + '%)');
console.log('未命中     : ' + misses.length);
console.log('');

/* 空译文检查（引擎里已过滤，这里查的是过滤结果） */
const empties = Object.entries(TERMS).filter(([, v]) => !v || !String(v).trim());
console.log('空译文     : ' + empties.length + (empties.length ? '  <<< 有问题！' : ''));

/* 非 ASCII 键：多半是站点原文本来就有（弯引号、箭头、·），列出来人工确认 */
const badKeys = Object.keys(TERMS).filter((k) => /[^\x20-\x7E]/.test(k));
console.log('非 ASCII 键: ' + badKeys.length + '（站点原文含特殊符号，属正常）');
if (badKeys.length) badKeys.forEach((k) => console.log('    ' + JSON.stringify(k)));

console.log('');
console.log('=== 未命中里最值得补的 40 条（按长度升序） ===');
misses
  .slice()
  .sort((a, b) => a.length - b.length)
  .slice(0, 40)
  .forEach((s) => console.log('  ' + s));
