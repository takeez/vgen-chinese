/**
 * 自测脚本共用的「加载真实引擎」入口。
 *
 * 为什么要这个文件：以前我在 verify / probe / verify-export 里各抄了一份
 * lookup 的实现，结果引擎改了自测没跟上（引号归一化、大小写回退都没被测到），
 * 打印出来的覆盖率是假的。现在统一从打包产物里取出引擎的**真函数**，
 * 自测和线上跑的是同一份逻辑。
 *
 * 做法：把产物里的油猴元数据、最外层 IIFE 包装、末尾的 boot() 调用去掉，
 * 剩下的当函数体 eval。boot() 必须去掉 —— Node 里没有 DOM。
 * 剩下的顶层语句（如 `var lastHref = location.href`）靠下面这组桩撑着。
 *
 * 注意：词库装配（pickTerms）现在在引擎里，桩把 GM_getValue 接成「返回默认值」，
 * 所以自测拿到的永远是**内置种子词库**，这正是我们想测的那份。
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(ROOT, 'dist', 'vgen-chinese.user.js');

/* 只为让顶层语句能跑完，不会被真正调用到的都不做实现 */
const STUBS = {
  location: { href: 'https://vgen.co/' },
  document: {
    readyState: 'complete',
    title: '',
    documentElement: { lang: '', appendChild() {} },
    head: null,
    body: null,
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} })
  },
  window: {},
  unsafeWindow: {},
  GM_getValue: (k, d) => d,
  GM_setValue: () => {},
  GM_registerMenuCommand: () => 1,
  GM_unregisterMenuCommand: () => {},
  GM_addStyle: () => ({}),
  GM_setClipboard: () => {},
  GM_xmlhttpRequest: () => {},
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  MutationObserver: function () { this.observe = () => {}; },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  navigator: {}
};

export function loadEngine() {
  let src = readFileSync(BUNDLE, 'utf8');

  /* 油猴元数据块 */
  src = src.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');

  /* 最外层 IIFE 包装 */
  src = src.replace('(function () {', '');
  if (!/\}\)\(\);\s*$/.test(src)) throw new Error('产物结尾不是预期的 })(); ，结构变了？');
  src = src.replace(/\}\)\(\);\s*$/, '');

  /* 末尾的启动调用 */
  if (!/\bboot\(\);/.test(src)) throw new Error('产物里找不到 boot(); 调用，结构变了？');
  src = src.replace(/\n\s*boot\(\);/, '\n');

  const names = Object.keys(STUBS);
  const factory = new Function(
    ...names,
    src +
      '\nreturn {' +
      ' TERMS: TERMS,' +
      ' TERMS_SOURCE: TERMS_SOURCE,' +
      ' SEED_TERMS: SEED_TERMS,' +
      ' REGEX_RULES: REGEX_RULES,' +
      ' lookup: lookup,' +
      ' normalizeQuotes: normalizeQuotes,' +
      ' VERSION: VERSION' +
      ' };'
  );

  const engine = factory(...names.map((n) => STUBS[n]));

  /* 自检：确认拿到的是真函数，不是空壳 */
  if (typeof engine.lookup !== 'function') throw new Error('没取到 lookup');
  if (engine.lookup('Vibe') !== '氛围') {
    throw new Error(
      'lookup 行为异常，产物可能坏了：lookup("Vibe") = ' + JSON.stringify(engine.lookup('Vibe'))
    );
  }
  if (!engine.TERMS || Object.keys(engine.TERMS).length < 500) {
    throw new Error('词库太小或没装进来：' + Object.keys(engine.TERMS || {}).length + ' 条');
  }

  return engine;
}
