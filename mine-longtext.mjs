/**
 * 二次挖掘：专挖「长句说明文本」。
 *
 * 第一次挖的时候犯了两个错：
 *   1) 正则写了 {2,80} 的长度上限 → 所有超过 80 字符的说明段落全被切掉
 *   2) 只匹配双引号字符串 → VGen 分类树里大量 'description:"..."' 和
 *      单引号写法整个漏掉
 *
 *   node mine-longtext.mjs
 *
 * 输出 harvest/longtext-candidates.txt（按长度升序），并报告其中有多少
 * 是当前词库还没覆盖的。
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './harness.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(ROOT, 'harvest', 'js');

const { lookup } = loadEngine();

let all = '';
for (const f of readdirSync(JS_DIR)) {
  if (f.endsWith('.js')) all += readFileSync(join(JS_DIR, f), 'utf8');
}

/* ---------------------------------------------------------- 候选提取 */

/* 单/双引号都要，并且正确处理 \' \" \\ 转义 */
const PATTERNS = [
  /"((?:[^"\\\n]|\\.){40,400})"/g,
  /'((?:[^'\\\n]|\\.){40,400})'/g,
  /description:\s*"([^"]{30,400})"/g,
  /description:\s*'((?:[^'\\\n]|\\.){30,400})'/g
];

function unescapeJs(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ');
}

const seen = new Set();
for (const re of PATTERNS) {
  let m;
  while ((m = re.exec(all)) !== null) {
    const s = unescapeJs(m[1]);
    /* 被转义截断的碎片：以反斜杠或单引号/双引号收尾的，丢掉 */
    if (/['"\\]$/.test(s)) continue;
    seen.add(s);
  }
}
const cands = [...seen];

/* ---------------------------------------------------------- 过滤 */

function looksLikeSentence(s) {
  if (/[^\x20-\x7E]/.test(s)) return false;
  const words = s.match(/[A-Za-z][A-Za-z'-]{1,}/g) || [];
  /* 短句放宽到 5 词，长句必须有 6 个空格 */
  if (s.length > 80 && (s.match(/ /g) || []).length < 6) return false;
  if (words.length < 5) return false;
  if (/[{}<>;\\`|]/.test(s)) return false;
  if (/=>|function|return |import |export |typeof |undefined|null|children:|className:/.test(s)) return false;
  if (/https?:|\.js\b|\.css\b|\.png\b|\.svg\b|rgb\(|px\b|var\(--|rec[A-Za-z0-9]{10}/.test(s)) return false;
  if (!/\b(the|a|an|is|are|you|your|to|of|and|will|can|for|in|on|with|this|that)\b/i.test(s)) return false;
  const letters = s.replace(/[^A-Za-z]/g, '');
  const uppers = s.replace(/[^A-Z]/g, '');
  if (letters.length && uppers.length / letters.length > 0.4) return false;
  return true;
}

const filtered = cands.filter(looksLikeSentence).sort((a, b) => a.length - b.length);
const fresh = filtered.filter((s) => lookup(s) === undefined);

writeFileSync(join(ROOT, 'harvest', 'longtext-candidates.txt'), fresh.join('\n') + '\n', 'utf8');

console.log('JS 总量      : ' + (all.length / 1024 / 1024).toFixed(1) + ' MB');
console.log('原始候选     : ' + cands.length);
console.log('像句子的     : ' + filtered.length);
console.log('已被词库覆盖 : ' + (filtered.length - fresh.length));
console.log('**未覆盖**   : ' + fresh.length);
console.log('已写出 harvest/longtext-candidates.txt');
