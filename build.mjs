/**
 * 打包。产出三个文件：
 *
 *   dist/vgen-chinese.user.js  ← 要装进篡改猴的那一个（引擎 + 内置种子词库）
 *   dist/vgen-dict.json        ← 纯数据的词库，用来更新到篡改猴存储
 *   dist/vgen-dict.min.txt     ← 同上但更紧凑，方便整份塞进剪贴板
 *
 *   node build.mjs
 *
 * 设计要点：脚本本体（引擎 + 正则）以后基本不变，只有词库在长。
 * 运行时优先用篡改猴存储里的词库，存储为空才回退到内置种子词库，
 * 所以更新词库不需要重新安装脚本。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const VERSION = '1.0.1';

const read = (name) => readFileSync(join(SRC, name), 'utf8');

/* 词库文件。同名键后面覆盖前面。 */
const DICT_FILES = [
  ['DICT_UI', 'dict-ui.js'],
  ['DICT_FILTERS', 'dict-filters.js'],
  ['DICT_CATEGORIES', 'dict-categories.js'],
  ['DICT_COPY', 'dict-copy.js'],
  ['DICT_EXTRA', 'dict-extra.js'],
  ['DICT_DASHBOARD', 'dict-dashboard.js'],
  ['DICT_TAGS', 'dict-tags.js'],
  ['DICT_LONGTEXT', 'dict-longtext.js'],
  ['DICT_LONGTEXT2', 'dict-longtext2.js'],
  ['DICT_ROUND3', 'dict-round3.js'],
  ['DICT_ROUND4', 'dict-round4.js'],
  ['DICT_ROUND5', 'dict-round5.js']
];

/* ---------------------------------------------------------- 合并词库 */

const dictSrc = DICT_FILES.map(([, f]) => read(f)).join('\n');
const loadDicts = new Function(
  dictSrc + '\nreturn [' + DICT_FILES.map(([n]) => n).join(', ') + '];'
);
const dicts = loadDicts();

const merged = Object.assign({}, ...dicts);

/*
 * 丢掉空译文和「只差大小写的同值重复键」。
 * 空译文会把页面文字抹掉，宁可不收。
 * 大小写变体在运行时由 sanitize() 自动补别名，所以源文件里同时写两份是冗余的，
 * 而且会让 JSON 出现同名（仅大小写不同）的键，部分工具解析会报错。
 */
const terms = {};
const seenLower = new Map();
let dropped = 0;
let dedupCase = 0;

for (const k of Object.keys(merged)) {
  const v = merged[k];
  if (typeof v !== 'string' || v.trim() === '') { dropped++; continue; }

  const lk = k.toLowerCase();
  if (seenLower.has(lk)) {
    const canon = seenLower.get(lk);
    /* 同值的纯大小写变体 → 丢掉；值不同的（真的两种含义）保留 */
    if (terms[canon] === v) { dedupCase++; continue; }
  } else {
    seenLower.set(lk, k);
  }
  terms[k] = v;
}

/* ---------------------------------------------------------- 产出脚本 */

const out = [];
out.push(read('head.js').replace('__VERSION__', VERSION));
out.push('');
out.push('(function () {');
out.push("'use strict';");
out.push('');
out.push('/* 由 build.mjs 自动生成，请改 src/ 下的源文件，不要直接改本文件 */');
out.push('var VERSION = ' + JSON.stringify(VERSION) + ';');
out.push('');

/*
 * 注意：这里**故意不注入任何 API 密钥**。
 * 产物是要提交到公开仓库的，密钥一旦打进去就跟着公开了。
 * 密钥只存在篡改猴本地存储里（面板里填一次），或从剪贴板读一份配置 JSON。
 */

out.push('/* ---------------- normalize.js ---------------- */');
out.push(read('normalize.js').trim());
out.push('');

out.push('/* ---------------- regex.js（内置，很少变） ---------------- */');
out.push(read('regex.js').trim());
out.push('');

