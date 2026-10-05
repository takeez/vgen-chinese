/**
 * 拿用户导出的未命中词条清单，检查现在覆盖了多少。
 *
 *   node verify-export.mjs "D:\Downloads\vgenzh-missed-2026-10-05.txt"
 *
 * 按「出处」（标签.类名）分组统计，方便看出还剩哪一类没覆盖。
 * 用的是产物里的真引擎（见 harness.mjs）。
 */

import { readFileSync } from 'node:fs';
import { loadEngine } from './harness.mjs';

const target = process.argv[2];
if (!target) {
  console.error('用法: node verify-export.mjs <导出的 txt 路径>');
  process.exit(1);
}

const { TERMS, REGEX_RULES, lookup } = loadEngine();

/* ---------------------------------------------------------- 读样本 */

/* 每行格式：英文原文<TAB>标签.类名 */
const rows = readFileSync(target, 'utf8')
  .split('\n')
  .map((l) => l.replace(/\r$/, ''))
  .filter((l) => l.trim())
  .map((l) => {
    const i = l.indexOf('\t');
    return i >= 0
      ? { text: l.slice(0, i), where: l.slice(i + 1) }
      : { text: l, where: '(无出处)' };
  });

/* ---------------------------------------------------------- 跑 */

const hit = [];
const miss = [];
for (const r of rows) {
  (lookup(r.text) === undefined ? miss : hit).push(r);
}

const pct = ((hit.length / rows.length) * 100).toFixed(1);

console.log('词条总数 : ' + Object.keys(TERMS).length);
console.log('正则规则 : ' + REGEX_RULES.length);
console.log('导出行数 : ' + rows.length);
console.log('命中     : ' + hit.length + '  (' + pct + '%)');
console.log('未命中   : ' + miss.length);
console.log('');

/* 按出处分组，看剩下的集中在哪 */
function bucket(where) {
  return where.replace(/-vg__sc-[0-9a-f]+-\d+$/, '');
}

const byWhere = new Map();
for (const r of miss) {
  const k = bucket(r.where);
  if (!byWhere.has(k)) byWhere.set(k, []);
  byWhere.get(k).push(r.text);
}

console.log('=== 未命中按出处分组 ===');
[...byWhere.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([w, list]) => {
    console.log('');
    console.log(w + '   [' + list.length + ']');
    list.slice(0, 8).forEach((t) => console.log('    ' + t));
    if (list.length > 8) console.log('    …还有 ' + (list.length - 8) + ' 条');
  });