out.push('/* ---------------- 内置种子词库（存储为空时用它） ---------------- */');
/*
 * 逐条一行输出，**不要**压成一行 JSON。
 * GreasyFork 有"压缩代码"检测（看超长行 / 换行密度），一行 16 万字符会被
 * 判定为最小化代码并拒绝收录。逐条一行只多约 2 KB，而且可读性更好。
 */
var dictKeys = Object.keys(terms);
out.push('var SEED_TERMS = {');
out.push(dictKeys.map(function (k, i) {
  return '  ' + JSON.stringify(k) + ': ' + JSON.stringify(terms[k]) +
         (i === dictKeys.length - 1 ? '' : ',');
}).join('\n'));
out.push('};');
out.push('');

out.push('/* ---------------- engine.js ---------------- */');
out.push(read('engine.js').trim());
out.push('');

out.push('})();');
out.push('');

const bundle = out.join('\n');

mkdirSync(DIST, { recursive: true });
const userJs = join(DIST, 'vgen-chinese.user.js');
writeFileSync(userJs, bundle, 'utf8');

/* ---------------------------------------------------------- 产出词库数据 */

const payload = { v: VERSION, count: Object.keys(terms).length, terms };
const json = JSON.stringify(payload);
writeFileSync(join(DIST, 'vgen-dict.json'), JSON.stringify(payload, null, 2), 'utf8');
writeFileSync(join(DIST, 'vgen-dict.min.txt'), json, 'utf8');

/* ---------------------------------------------------------- 报告 */

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('版本     : ' + VERSION);
console.log('词条数   : ' + Object.keys(terms).length +
  (dropped ? '（丢弃空译文 ' + dropped + ' 条）' : '') +
  (dedupCase ? '（合并大小写重复 ' + dedupCase + ' 条）' : ''));
console.log('');
console.log('  dist/vgen-chinese.user.js   ' + kb(Buffer.byteLength(bundle, 'utf8')) + '   ← 装到篡改猴');
console.log('  dist/vgen-dict.min.txt      ' + kb(Buffer.byteLength(json, 'utf8')) + '   ← 塞剪贴板更新词库用');
console.log('  dist/vgen-dict.json         ' + kb(Buffer.byteLength(JSON.stringify(payload, null, 2), 'utf8')) + '   ← 同上，带缩进便于查看');

/* ---------------------------------------------------------- 版本号防呆 */

/*
 * GreasyFork 从 GitHub 同步这个脚本，它要求「代码变了 @version 必须递增」。
 * 忘了升版本的话：GF 会报警告，而且已安装的用户**收不到更新**
 * （篡改猴是靠版本号判断要不要更新的）。所以这里存一份指纹，下次构建时对比。
 */
const crypto = await import('node:crypto');
const stampFile = join(DIST, '.build-stamp.json');
const hash = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 16);
const bare = bundle.replace(/(\/\/ @version\s+)\S+/, '$1<VERSION>');
const bareHash = crypto.createHash('sha256').update(bare).digest('hex').slice(0, 16);

let prev = null;
try { prev = JSON.parse(readFileSync(stampFile, 'utf8')); } catch (e) { /* 首次构建 */ }

if (prev && prev.bareHash === bareHash) {
  console.log('');
  console.log('✅ 内容与上次构建一致，版本号 ' + VERSION + ' 无需变动。');
} else if (prev && prev.version === VERSION) {
  console.log('');
  console.log('⚠️  内容变了，但版本号还是 ' + VERSION + '！');
  console.log('    GreasyFork 会报「代码更改但未更新版本」，已安装用户也收不到更新。');
  console.log('    请把 build.mjs 里的 VERSION 递增后再构建（例如 1.0.1 → 1.0.2）。');
} else if (prev) {
  console.log('');
  console.log('✅ 版本已递增：' + prev.version + ' → ' + VERSION + '，内容已变更（正常）。');
} else {
  console.log('');
  console.log('ℹ️  首次构建，已记录指纹。');
}

writeFileSync(stampFile, JSON.stringify({ version: VERSION, hash, bareHash }, null, 2), 'utf8');
