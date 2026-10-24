/* ==========================================================================
 * VGen 中文化 —— 引擎
 *
 * 词库来源（优先级从高到低）：
 *   1) 篡改猴存储里的词库（GM_getValue）—— 用菜单里的「📥 更新词库」灌进去
 *   2) 脚本内置的种子词库（SEED_TERMS）—— 保证装完即用、离线可用
 * REGEX_RULES 内置在脚本里（只有几十条，很少变）。
 *
 * 这样拆的好处：**脚本本体基本不用重装**，只有词库在长，
 * 更新词库 = 往存储里灌一份新数据。
 *
 * 设计要点：
 *  1) 纯词库精确匹配 —— 天然幂等。翻完的中文不会再命中英文键，
 *     所以 MutationObserver 因自身改动触发时自动空转，不会死循环。
 *  2) 只翻"整条文本节点完全等于词条"的内容，用户自己写的
 *     画师简介 / 服务标题不会被误伤。
 *  3) 未命中词条会被收集起来，攒够了发我，我补进词库。
 * ========================================================================== */

var CONFIG = {
  DEV: false,              // true → 控制台打印未命中词条
  MAX_MISSED: 3000,
  SAVE_MISSED_DELAY: 3000,
  KEY: {
    enabled: 'vgenzh_on',
    regex: 'vgenzh_regex',
    font: 'vgenzh_font',
    terms: 'vgenzh_terms',
    termsVer: 'vgenzh_terms_ver',
    userTerms: 'vgenzh_user_terms',
    ignore: 'vgenzh_ignore',
    xlateMode: 'vgenzh_xlate_mode',
    dictUrl: 'vgenzh_dict_url',
    dictAuto: 'vgenzh_dict_auto',
    dictChecked: 'vgenzh_dict_checked',
    missed: 'vgenzh_missed',
    aiEndpoint: 'vgenzh_ai_endpoint',
    aiKey: 'vgenzh_ai_key',
    aiModel: 'vgenzh_ai_model',
    chatCache: 'vgenzh_chat_cache',
    discuss: 'vgenzh_discuss'
  }
};

/* 这些标签里的文字一律不碰 */
var IGNORE_TAGS = {
  SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, TEXTAREA: 1,
  INPUT: 1, SELECT: 1, SVG: 1, CANVAS: 1, IFRAME: 1, MATH: 1
  /*
   * 注意：PRE 已经被拿掉了。
   *
   * 原来把 PRE 和 CODE 一起跳过是为了保护代码块，但 VGen 用
   * <pre class="detailsText"> 渲染**长文本**（客户填的附加信息、服务描述、
   * 服务条款正文），跳过 PRE 等于这些内容从头到尾没被看过一眼 ——
   * 「附加信息一直翻不了」的根因就在这里，跟词库无关。
   *
   * 现在改成：PRE 默认可翻，但**里面含 <code> 或 class 像代码高亮的仍然跳过**
   * （见 isCodeBlock），这样 Prism / highlight.js 那种 <pre><code> 结构仍然安全。
   */
};

/* 这个 <pre> 是不是代码块（代码高亮库几乎都包一层 <code>） */
var CODE_HINT_RE = /(?:^|[\s_-])(?:code|highlight|hljs|prism|shiki|language-|lang-|syntax|linenums)/i;

function isCodeBlock(el) {
  if (!el) return false;
  if (el.querySelector && el.querySelector('code')) return true;
  var cls = (el.className && typeof el.className === 'string') ? el.className : '';
  if (cls && CODE_HINT_RE.test(cls)) return true;
  /* 父级是代码高亮容器（有的库把 class 放外层） */
  var host = el.parentElement;
  for (var hop = 0; hop < 2 && host; hop++, host = host.parentElement) {
    var hc = (host.className && typeof host.className === 'string') ? host.className : '';
    if (hc && CODE_HINT_RE.test(hc)) return true;
  }
  return false;
}

/* 这些区域里的一律不碰（用户名、用户输入框等） */
var IGNORE_SELECTOR = [
  '[contenteditable="true"]',
  '[data-vgenzh-skip]',
  '.vgenzh-panel'
].join(',');

/* 这些属性里的文案也要翻 */
var TRANS_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

var HAS_LATIN = /[A-Za-z]/;
var TRIM_RE = /^(\s*)([\s\S]*?)(\s*)$/;

/* ---------------------------------------------------------------- 状态 */

var enabled = true;
var regexOn = true;
var fontFixOn = true;
var missed = new Set();
var missedDirty = false;
var pending = new Set();
var flushScheduled = false;

/* ---------------------------------------------------------------- 存储 */

function getStored(key, fallback) {
  try {
    var v = GM_getValue(key, fallback);
    return v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function setStored(key, value) {
  try { GM_setValue(key, value); } catch (e) { /* 忽略 */ }
}

/* ------------------------------------------------------------ 词库装配 */

/*
 * 优先用篡改猴存储里的词库，其次用脚本内置的种子词库。
 * 阈值 500 条是为了防呆：存储里万一被写进一小段垃圾，不至于把整个词库废掉。
 */
function pickTerms() {
  try {
    var stored = GM_getValue(CONFIG.KEY.terms, null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      var n = 0;
      for (var k in stored) { if (Object.prototype.hasOwnProperty.call(stored, k)) n++; }
      if (n >= 500) return { source: 'stored', map: stored };
    }
  } catch (e) { /* 忽略 */ }
  return { source: 'seed', map: SEED_TERMS };
}

var TERMS_PICK = pickTerms();
var TERMS_SOURCE = TERMS_PICK.source;
var TERMS_VERSION = getStored(CONFIG.KEY.termsVer, TERMS_SOURCE === 'seed' ? VERSION + '（内置）' : '（存储）');

/* ---------------------------------------------------- 自订词库 / 忽略名单 */

/*
 * 自订词库：你自己在页面上翻的条目，或导出清单改好后灌进来的。
 * 优先级**高于**主词库（同名键覆盖），所以你能随时纠正别人的译法。
 */
function loadUserTerms() {
  try {
    var m = GM_getValue(CONFIG.KEY.userTerms, null);
    if (m && typeof m === 'object' && !Array.isArray(m)) return m;
  } catch (e) { /* 忽略 */ }
  return {};
}

var USER_TERMS = loadUserTerms();

/*
 * 忽略名单：已经判定「不翻译」的原文（画师名、服务标题、品牌名…）。
 * 进了这个名单就①不再被收集、②不再出现在导出清单里。
 * 双向生效 —— 你不会再被同一批噪音烦第二次。
 */
function loadIgnore() {
  try {
    var a = GM_getValue(CONFIG.KEY.ignore, []);
    if (Array.isArray(a)) return new Set(a);
  } catch (e) { /* 忽略 */ }
  return new Set();
}

var IGNORE_TERMS = loadIgnore();

/*
 * 这些类名底下 100% 是用户内容，连收集都不必：
 *   artistDisplayName            → 画师/用户名
 *   MultiLineTextfit             → 领养角色名、服务标题（自适应缩放的文本）
 *   SearchCategorySelectOption   → 分类下拉里被 JS 截断的碎片
 */
var IGNORE_COLLECT_SELECTOR =
  '[class*="artistDisplayName"],[class*="MultiLineTextfit"],[class*="SearchCategorySelectOption"],' +
  /* 接稿弹窗里客户填的正文（pre.detailsText）是用户内容，不进「待翻清单」，
     否则导出清单会被整段客户要求刷屏 */
  '[data-request-form-screen-item] pre';

/* 最终生效的词库 = 主词库 + 自订词库（自订覆盖同名键） */
var TERMS = sanitize(Object.assign({}, TERMS_PICK.map, USER_TERMS));

function rebuildTerms() {
  TERMS = sanitize(Object.assign({}, TERMS_PICK.map, USER_TERMS));
}

function loadMissed() {
  try {
    var arr = GM_getValue(CONFIG.KEY.missed, []);
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length && i < CONFIG.MAX_MISSED; i++) missed.add(arr[i]);
    }
  } catch (e) { /* 忽略 */ }
}

function flushMissed(force) {
  if (!missedDirty && !force) return;
  missedDirty = false;
  try { GM_setValue(CONFIG.KEY.missed, Array.from(missed)); } catch (e) { /* 忽略 */ }
}

var missedTimer = null;
function markMissedDirty() {
  missedDirty = true;
  if (missedTimer) return;
  missedTimer = setTimeout(function () {
    missedTimer = null;
    flushMissed(false);
  }, CONFIG.SAVE_MISSED_DELAY);
}

/* ---------------------------------------------------------------- 查词 */

/**
 * 查一条文案。返回 undefined 表示没命中。
 * @param {string} core 原文（内部会再去一次首尾空白，所以传没 trim 的也安全）
 * @returns {string|undefined}
 */
function lookup(core) {
  /*
   * 保险：调用方本该先去空白，但自测脚本／标题等处可能忘记。
   * 这里再 trim 一次，避免 "Thank you for supporting human artists+ "
   * 这种带尾随空格的原文白白漏翻。
   */
  if (core !== core.trim()) core = core.trim();

  var hit = TERMS[core];
  if (hit !== undefined) return hit;

  /* 文本节点里常带换行缩进，折叠空白后再试一次 */
  var collapsed = core.replace(/\s+/g, ' ');
  if (collapsed !== core) {
    hit = TERMS[collapsed];
    if (hit !== undefined) return hit;
  }

  /* 引号归一化后再试（见 sanitize 的说明） */
  var nq = normalizeQuotes(collapsed);
  if (nq !== collapsed) {
    hit = TERMS[nq];
    if (hit !== undefined) return hit;
  }

  /* 大小写不敏感兜底（见 sanitize 里补的小写别名） */
  var lc = nq.toLowerCase();
  if (lc !== nq) {
    hit = TERMS[lc];
    if (hit !== undefined) return hit;
  }

  /* 带变量的文案走正则 */
  if (regexOn) {
    for (var i = 0; i < REGEX_RULES.length; i++) {
      var rule = REGEX_RULES[i];
      var out = core.replace(rule[0], rule[1]);
      if (out !== core) return out;
    }
  }
  return undefined;
}

/*
/* ---------------------------------------------------------------- 查词 */

/* hasOwn / normalizeQuotes / sanitize 都在 src/normalize.js，
 * 打包后会排在 TERMS 赋值之前（函数声明会提升，这里调用没问题）。 */


/* ------------------------------------------------------- 未命中词条收集 */

/*
 * 纯英文、像界面文案的才记 —— 用户名之类噪音尽量滤掉。
 *
 * 这里踩过两个坑，导致导出的清单不全：
 *   1) 长度上限写过 90 字符 → 设置页那些 100~160 字符的说明段落**从来没被记录**，
 *      所以"导出未命中"看着挺全，其实长段落一条都没有。
 *   2) 过滤掉所有不含小写字母的字符串 → `FROM` / `BILL TO` / `NOTE`
 *      这类全大写标签也收不到。
 * 现在长度放宽到 400，全大写只收短标签；长句额外要求至少 4 个词，挡掉代码片段。
 */
function looksLikeUiText(s) {
  if (s.length < 2 || s.length > 400) return false;
  if (!/^[A-Za-z(]/.test(s)) return false;
  if (/[^\x20-\x7E]/.test(s)) return false;         // 含非 ASCII
  if (/^(https?:|\/\/|\/|\.|@|#)/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;

  if (!/[a-z]/.test(s)) {
    /* 全大写：只收短标签，长的多半是常量名或缩写表 */
    if (s.length > 24) return false;
    if (!/^[A-Z0-9 /&+._-]+$/.test(s)) return false;
  }

  /* 长句至少 4 个词，否则多半是代码片段或标识符拼接 */
  if (s.length > 40) {
    var words = s.match(/[A-Za-z]{2,}/g);
    if (!words || words.length < 4) return false;
  }
  return true;
}

function noteMissed(core, el) {
  if (missed.size >= CONFIG.MAX_MISSED) return;
  if (!looksLikeUiText(core)) return;

  /* ① 已在忽略名单里（判定过不翻译）→ 不再记录 */
  if (IGNORE_TERMS.has(core)) return;

  /* ② 位于用户内容区（画师名/服务标题/分类碎片）→ 连收都不收 */
  if (el && el.closest) {
    try {
      if (el.closest(IGNORE_COLLECT_SELECTOR)) return;
    } catch (e) { /* 忽略 */ }
  }

  /* 记下出处，方便判断该翻成什么 */
  var hint = '';
  if (el && el.tagName) {
    hint = el.tagName.toLowerCase();
    var cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/)[0];
    if (cls) hint += '.' + cls;
  }
  var entry = hint ? core + '\t' + hint : core;

  if (missed.has(entry)) return;
  missed.add(entry);
  markMissedDirty();

  if (CONFIG.DEV) console.log('[vgenzh] 未命中:', entry);
}

/* 把某条原文从「未命中」里抹掉（例如它刚被翻译、或被加进忽略名单） */
function forgetMissed(text) {
  var prefix = text + '\t';
  var changed = false;
  Array.from(missed).forEach(function (entry) {
    if (entry === text || entry.indexOf(prefix) === 0) {
      missed.delete(entry);
      changed = true;
    }
  });
  if (changed) markMissedDirty();
  return changed;
}

/* ---------------------------------------------------------------- 忽略 */

function skipElement(el) {
  if (!el || el.nodeType !== 1) return false;

  /*
   * <option> 是特例：它的文本是用户看得见的下拉项文案（比如「预计开始」里的
   * "Oct 2026"），本来就该翻；但**如果没有 value 属性，表单提交的值就是这段
   * 文本本身**，一翻就把要提交的数据改掉了。
   * 所以只翻「有显式 value」的 option —— value 是独立的，改文本不影响提交。
   * <select> 自身不带文字，不用特殊处理（它的子 option 会被单独判定）。
   */
  if (el.tagName === 'OPTION') {
    if (!el.hasAttribute('value')) return true;
  } else if (IGNORE_TAGS[el.tagName]) {
    return true;
  }

  /* <pre> 默认可翻，但代码块仍然跳过（见 isCodeBlock 的说明） */
  if (el.tagName === 'PRE' && isCodeBlock(el)) return true;

  if (el.closest && el.closest(IGNORE_SELECTOR)) return true;
  return false;
}

/*
 * 属性翻译用的忽略判定，和 skipElement 不一样：
 * input / textarea 的 placeholder 恰恰是最该翻的东西，
 * 所以这里**不能**套用标签黑名单，只排除明确标记为用户输入区的容器。
 */
function skipAttrs(el) {
  if (!el || el.nodeType !== 1) return true;
  if (el.closest && el.closest(IGNORE_SELECTOR)) return true;
  return false;
}

/* ------------------------------------------------------------ 翻译单个 */

/*
 * 给「被我们改过文字」的元素打标记。
 *
 * 字体修正只作用于这些元素 —— 影响面从「整页每个元素」缩到「我改过的那些」。
 * 页面上没被我翻译的东西（图标字体、emoji、日韩文、用户内容、代码块）一个都不碰，
 * 所以不存在"我的字体栈里没这个字形 → 出方框"的风险。
 *
 * 观察器的 attributeFilter 只含 TRANS_ATTRS，不含 data-vgenzh，
 * 所以打标记不会触发 MutationObserver，不会形成循环。
 */
function markTranslated(el) {
  if (!el || el.nodeType !== 1) return;
  try {
    if (el.getAttribute(VGENZH_ATTR) !== '1') el.setAttribute(VGENZH_ATTR, '1');
  } catch (e) { /* 忽略 */ }
}

function tryTextNode(node) {
  var raw = node.nodeValue;
  if (!raw || !HAS_LATIN.test(raw)) return;

  var m = TRIM_RE.exec(raw);
  var lead = m[1], core = m[2], tail = m[3];
  if (!core) return;

  var out = lookup(core);
  if (out === undefined) {
    noteMissed(core, node.parentElement);
    return;
  }
  if (out === core) return;
  node.nodeValue = lead + out + tail;
  markTranslated(node.parentElement);
}

/*
 * 纯格式示例（网址 / 邮箱 / 掩码 / 编号 / 日期），翻了反而误导，
 * 也不该占着「待翻清单」的位置。
 */
function isFormatHint(s) {
  if (/https?:\/\/|www\./i.test(s)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return true;
  if (!/[a-z]/.test(s)) return true;                 /* 没有小写 = 掩码/编号，如 XX.XX、ABC123、YYYY-MM-DD */
  if (/^[\d\s.:\/+\-]+$/.test(s)) return true;       /* 纯数字/日期 */
  return false;
}

function tryAttrs(el) {
  if (skipAttrs(el)) return;
  for (var i = 0; i < TRANS_ATTRS.length; i++) {
    var name = TRANS_ATTRS[i];
    if (!el.hasAttribute(name)) continue;
    var raw = el.getAttribute(name);
    if (!raw || !HAS_LATIN.test(raw)) continue;

    var m = TRIM_RE.exec(raw);
    var core = m[2];
    if (!core) continue;

    var out = lookup(core);
    if (out === undefined) {
      /*
       * placeholder 没收录时也要记进「待翻清单」。
       * 否则这些文案既不会被翻译、又不会出现在导出的未命中清单里 ——
       * 等于彻底隐身，谁都不会发现它们漏了。
       */
      if (!isFormatHint(core)) noteMissed(core, el);
      continue;
    }
    if (out === core) continue;
    el.setAttribute(name, m[1] + out + m[3]);
  }
}

/* ------------------------------------------------------------ 遍历子树 */

function translate(root) {
  if (!enabled || !root) return;

  if (root.nodeType === 3) {
    if (root.isConnected) tryTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  if (!root.isConnected) return;

  /*
   * 属性先处理：root 本身可能就是个 <input>，它要跳过文本遍历，
   * 但它的 placeholder 必须翻。
   */
  tryAttrs(root);

  if (skipElement(root)) return;

  var doc = root.ownerDocument || document;
  var batch = [];
  var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || !HAS_LATIN.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      var p = n.parentElement;
      if (!p || skipElement(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  /* 先收集再改，避免边遍历边改 DOM */
  var n;
  while ((n = walker.nextNode())) batch.push(n);
  for (var i = 0; i < batch.length; i++) tryTextNode(batch[i]);

  /* 补救"被拆开的文本"，见 tryJoinChildren 的说明 */
  joinChildren(root);

  /* root 自己的属性上面已经处理过了，这里只扫子树 */
  if (root.querySelectorAll) {
    var attrEls = root.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
    for (var j = 0; j < attrEls.length; j++) tryAttrs(attrEls[j]);
  }

  /* 接稿弹窗里的自由文本字段：挂「译」按钮。没有弹窗时这一步立即返回 */
  maybeInjectRequestFields();
  /* 提案标题旁挂「讨论这单」入口 */
  maybeInjectProposeButton();

  /* 聊天页：自动翻消息（没有聊天列表时立即返回） */
  maybeStartChat();
}

/* -------------------------------------------------- 被拆开的文本 */

/*
 * VGen 有些标签会把**首字母放进单独的 <span>**，DOM 里变成 "F" + "amily"，
 * 于是逐条文本节点永远匹配不上（导出清单里那些 `amily` / `ect` / `igures`
 * / `ull Mix` 就是这么来的，全词都在词库里，只是没被拼起来过）。
 *
 * 补救：如果一个元素的**整段文本**能命中词条，而它的子节点又很浅
 * （没有嵌套、没有图标、文本很短），就整块替换成译文。
 *
 * 安全护栏（很重要，不然会把带图标的按钮毁掉）：
 *   - 元素子节点数量 1~4，且子节点自己都没有元素子节点
 *   - 子树里不能有 svg / img / i / video / canvas / 表单控件
 *   - 子树里不能有 class 含 "icon" 的元素
 *   - 整段文本长度 ≤ 100
 *   - 只有当**没有任何一个后代文本节点**单独命中词条时才动手
 *     （否则说明逐条翻译已经生效，不需要整块替换）
 */
var JOIN_SELECTOR = 'p,span,div,label,a,strong,em,b,li,h1,h2,h3,h4,h5,h6';

function joinChildren(root) {
  if (!root.querySelectorAll) return;
  var cands;
  try { cands = root.querySelectorAll(JOIN_SELECTOR); } catch (e) { return; }

  for (var i = 0; i < cands.length; i++) {
    var el = cands[i];
    var kids = el.children;
    if (!kids || kids.length < 1 || kids.length > 4) continue;

    var shallow = true;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k].children.length > 0) { shallow = false; break; }
    }
    if (!shallow) continue;

    if (el.querySelector('svg,img,i,video,canvas,input,textarea,select,button')) continue;
    if (el.querySelector('[class*="icon" i]')) continue;

    var text = (el.textContent || '').trim();
    if (!text || text.length > 100 || !HAS_LATIN.test(text)) continue;

    /* 任何一个后代文本节点单独能翻 → 逐条翻译已生效，别整块换 */
    var handled = false;
    for (var t = 0; t < kids.length; t++) {
      var raw = (kids[t].textContent || '').trim();
      if (raw && lookup(raw) !== undefined) { handled = true; break; }
    }
    if (handled) continue;

    var out = lookup(text);
    if (out === undefined || out === text) continue;
    el.textContent = out;
    markTranslated(el);
  }
}

/* ------------------------------------------------------------ 批量调度 */

function schedule(node) {
  if (!enabled || !node) return;
  if (node.nodeType === 3) {
    if (!node.isConnected) return;
  } else if (node.nodeType !== 1) {
    return;
  }
  pending.add(node);

  if (flushScheduled) return;
  flushScheduled = true;
  requestAnimationFrame(function () {
    flushScheduled = false;
    var roots = Array.from(pending);
    pending.clear();
    for (var i = 0; i < roots.length; i++) {
      try { translate(roots[i]); } catch (e) { if (CONFIG.DEV) console.warn(e); }
    }
  });
}

/* --------------------------------------------------------------- 标题 */

function translateTitle() {
  var t = document.title;
  if (!t || !HAS_LATIN.test(t)) return;
  var out = lookup(t.trim());
  if (out !== undefined && out !== t) document.title = out;
}

/* ------------------------------------------------------------- 观察器 */

var observer = null;

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var a = m.addedNodes[j];
          if (a.nodeType === 1) schedule(a);
          else if (a.nodeType === 3 && a.parentElement) schedule(a);
        }
      } else if (m.type === 'characterData') {
        schedule(m.target);
      } else if (m.type === 'attributes') {
        schedule(m.target);
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANS_ATTRS
  });
}

/* --------------------------------------------------- 客户端路由（Next.js） */

var lastHref = location.href;

function onRouteChange() {
  pending.clear();
  translate(document.body);
  translateTitle();
}

function startRouteWatcher() {
  /* 篡改猴原生支持，最省事 */
  try {
    if (typeof window.onurlchange === 'undefined') {
      window.onurlchange = function () { setTimeout(onRouteChange, 0); };
    }
  } catch (e) { /* 忽略 */ }

  /* 兜底：Next.js 换页会改 title / href，轮询一下最稳 */
  setInterval(function () {
    if (location.href !== lastHref) {
      lastHref = location.href;
      setTimeout(onRouteChange, 60);
    } else {
      translateTitle();
    }
  }, 400);
}

/* ------------------------------------------------------- 未命中词条导出 */

function exportMissed() {
  /* 导出前再过一遍忽略名单：名单里的是"已判定不翻译"，不该再出现在清单里 */
  var list = Array.from(missed)
    .filter(function (entry) {
      var tab = entry.indexOf('\t');
      var text = tab >= 0 ? entry.slice(0, tab) : entry;
      return !IGNORE_TERMS.has(text);
    })
    .sort();
  if (!list.length) {
    alert('还没有记录到未命中词条。\n先逛一逛 VGen，再回来导出。');
    return;
  }
  var text = list.join('\n');

  /* 1) 复制到剪贴板 */
  var copied = false;
  try { GM_setClipboard(text, 'text'); copied = true; } catch (e) { copied = false; }

  /* 2) 顺便下载一份，方便直接发我 */
  try {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vgenzh-missed-' + new Date().toISOString().slice(0, 10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  } catch (e) { /* 忽略 */ }

  alert(
    '共 ' + list.length + ' 条未命中词条。\n' +
    (copied ? '已复制到剪贴板。\n' : '') +
    '同时尝试下载了一个 txt 文件。\n\n' +
    '把这些发给我，我补进词库。'
  );
}

/* --------------------------------------------------------------- 字体 */

/*
 * vgen.co 的全局字体栈是：
 *   Satoshi, Noto Sans JP, Noto Sans KR, Noto Sans TC, Arial, Tahoma, sans-serif
 *
 * 里面日文、韩文、繁体都有，**唯独没有简体**；而 <html> 上又没有 lang 属性，
 * 浏览器没法按语言兜底。于是浏览器按顺序走：Satoshi 没中文 → 撞上
 * Noto Sans JP 就停了 —— 所有中文都被用**日文字形**渲染，
 * 笔画看着就"像繁体"。这就是那个现象的成因。
 *
 * 修法：把本机的简体字体插到 Noto Sans JP **前面**。
 * 只覆盖 font-family，不动 font-size / weight / letter-spacing / line-height，
 * 所以布局不会跑。
 *
 * 注意（副作用）：日文原文也会改用简体字形渲染。VGen 上日文主要出现在
 * 画师名和服务标题里，影响不大；真嫌别扭可以用菜单里那一项关掉。
 *
 * ⚠️ 生效范围：**只作用于被我们改过文字的元素**（打了 VGENZH_ATTR 标记的），
 *    不是整页。原因见 injectFontFix() 的注释。
 */
var VGENZH_ATTR = 'data-vgenzh';

var FONT_STACK = [
  'Satoshi',
  "'Noto Sans SC'",          /* 本机已装，和站点用的 Noto 系同族，观感最一致 */
  "'Microsoft YaHei UI'",
  "'Microsoft YaHei'",
  "'PingFang SC'",
  "'Source Han Sans SC'",
  "'Hiragino Sans GB'",
  "'Noto Sans JP'",          /* 保留在简体之后兜底 */
  "'Noto Sans KR'",
  "'Noto Sans TC'",
  'Arial',
  'Tahoma',
  "'Segoe UI Emoji'",
  'sans-serif'
].join(', ');

function injectFontFix() {
  if (!fontFixOn) return;

  /*
   * 只对「我们改过文字的元素」生效，不再用 '*:not(...)'。
   *
   * 之前那条 '*:not(code):not(pre)...' 等于把整页每个元素的 font-family 都换掉。
   * 影响面太大：页面上任何依赖自身字体族的东西（图标字体、emoji、日韩文、
   * 特殊符号字形）都被我这条规则接管了；一旦我的字体栈里没有那个字形，
   * 浏览器就画方框（tofu）。虽然实测 VGen 没有图标字体，但这是不必要的风险。
   *
   * 现在只打 [data-vgenzh]（翻译时给元素打的标记）：
   *   范围 = 「我改过文字的那几个元素」
   *   没翻译的地方 = 一个字都不碰
   * 而「中文像繁体」的问题依然被修掉 —— 因为那正好只发生在我译出来的中文上。
   */
  var css = '[' + VGENZH_ATTR + ']:not(code):not(pre):not(kbd):not(samp):not(tt){' +
            'font-family:' + FONT_STACK + ' !important}';
  try {
    if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; }
  } catch (e) { /* 落到下面的兜底 */ }
  try {
    var s = document.createElement('style');
    s.setAttribute('data-vgenzh-font', '1');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* 忽略 */ }
}

/* --------------------------------------------------------- 自助翻译模式 */

/*
 * 开着的时候，鼠标移到"没翻译的英文"上会高亮，点一下弹出输入框：
 *   填中文 → 存进「自订词条」并**立刻就地替换**
 *   点「不再提示」→ 加进忽略名单，以后连收集都不收
 *
 * 用捕获阶段的 mouseover/click，并且 click 里 preventDefault +
 * stopPropagation，免得点一下就把 VGen 自己的按钮/链接触发了。
 */

var xlateModeOn = false;
var xlateHover = null;
var xlatePop = null;

/* 只取元素**自己**的文本节点（不含子元素），跟 tryTextNode 的口径一致 */
function ownText(el) {
  var s = '';
  for (var i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 3) s += el.childNodes[i].nodeValue;
  }
  return s.trim();
}

/* 从事件目标往上找第一个"自己那段文字还没翻"的元素 */
function findUntranslated(start) {
  var el = start;
  var hops = 0;
  while (el && el.nodeType === 1 && hops < 6) {
    var blocked = skipElement(el);
    if (!blocked && el.closest) {
      try { blocked = !!el.closest(IGNORE_COLLECT_SELECTOR); } catch (e) { blocked = false; }
    }
    if (!blocked) {
      var t = ownText(el);
      if (t && t.length <= 160 && HAS_LATIN.test(t) && lookup(t) === undefined) {
        return { el: el, text: t };
      }
    }
    el = el.parentElement;
    hops++;
  }
  return null;
}

function closeXlatePop() {
  if (xlatePop) { xlatePop.remove(); xlatePop = null; }
}

function onXlateOver(e) {
  if (!xlateModeOn) return;
  var hit = findUntranslated(e.target);
  if (xlateHover && (!hit || hit.el !== xlateHover)) {
    xlateHover.classList.remove('vgenzh-hl');
    xlateHover = null;
  }
  if (hit) {
    hit.el.classList.add('vgenzh-hl');
    xlateHover = hit.el;
  }
}

function onXlateClick(e) {
  if (!xlateModeOn) return;
  if (xlatePop && xlatePop.contains(e.target)) return;   /* 点自己的弹窗不算 */
  var hit = findUntranslated(e.target);
  if (!hit) return;
  e.preventDefault();
  e.stopPropagation();
  openXlatePop(hit.el, hit.text, e.clientX, e.clientY);
}

function onXlateKey(e) {
  if (e.key === 'Escape') closeXlatePop();
}

function setTranslateMode(on) {
  xlateModeOn = !!on;
  setStored(CONFIG.KEY.xlateMode, xlateModeOn);
  var d = document;
  if (xlateModeOn) {
    injectPanelCss();
    d.addEventListener('mouseover', onXlateOver, true);
    d.addEventListener('click', onXlateClick, true);
    d.addEventListener('keydown', onXlateKey, true);
  } else {
    d.removeEventListener('mouseover', onXlateOver, true);
    d.removeEventListener('click', onXlateClick, true);
    d.removeEventListener('keydown', onXlateKey, true);
    if (xlateHover) { xlateHover.classList.remove('vgenzh-hl'); xlateHover = null; }
    closeXlatePop();
  }
  /* 菜单标签要跟着变，重新注册一次 */
  reg('xlate',
    (xlateModeOn ? '✏️' : '⭕') + ' 自助翻译模式：' + (xlateModeOn ? '已开启（点页面上的英文来翻译）' : '已关闭'),
    function () { setTranslateMode(!xlateModeOn); });
}

/* 把一条译文存进「自订词条」，并就地替换页面上的文字 */
function saveUserTerm(en, zh, targetEl) {
  USER_TERMS[en] = zh;
  setStored(CONFIG.KEY.userTerms, USER_TERMS);
  rebuildTerms();
  forgetMissed(en);

  if (targetEl) {
    var replaced = false;
    for (var i = 0; i < targetEl.childNodes.length; i++) {
      var n = targetEl.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && HAS_LATIN.test(n.nodeValue)) {
        var m = TRIM_RE.exec(n.nodeValue);
        n.nodeValue = m[1] + zh + m[3];
        markTranslated(n.parentElement);
        replaced = true;
        break;
      }
    }
    if (!replaced) { targetEl.textContent = zh; markTranslated(targetEl); }
    if (targetEl.classList) targetEl.classList.remove('vgenzh-hl');
  }
}

/* 把一条原文加进忽略名单：以后既不收集、也不出现在导出里 */
function ignoreTerm(text) {
  IGNORE_TERMS.add(text);
  try { GM_setValue(CONFIG.KEY.ignore, Array.from(IGNORE_TERMS)); } catch (e) { /* 忽略 */ }
  forgetMissed(text);
}

function openXlatePop(targetEl, text, x, y) {
  closeXlatePop();
  injectPanelCss();

  var pop = el('div', 'vgenzh-xlate');
  pop.setAttribute('data-vgenzh-skip', '1');
  pop.appendChild(el('div', 'en', text));

  var input = el('input');
  input.type = 'text';
  input.setAttribute('placeholder', '填中文译文，回车保存');
  pop.appendChild(input);

  var row = el('div', 'row');
  var aiBtn = el('button', null, '🤖 自动翻译');
  var saveBtn = el('button', null, '保存');
  var skipBtn = el('button', 'warn', '不再提示');
  var cancelBtn = el('button', 'sec', '取消');

  var doAiTranslate = function (silent) {
    if (!AI.ready()) {
      if (!silent) {
        aiBtn.textContent = '先配置 API';
        setTimeout(function () { aiBtn.textContent = '🤖 自动翻译'; }, 1600);
      }
      return;
    }
    aiBtn.disabled = true;
    aiBtn.textContent = '翻译中…';
    AI.translate(text).then(function (zh) {
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 自动翻译';
      if (zh) { input.value = zh; input.focus(); }
      else if (!silent) {
        aiBtn.textContent = '没译出来，再试';
        setTimeout(function () { aiBtn.textContent = '🤖 自动翻译'; }, 1800);
      }
    }).catch(function (e) {
      aiBtn.disabled = false;
      aiBtn.textContent = '失败：' + String(e && e.message ? e.message : e).slice(0, 16);
      setTimeout(function () { aiBtn.textContent = '🤖 自动翻译'; }, 2800);
    });
  };

  aiBtn.title = '调用已配置的 API 翻译这一条，结果填进输入框，你可以改完再保存';
  aiBtn.addEventListener('click', function () { doAiTranslate(false); });

  row.appendChild(aiBtn);
  row.appendChild(saveBtn);
  row.appendChild(skipBtn);
  row.appendChild(cancelBtn);
  pop.appendChild(row);
  pop.appendChild(el('div', 'tip', '保存后立刻生效，并记进「自订词条」（菜单里可导出）。「不再提示」会把它加进忽略名单，以后不再收集。'));

  var doSave = function () {
    var zh = input.value.trim();
    if (!zh) { input.focus(); return; }
    saveUserTerm(text, zh, targetEl);
    closeXlatePop();
  };
  saveBtn.addEventListener('click', doSave);
  skipBtn.addEventListener('click', function () { ignoreTerm(text); closeXlatePop(); });
  cancelBtn.addEventListener('click', closeXlatePop);
  input.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); doSave(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); closeXlatePop(); }
  });

  (document.body || document.documentElement).appendChild(pop);

  /* 贴着鼠标放，但不超出视口 */
  var w = pop.offsetWidth || 350;
  var h = pop.offsetHeight || 130;
  pop.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 12)) + 'px';
  pop.style.top = Math.max(8, Math.min(y + 14, window.innerHeight - h - 12)) + 'px';

  input.focus();
  xlatePop = pop;
  /* 注意：这里**故意不自动翻译**。必须由你点「🤖 自动翻译」才会调接口，
     再点「保存」才会生效 —— 两步都要人点，不会自己去翻你没点的地方。 */
}

/* 导出自订词条（发我合并进主词库用） */
function exportUserTerms() {
  var keys = Object.keys(USER_TERMS);
  if (!keys.length) {
    alert('还没有自订词条。\n开启「自助翻译模式」后，在页面上点英文就能加。');
    return;
  }
  var text = JSON.stringify({ v: VERSION, count: keys.length, terms: USER_TERMS }, null, 2);
  var copied = false;
  try { GM_setClipboard(text, 'text'); copied = true; } catch (e) { copied = false; }
  try {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vgenzh-user-terms-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  } catch (e) { /* 忽略 */ }
  alert('自订词条 ' + keys.length + ' 条。\n' + (copied ? '已复制到剪贴板。\n' : '') + '同时下载了一个 json。\n\n发我可以合并进主词库。');
}

/*
 * 从剪贴板导入忽略名单。既接受裸的原文列表，也接受**直接粘导出清单**——
 * 每行取第一个 TAB 之前的部分，所以 `Storefront<TAB>NAV.navItem` 也能吃。
 */
function importIgnoreFromText(text) {
  var lines = String(text || '').split('\n');
  var added = 0;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].replace(/\r$/, '');
    var tab = l.indexOf('\t');
    var t = (tab >= 0 ? l.slice(0, tab) : l).trim();
    if (!t) continue;
    if (IGNORE_TERMS.has(t)) continue;
    ignoreTerm(t);
    added++;
  }
  return added;
}

/* ------------------------------------------- 请求字段一键翻译（AI） */

/*
 * 客户的「附加信息」这类字段是**自由文本**，词库永远覆盖不了，只能走 AI。
 *
 * 结构（从真实页面快照确认，2026-10-24）：
 *   [role="dialog"] [data-request-form-screen-item]
 *       p.questionText         ← 字段名「附加信息」
 *       p.questionDescription  ← 说明「姿势、特征、多角色、附加内容等」
 *       div.questionContent > pre.detailsText   ← 正文（客户写的内容）
 *
 * 定位全靠 VGen 自己的 data-request-form-screen-item 属性，不依赖 hash 类名。
 *
 * 交互（用户定的）：
 *   点「译」→ 正文**直接换成中文**；边上出现「EN」，点一下在下面展开英文原文。
 *   不弹面板、不加设置、不自动翻译。
 */

var FIELD_HOST_ATTR = 'data-vgenzh-field';
var FIELD_BTN_ATTR = 'data-vgenzh-field-btn';
var FIELD_ORIG_ATTR = 'data-vgenzh-field-orig';

var FIELD_CSS =
  '[data-vgenzh-field]{position:relative}' +
  '[data-vgenzh-field-btn]{position:absolute;top:2px;right:2px;z-index:3;' +
    'font:12px/1 -apple-system,"Segoe UI","Microsoft YaHei UI",sans-serif;' +
    'padding:3px 8px;border-radius:6px;border:1px solid rgba(0,0,0,.14);' +
    'background:rgba(255,255,255,.94);color:#333;cursor:pointer;' +
    'opacity:.5;transition:opacity .15s}' +
  '[data-vgenzh-field-btn]:hover{opacity:1}' +
  '[data-vgenzh-field-btn][disabled]{cursor:default;opacity:.35}' +
  '[data-vgenzh-field-orig]{display:none;margin-top:6px;padding:8px 10px;' +
    'border-left:3px solid #d8d8d8;background:#fafafa;color:#666;' +
    'font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word}' +
  '[data-vgenzh-field-orig][data-open="1"]{display:block}';

function ensureFieldCss() {
  if (document.querySelector('style[' + FIELD_BTN_ATTR + '-css]')) return;
  try {
    if (typeof GM_addStyle === 'function') { GM_addStyle(FIELD_CSS); return; }
  } catch (e) { /* 兜底 */ }
  try {
    var s = document.createElement('style');
    s.setAttribute(FIELD_BTN_ATTR + '-css', '1');
    s.textContent = FIELD_CSS;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* 忽略 */ }
}

function injectOneField(pre) {
  var host = pre.parentElement;
  if (!host) return;
  host.setAttribute(FIELD_HOST_ATTR, '1');

  /* 英文原文块：默认隐藏，点「EN」展开。加 skip 免得被引擎再翻一遍 */
  var orig = document.createElement('div');
  orig.setAttribute(FIELD_ORIG_ATTR, '1');
  orig.setAttribute('data-vgenzh-skip', '1');

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute(FIELD_BTN_ATTR, '1');
  btn.textContent = '译';
  btn.title = '用 AI 把这段翻成中文';

  btn.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    /* 已经译过：这个按钮此时是「展开 / 收起原文」 */
    if (btn.getAttribute('data-state') === 'done') {
      var open = orig.getAttribute('data-open') === '1';
      orig.setAttribute('data-open', open ? '0' : '1');
      btn.textContent = open ? 'EN' : '收起';
      return;
    }
    if (btn.disabled) return;

    if (!AI.ready()) {
      btn.textContent = '先配 API';
      setTimeout(function () { btn.textContent = '译'; }, 1800);
      return;
    }

    var src = (pre.textContent || '').trim();
    if (!src) return;

    btn.disabled = true;
    btn.textContent = '译…';

    AI.translateField(src).then(function (zh) {
      btn.disabled = false;
      if (!zh) {
        btn.textContent = '没译出来';
        setTimeout(function () { btn.textContent = '译'; }, 1800);
        return;
      }
      pre.textContent = zh;
      markTranslated(pre);          /* 字体修正只作用于我改过的元素 */
      orig.textContent = src;
      if (!orig.parentElement) host.appendChild(orig);
      btn.setAttribute('data-state', 'done');
      btn.textContent = 'EN';
      btn.title = '点一下展开英文原文';
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = '失败';
      btn.title = String(e && e.message ? e.message : e);
      setTimeout(function () { btn.textContent = '译'; }, 2200);
    });
  });

  host.appendChild(btn);
}

/* 扫描接稿弹窗里的长文本字段，给还没处理的挂上「译」按钮。很轻，没有弹窗时立即返回 */
function maybeInjectRequestFields() {
  if (!enabled) return;
  var pres;
  try {
    pres = document.querySelectorAll('[role="dialog"] [data-request-form-screen-item] pre');
  } catch (e) { return; }
  if (!pres.length) return;

  var todo = [];
  for (var i = 0; i < pres.length; i++) {
    var pre = pres[i];
    if (pre.getAttribute(FIELD_HOST_ATTR)) continue;
    if (pre.parentElement && pre.parentElement.getAttribute(FIELD_HOST_ATTR)) continue;
    var t = (pre.textContent || '').trim();
    if (!t || !HAS_LATIN.test(t)) continue;
    todo.push(pre);
  }
  if (!todo.length) return;

  ensureFieldCss();
  for (var j = 0; j < todo.length; j++) injectOneField(todo[j]);
}

/* -------------------------------------------------- 聊天消息翻译 */

/*
 * 结构（真实页面快照 2026-10-24，Stream Chat React）：
 *   li.str-chat__li[data-message-id]
 *     div.str-chat__message … --me / --other
 *       div.str-chat__message-inner > div.str-chat__message-bubble
 *         div.str-chat__message-text > div.str-chat__message-text-inner > div  ← 正文
 *   textarea[data-testid="message-input"]   ← 输入框
 *   button.sendButton                       ← 发送按钮（没有 aria-label）
 *
 * 规则（用户定的）：
 *   · 双方消息都自动翻成中文，默认显示中文
 *   · 每条右下角小「EN」，点一下在下面展开英文原文
 *   · 进聊天自动翻最近 50 条；新消息自动翻
 *   · 输入框里打中文 → 点发送 → **先不发送**，把内容换成英文（可改）→ 再点一次才真发
 *   · 输入框主要是英文 → 原样发
 */

var CHAT_LI_SEL = 'li.str-chat__li[data-message-id]';
var CHAT_TEXT_SEL = '.str-chat__message-text-inner';
var CHAT_MAX = 50;            /* 一次最多翻多少条 */
var CHAT_CTX = 8;             /* 中译英时带几条上下文 */
var CHAT_CACHE_MAX = 600;

var AI_CHAT_PROMPT = [
  '你在帮一个英语不太好的中国画师看懂 VGen 上和客户的英文对话。',
  '',
  '给你对话上下文和一批需要翻译的消息，逐条翻成简体中文。',
  '规则：',
  '1. 结合上下文翻译：代词（it / that / this one）要看上下文确定到底指什么，不要含糊',
  '2. 口语、缩写、拼写错误理顺成通顺中文，但**不要改变意思**',
  '3. 保留原句的语气 —— 客气、催促、道歉、失望、开玩笑，都要在中文里体现出来',
  '4. 每条独立翻译，不要合并、不要串味',
  '5. 只返回 JSON，键是条目的 id，值是中文译文：{"<id>": "<中文>"}',
  '6. 不要解释、不要加前言'
].join('\n');

var AI_ZH2EN_PROMPT = [
  '你在帮一个中国画师写英文回复，对方是 VGen 上的英文客户。',
  '',
  '规则：',
  '1. 译成**自然、口语、礼貌**的英文（日常沟通风格），不要过于正式，不要中式英语',
  '2. 结合对话上下文，代词和指代要清楚，别让客户看不懂你在说哪件事',
  '3. 保留画师原本的语气和意图，**不要加他没说的内容**，不要过度道歉或过度承诺',
  '4. 只输出英文本身，不要引号、不要解释、不要加 "Here is" 这类前言'
].join('\n');

var chatCache = null;     /* { msgId: {en, zh} } */
var chatBusy = false;
var chatPending = false;

/*
 * 自己发出去的消息：英文 => 中文原文。
 *
 * 中译英是你写的，英文我记得；等这条消息在聊天里出现时，直接用它对应的
 * **中文原文**当译文显示 —— 不用再花钱翻回中文，也不会因为往返丢细节。
 */
var sentZh = {};

function loadChatCache() {
  if (chatCache) return chatCache;
  try {
    var o = GM_getValue(CONFIG.KEY.chatCache, null);
    chatCache = (o && typeof o === 'object') ? o : {};
  } catch (e) { chatCache = {}; }
  return chatCache;
}

function saveChatCache() {
  try {
    var c = loadChatCache();
    var keys = Object.keys(c);
    if (keys.length > CHAT_CACHE_MAX) {
      /* 按时间戳砍掉最老的 */
      keys.sort(function (a, b) { return (c[a].t || 0) - (c[b].t || 0); });
      var drop = keys.length - CHAT_CACHE_MAX;
      for (var i = 0; i < drop; i++) delete c[keys[i]];
    }
    GM_setValue(CONFIG.KEY.chatCache, c);
  } catch (e) { /* 忽略 */ }
}

/* 一条消息的正文容器（优先取内层 div；翻过之后用记下来的那个） */
function chatTextBox(li) {
  var inner = li.querySelector(CHAT_TEXT_SEL);
  if (!inner) return null;
  var marked = inner.querySelector('[data-vgenzh-box]');
  if (marked) return marked;
  var kids = inner.children;
  if (kids && kids.length === 1 && kids[0].tagName === 'DIV') return kids[0];
  return inner;
}

/* 收集当前会话的消息（最近 CHAT_MAX 条，已翻过的跳过） */
function collectChatEntries() {
  var lis, out = [];
  try { lis = document.querySelectorAll(CHAT_LI_SEL); } catch (e) { return out; }
  for (var i = 0; i < lis.length; i++) {
    var li = lis[i];
    if (li.getAttribute('data-vgenzh-zh') === '1') continue;   /* 每条只处理一次 */
    var id = li.getAttribute('data-message-id');
    if (!id) continue;
    var box = chatTextBox(li);
    if (!box) continue;
    var txt = (box.textContent || '').replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    out.push({
      id: id,
      li: li,
      box: box,
      text: txt,
      mine: !!li.querySelector('.str-chat__message--me')
    });
  }
  return out.slice(Math.max(0, out.length - CHAT_MAX));
}

/* 中文占比判断：中文字符数 > 英文字母数 → 认为是中文 */
function isMostlyChinese(s) {
  var zh = (String(s).match(/[\u3400-\u9FFF]/g) || []).length;
  var en = (String(s).match(/[A-Za-z]/g) || []).length;
  return zh > 0 && zh >= en;
}

/*
 * 给正文加「中文 + 隐藏原文 + EN 开关」。
 * 标记打在 **li** 上（不是正文 div）：正文下面多了原文块之后，chatTextBox
 * 拿到的节点会变，用 li 做幂等判断才不会重复翻译（这个坑踩过一次）。
 */
function applyChatZh(rec, zh) {
  var li = rec.li, box = rec.box;
  if (!li || !box) return;
  if (li.getAttribute('data-vgenzh-zh') === '1') return;
  li.setAttribute('data-vgenzh-zh', '1');
  box.setAttribute('data-vgenzh-box', '1');

  var en = rec.text;
  box.textContent = zh;
  markTranslated(box);

  var orig = document.createElement('div');
  orig.setAttribute('data-vgenzh-msg-orig', '1');
  orig.setAttribute('data-vgenzh-skip', '1');
  orig.textContent = en;
  if (box.parentNode) box.parentNode.insertBefore(orig, box.nextSibling);

  var bubble = li.querySelector('.str-chat__message-bubble') || box.parentElement;
  if (!bubble) return;
  try { bubble.classList.add('vgenzh-msg-en-host'); } catch (e) { /* 忽略 */ }
  if (bubble.querySelector('.vgenzh-msg-en')) return;   /* 按钮只插一次 */

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vgenzh-msg-en';
  btn.textContent = 'EN';
  btn.title = '展开 / 收起英文原文';
  btn.setAttribute('data-vgenzh-skip', '1');
  btn.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var open = orig.getAttribute('data-open') === '1';
    orig.setAttribute('data-open', open ? '0' : '1');
    btn.textContent = open ? 'EN' : '收起';
  });
  bubble.appendChild(btn);
}

/* 把还没翻的消息送去翻一次 */
function maybeTranslateChat() {
  if (!enabled || !AI.ready() || chatBusy) return;
  var list = collectChatEntries();
  if (!list.length) return;

  var cache = loadChatCache();
  var todo = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.li.getAttribute('data-vgenzh-zh') === '1') continue;
    var hit = cache[r.id];
    if (hit && hit.zh) { applyChatZh(r, hit.zh); continue; }
    /* 自己发出去的消息：直接用当时的中文原文，不再花钱翻回来 */
    var own = sentZh[r.text];
    if (own) {
      applyChatZh(r, own);
      cache[r.id] = { en: r.text, zh: own, t: Date.now() };
      saveChatCache();
      continue;
    }
    if (!HAS_LATIN.test(r.text)) continue;
    todo.push(r);
  }
  if (!todo.length) return;

  chatBusy = true;
  /* 上下文用整段（含已翻的），让模型知道在聊什么 */
  var ctx = list.filter(function (r) { return r.text; })
                .map(function (r) { return { text: r.text, mine: r.mine }; });
  var payload = todo.map(function (r) { return { id: r.id, text: r.text }; });

  AI.translateChat(payload, ctx).then(function (map) {
    var c = loadChatCache();
    var now = Date.now();
    for (var i = 0; i < todo.length; i++) {
      var r = todo[i];
      var zh = map[r.id];
      if (!zh) continue;
      c[r.id] = { en: r.text, zh: zh, t: now };
      applyChatZh(r, zh);
    }
    saveChatCache();
    chatBusy = false;
    if (Object.keys(map).length < todo.length) {
      /* 有没翻出来的，等一下再试一次（避免死循环，只补一次） */
      if (!chatPending) {
        chatPending = true;
        setTimeout(function () { chatPending = false; maybeTranslateChat(); }, 4000);
      }
    }
  }).catch(function () { chatBusy = false; });
}

/* React 受控 textarea 必须用原生 setter 才能让框架感知 */
function setNativeValue(el, value) {
  try {
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  } catch (e) { el.value = value; }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/*
 * 发送拦截：输入框主要是中文 → 拦下来，换成英文，**不发送**。
 * 用户再点一次才真发（此时框里已是英文，识别为英文 → 放行）。
 */
function startChatSendIntercept() {
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button.sendButton');
    if (!btn) return;

    /* 翻译中：直接拦住，避免手快点两下把中文发出去 */
    if (btn.getAttribute('data-vgenzh-busy') === '1') {
      ev.preventDefault(); ev.stopPropagation();
      return;
    }

    var ta = document.querySelector('textarea[data-testid="message-input"]');
    if (!ta) return;
    var v = ta.value || '';
    if (!v.trim()) return;
    if (!isMostlyChinese(v)) return;      /* 主要是英文 → 原样发 */
    if (!AI.ready()) return;

    ev.preventDefault(); ev.stopPropagation();

    var ctx = collectChatEntries().slice(-CHAT_CTX).map(function (r) {
      return { text: (loadChatCache()[r.id] || {}).en || r.text, mine: r.mine };
    });

    btn.setAttribute('data-vgenzh-busy', '1');
    btn.style.opacity = '0.45';
    var hint = btn.getAttribute('title') || '';
    btn.setAttribute('title', '正在译成英文…');

    AI.zhToEn(v, ctx).then(function (en) {
      btn.removeAttribute('data-vgenzh-busy');
      btn.style.opacity = '';
      btn.setAttribute('title', hint);
      if (!en) {
        btn.setAttribute('title', '没译出来，请再点一次或手动改');
        return;
      }
      setNativeValue(ta, en);
      ta.focus();
      /* 记住「英文 => 我原本写的中文」，等这条发出后直接用中文原文显示 */
      try { sentZh[en.trim()] = v; } catch (e2) { /* 忽略 */ }
      /* 不弹任何提示 —— 输入框里变成英文本身就说明没发出去（用户明确要求） */
    }).catch(function () {
      btn.removeAttribute('data-vgenzh-busy');
      btn.style.opacity = '';
      btn.setAttribute('title', hint);
    });
  }, true);
}

function showChatHint(msg) {
  try {
    var old = document.querySelector('.vgenzh-chat-hint');
    if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'vgenzh-chat-hint';
    d.setAttribute('data-vgenzh-skip', '1');
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 3200);
  } catch (e) { /* 忽略 */ }
}
/* 注：showChatHint 目前没有调用点（用户要求：翻译就翻译，别弹提示）。
 * 保留函数是为了以后要加"轻提示"时不用重写，且它自带 skip 标记不会干扰翻译。 */

/*
 * 聊天相关的样式。
 *
 * 关键：**不要写死颜色**。自己的消息是紫色气泡（浅色字），对方是浅灰气泡（深色字），
 * 写死 #777 在紫色上就糊得看不清了。所以原文块和 EN 按钮一律 `color: inherit`
 * + `opacity`，让它们跟着气泡原生的文字颜色走。
 */
var CHAT_CSS =
  '.vgenzh-msg-en-host{position:relative}' +
  /* 极简：无边框无背景，纯文字，继承气泡颜色 */
  '.vgenzh-msg-en{position:absolute;right:0;bottom:-2px;z-index:2;' +
    'font:10px/1 -apple-system,"Segoe UI",sans-serif;padding:0 2px;margin:0;' +
    'border:0;background:transparent;color:inherit;cursor:pointer;' +
    'opacity:.35;transition:opacity .15s;letter-spacing:.5px}' +
  '.vgenzh-msg-en:hover{opacity:.85}' +
  '[data-vgenzh-msg-orig]{display:none;margin-top:3px;padding:2px 0 2px 7px;' +
    'border-left:2px solid currentColor;opacity:.6;color:inherit;' +
    'font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word}' +
  '[data-vgenzh-msg-orig][data-open="1"]{display:block}';

function ensureChatCss() {
  if (document.querySelector('style[data-vgenzh-chat-css]')) return;
  try {
    if (typeof GM_addStyle === 'function') { GM_addStyle(CHAT_CSS); return; }
  } catch (e) { /* 兜底 */ }
  try {
    var s = document.createElement('style');
    s.setAttribute('data-vgenzh-chat-css', '1');
    s.textContent = CHAT_CSS;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) { /* 忽略 */ }
}

/* 聊天页的入口：没有聊天列表时立刻返回 */
function maybeStartChat() {
  if (!enabled) return;
  var ul = document.querySelector('.str-chat__ul');
  if (!ul) return;
  ensureChatCss();
  if (!document.querySelector('button.sendButton')) return;
  maybeTranslateChat();
}

/* ------------------------------------------------- 讨论窗口（提案 + 报价） */

/*
 * 背景资料**不另外维护**：接稿弹窗里已经有全部内容 —— 服务名、价格、
 * 授权档位、参考文件、截止日、客户附加信息、快速计算、服务描述、服务条款。
 * 所以直接读整个弹窗的可见文字当上下文，模型自己分辨。
 * 好处：VGen 改 DOM 也不会立刻失效；坏处：每次讨论多花几千 token（约 1 分钱）。
 *
 * 锚点（真实快照）：
 *   提案标题  [role=dialog] .inputGroupHeader h4.inputGroupTitle（文字为「提案」）
 *   范围输入  [role=dialog] .proposalContainer .scope textarea
 *   委托编号  弹窗文字里的 COMM#XXXX
 */

var DISCUSS_CTX_MAX = 9000;    /* 弹窗文字最多带多少字符 */

var AI_DISCUSS_PROMPT = [
  '你是一个在中国画师和英文客户之间做中介的助手。画师英语不太好，你帮他理清这一单该怎么写、怎么报价。',
  '',
  '给你的资料是 VGen 接稿弹窗里的全部内容：服务信息、客户选择的授权、参考文件、',
  '截止日、客户填的附加信息、快速计算，以及画师自己的服务描述和服务条款。',
  '',
  '工作方式：',
  '1. 用**简体中文**和画师对话，像一个懂行的朋友那样说话，别打官腔',
  '2. 主动指出资料里的矛盾、遗漏、风险（例如：客户说的数量和列出的数量对不上；',
  '   他只买了个人授权但需求看起来像商用；截止日和你的交付周期冲突；条款里写明的',
  '   修改轮数要不要在提案里点一句）',
  '3. 报价只给**区间 + 依据 + 不确定项**，不要给一个斩钉截铁的数字 —— 最终数字画师自己填',
  '4. 不确定的事就问画师，不要自己编客户的意图',
  '5. 回答简短，一次说清一件事；不要一次丢一大段'
].join('\n');

var AI_SCOPE_PROMPT = [
  '你在帮一个中国画师写 VGen 提案里的「范围」（Scope）字段，客户会直接读到这段英文。',
  '',
  '要求：',
  '1. 英文要自然、礼貌、简洁，像母语者写的，不要中式英语',
  '2. 只写"确认范围"该说的话：这单会做什么、有哪些附加项、修改/交付/授权的关键约定',
  '3. 把对话里已经谈定的内容都体现出来，**不要承诺没谈过的东西**',
  '4. 不要写价格（价格在表单别处填）',
  '5. 长度控制在 60-160 个英文单词',
  '6. **只返回 JSON**：{"en": "<英文>", "zh": "<对应的中文，给画师核对用>"}'
].join('\n');

var discussState = null;   /* { key, messages: [{role,content}] } */

/* 当前弹窗的委托编号（COMM#XXXX），用作讨论记录的键 */
function getCommissionKey() {
  try {
    var dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return '';
    var m = (dlg.textContent || '').match(/COMM#[A-Z0-9]{6,}/);
    return m ? m[0] : '';
  } catch (e) { return ''; }
}

/* 把整个弹窗的可见文字压成一段，当讨论的背景资料 */
function collectModalContext() {
  var dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return '';
  var clone;
  try { clone = dlg.cloneNode(true); } catch (e) { return ''; }
  /* 去掉脚本、svg、我们自己的按钮和原文块 */
  var junk = clone.querySelectorAll('script,style,svg,' +
    '[data-vgenzh-field-btn],[data-vgenzh-field-orig],[data-vgenzh-skip]');
  for (var i = 0; i < junk.length; i++) junk[i].remove();
  var t = (clone.innerText || clone.textContent || '')
    .split('\n').map(function (s) { return s.trim(); })
    .filter(function (s) { return s; })
    .join('\n');
  if (t.length > DISCUSS_CTX_MAX) t = t.slice(0, DISCUSS_CTX_MAX) + '\n…（后面还很长，已截断）';
  return t;
}

function loadDiscuss(key) {
  if (discussState && discussState.key === key) return discussState;
  var saved = {};
  try { saved = GM_getValue(CONFIG.KEY.discuss, {}) || {}; } catch (e) { saved = {}; }
  var msgs = (key && saved[key]) ? saved[key] : [];
  discussState = { key: key || '', messages: Array.isArray(msgs) ? msgs : [] };
  return discussState;
}

function saveDiscuss() {
  if (!discussState || !discussState.key) return;
  try {
    var saved = GM_getValue(CONFIG.KEY.discuss, {}) || {};
    saved[discussState.key] = discussState.messages.slice(-40);
    /* 只留最近 8 单，免得存储越滚越大 */
    var keys = Object.keys(saved);
    if (keys.length > 8) { for (var i = 0; i < keys.length - 8; i++) delete saved[keys[i]]; }
    GM_setValue(CONFIG.KEY.discuss, saved);
  } catch (e) { /* 忽略 */ }
}

var DISCUSS_CSS =
  '.vgenzh-dlg-mask{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.38);' +
    'display:flex;align-items:center;justify-content:center}' +
  '.vgenzh-dlg{width:min(760px,94vw);max-height:86vh;display:flex;flex-direction:column;' +
    'background:#fff;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.28);overflow:hidden;' +
    'font:14px/1.6 -apple-system,"Segoe UI","Microsoft YaHei UI",sans-serif;color:#222}' +
  '.vgenzh-dlg-hd{display:flex;align-items:center;justify-content:space-between;' +
    'padding:12px 16px;border-bottom:1px solid #eee;font-weight:600}' +
  '.vgenzh-dlg-hd button{border:0;background:transparent;font-size:18px;cursor:pointer;color:#888;padding:0 4px}' +
  '.vgenzh-dlg-ctx{padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;' +
    'font-size:12px;color:#666;max-height:96px;overflow:auto;white-space:pre-wrap}' +
  '.vgenzh-dlg-body{flex:1;overflow:auto;padding:12px 16px}' +
  '.vgenzh-dlg-msg{margin:0 0 10px;padding:8px 12px;border-radius:10px;white-space:pre-wrap;word-break:break-word}' +
  '.vgenzh-dlg-msg[data-who="me"]{background:#efe8ff;margin-left:56px}' +
  '.vgenzh-dlg-msg[data-who="ai"]{background:#f4f4f5;margin-right:56px}' +
  '.vgenzh-dlg-ftb{border-top:1px solid #eee;padding:10px 16px;background:#fff}' +
  '.vgenzh-dlg-ftb textarea{width:100%;box-sizing:border-box;height:64px;resize:vertical;' +
    'padding:8px 10px;border:1px solid #ddd;border-radius:8px;font:inherit}' +
  '.vgenzh-dlg-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}' +
  '.vgenzh-dlg-row button{padding:6px 12px;border-radius:8px;border:1px solid #ddd;' +
    'background:#fff;cursor:pointer;font:inherit;color:#333}' +
  '.vgenzh-dlg-row button.primary{background:#6c47ff;border-color:#6c47ff;color:#fff}' +
  '.vgenzh-dlg-row button:disabled{opacity:.45;cursor:default}' +
  '.vgenzh-dlg-out{padding:10px 16px;border-top:1px solid #eee;background:#fbfaf6;display:none}' +
  '.vgenzh-dlg-out[data-open="1"]{display:block}' +
  '.vgenzh-dlg-out textarea{width:100%;box-sizing:border-box;height:110px;resize:vertical;' +
    'padding:8px 10px;border:1px solid #ddd;border-radius:8px;font:inherit}' +
  '.vgenzh-dlg-out .zh{margin-top:6px;font-size:12px;color:#666;white-space:pre-wrap}' +
  '.vgenzh-propose-btn{border:0;background:transparent;color:#6c47ff;cursor:pointer;' +
    'font:inherit;font-size:12px;padding:0 0 0 8px;opacity:.85}' +
  '.vgenzh-propose-btn:hover{opacity:1}';

function ensureDiscussCss() {
  if (document.querySelector('style[data-vgenzh-dlg-css]')) return;
  try { if (typeof GM_addStyle === 'function') { GM_addStyle(DISCUSS_CSS); return; } } catch (e) { /* 兜底 */ }
  var s = document.createElement('style');
  s.setAttribute('data-vgenzh-dlg-css', '1');
  s.textContent = DISCUSS_CSS;
  (document.head || document.documentElement).appendChild(s);
}

/* 注：建元素用下面面板里那个 el()，函数声明会提升，顺序无所谓 */

function openDiscussDialog() {
  ensureDiscussCss();
  var old = document.querySelector('.vgenzh-dlg-mask');
  if (old) old.remove();

  var key = getCommissionKey();
  var st = loadDiscuss(key);
  var ctx = collectModalContext();

  var mask = el('div', 'vgenzh-dlg-mask');
  mask.setAttribute('data-vgenzh-skip', '1');
  var dlg = el('div', 'vgenzh-dlg');
  mask.appendChild(dlg);

  /* 头部 */
  var hd = el('div', 'vgenzh-dlg-hd');
  hd.appendChild(el('span', null, '💬 讨论这单' + (key ? '　' + key : '')));
  var closeBtn = el('button', null, '✕');
  hd.appendChild(closeBtn);
  dlg.appendChild(hd);

  /* 背景摘要（可折叠显示前几行） */
  var ctxBox = el('div', 'vgenzh-dlg-ctx');
  ctxBox.textContent = '📋 我已读到的资料（' + ctx.length + ' 字）\n' +
    ctx.split('\n').slice(0, 6).join('\n') + (ctx.length > 200 ? '\n…' : '');
  dlg.appendChild(ctxBox);

  /* 对话区 */
  var body = el('div', 'vgenzh-dlg-body');
  dlg.appendChild(body);

  function renderMsg(who, text) {
    var d = el('div', 'vgenzh-dlg-msg', text);
    d.setAttribute('data-who', who);
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }
  for (var i = 0; i < st.messages.length; i++) {
    renderMsg(st.messages[i].role === 'user' ? 'me' : 'ai', st.messages[i].content);
  }
  if (!st.messages.length) {
    renderMsg('ai', '资料我读到了。你想先聊哪块？比如：\n' +
      '· 这单有没有哪里要先跟客户确认\n' +
      '· 该怎么报价\n' +
      '· 提案的「范围」怎么写');
  }

  /* 输入区 */
  var ft = el('div', 'vgenzh-dlg-ftb');
  var ta = el('textarea');
  ta.placeholder = '用中文说就行，比如「这单我该怎么报价」';
  ft.appendChild(ta);

  var row = el('div', 'vgenzh-dlg-row');
  var sendBtn = el('button', 'primary', '发送');
  var scopeBtn = el('button', null, '生成范围文本');
  var priceBtn = el('button', null, '帮我估价');
  row.appendChild(sendBtn);
  row.appendChild(scopeBtn);
  row.appendChild(priceBtn);
  ft.appendChild(row);
  dlg.appendChild(ft);

  /* 输出区（填范围用） */
  var out = el('div', 'vgenzh-dlg-out');
  var outEn = el('textarea');
  var outZh = el('div', 'zh');
  out.appendChild(el('div', null, '建议填入「范围」的英文（可以直接改）：'));
  out.appendChild(outEn);
  out.appendChild(outZh);
  var outRow = el('div', 'vgenzh-dlg-row');
  var fillBtn = el('button', 'primary', '填入范围');
  outRow.appendChild(fillBtn);
  out.appendChild(outRow);
  dlg.appendChild(out);

  closeBtn.addEventListener('click', function () { mask.remove(); });
  mask.addEventListener('click', function (ev) { if (ev.target === mask) mask.remove(); });

  function setBusy(on) {
    sendBtn.disabled = on; scopeBtn.disabled = on; priceBtn.disabled = on;
    sendBtn.textContent = on ? '…' : '发送';
  }

  function push(who, text) {
    st.messages.push({ role: who === 'me' ? 'user' : 'assistant', content: text });
    renderMsg(who, text);
    saveDiscuss();
  }

  function ask(text) {
    push('me', text);
    setBusy(true);
    AI.discuss(st.messages, ctx).then(function (ans) {
      setBusy(false);
      if (!ans) { renderMsg('ai', '（没拿到回复，再试一次）'); return; }
      push('ai', ans);
    }).catch(function (e) {
      setBusy(false);
      renderMsg('ai', '出错了：' + (e && e.message ? e.message : e));
    });
  }

  sendBtn.addEventListener('click', function () {
    var v = (ta.value || '').trim();
    if (!v || !AI.ready()) return;
    ta.value = '';
    ask(v);
  });

  priceBtn.addEventListener('click', function () {
    if (!AI.ready()) return;
    ask('帮我估这一单的报价：给区间 + 依据 + 不确定项。数字我自己填。');
  });

  scopeBtn.addEventListener('click', function () {
    if (!AI.ready()) return;
    setBusy(true);
    AI.makeScope(st.messages, ctx).then(function (r) {
      setBusy(false);
      if (!r || !r.en) { renderMsg('ai', '（没生成出来，再试一次）'); return; }
      outEn.value = r.en;
      outZh.textContent = '中文对照：' + (r.zh || '（无）');
      out.setAttribute('data-open', '1');
      body.scrollTop = body.scrollHeight;
    }).catch(function (e) {
      setBusy(false);
      renderMsg('ai', '出错了：' + (e && e.message ? e.message : e));
    });
  });

  fillBtn.addEventListener('click', function () {
    var t = document.querySelector('[role="dialog"] .proposalContainer .scope textarea');
    if (!t) { outZh.textContent = '找不到「范围」输入框，可能界面变了'; return; }
    setNativeValue(t, outEn.value || '');
    t.focus();
    fillBtn.textContent = '已填入 ✓';
    setTimeout(function () { fillBtn.textContent = '填入范围'; }, 1800);
  });

  document.body.appendChild(mask);
  ta.focus();
}

/* 在「提案」标题旁挂「讨论这单」入口 */
function maybeInjectProposeButton() {
  if (!enabled) return;
  var dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return;
  if (dlg.querySelector('.vgenzh-propose-btn')) return;
  var hdrs = dlg.querySelectorAll('.inputGroupHeader .inputGroupTitle');
  for (var i = 0; i < hdrs.length; i++) {
    if ((hdrs[i].textContent || '').trim() !== '提案') continue;
    var btn = el('button', 'vgenzh-propose-btn', '💬 讨论这单');
    btn.type = 'button';
    btn.setAttribute('data-vgenzh-skip', '1');
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openDiscussDialog();
    });
    hdrs[i].parentElement.appendChild(btn);
    return;
  }
}

/* --------------------------------------------------------- 在线词库 */

/*
 * 词库也可以直接从网上拉 —— 这样更新词库不用重装脚本、也不用复制粘贴。
 * 默认地址是仓库里的 dist/vgen-dict.json；拉不动就自动退到 jsDelivr 镜像。
 *
 * 默认**不自动检查**（要你手动点，或在菜单里打开自动）。自动检查的间隔是 12 小时，
 * 而且它只写存储、不重翻当前页 —— 下次打开页面才生效，不会突然改你眼前的页面。
 */
var REPO_SLUG = 'takeez/vgen-chinese';
var REPO_BRANCH = 'main';
var DICT_URL_RAW = 'https://raw.githubusercontent.com/' + REPO_SLUG + '/' + REPO_BRANCH + '/dist/vgen-dict.json';
var DICT_URL_CDN = 'https://cdn.jsdelivr.net/gh/' + REPO_SLUG + '@' + REPO_BRANCH + '/dist/vgen-dict.json';
var DICT_CHECK_INTERVAL = 12 * 3600 * 1000;

function fetchText(url) {
  return new Promise(function (resolve, reject) {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('GM_xmlhttpRequest 不可用'));
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      timeout: 30000,
      onload: function (res) {
        if (res.status >= 200 && res.status < 300) resolve(res.responseText);
        else reject(new Error('HTTP ' + res.status));
      },
      onerror: function () { reject(new Error('请求失败')); },
      ontimeout: function () { reject(new Error('请求超时')); }
    });
  });
}

/**
 * 从网址抓词库并写进存储。默认地址失败会自动退到 jsDelivr 镜像。
 * @returns {Promise<{ok:boolean, msg:string}>}
 */
function updateDictFromUrl(url) {
  var primary = String(url || '').trim() || getStored(CONFIG.KEY.dictUrl, DICT_URL_RAW);
  var isDefault = (primary === DICT_URL_RAW);

  return fetchText(primary).then(function (text) {
    var r = applyDictText(text);
    return r.ok ? { ok: true, msg: r.msg + '（来自 GitHub）' } : r;
  }).catch(function (e) {
    if (!isDefault) return { ok: false, msg: '下载失败：' + (e.message || e) };
    return fetchText(DICT_URL_CDN).then(function (text) {
      var r = applyDictText(text);
      return r.ok ? { ok: true, msg: r.msg + '（来自 jsDelivr 镜像）' } : r;
    }).catch(function (e2) {
      return {
        ok: false,
        msg: '两个地址都没拉到 —— GitHub：' + (e.message || e) +
             '　/　jsDelivr：' + (e2.message || e2)
      };
    });
  });
}

/* 自动检查：默认关，而且是"静默写存储"，下次打开页面才生效 */
function autoCheckDictUpdate() {
  if (getStored(CONFIG.KEY.dictAuto, false) !== true) return;
  var last = getStored(CONFIG.KEY.dictChecked, 0);
  if (typeof last === 'number' && Date.now() - last < DICT_CHECK_INTERVAL) return;
  setStored(CONFIG.KEY.dictChecked, Date.now());
  updateDictFromUrl().then(function (r) {
    if (CONFIG.DEV) console.log('[vgenzh] 自动检查词库：' + (r.ok ? r.msg : '未更新 / ' + r.msg));
  });
}

/* ------------------------------------------------------- 词库更新面板 */

/*
 * 为什么要有这个面板：篡改猴**没有读取剪贴板的 API**（只有 GM_setClipboard）。
 * 在菜单命令的处理器里调 navigator.clipboard.readText() 是不行的 ——
 * 那个"用户手势"发生在扩展的菜单里，不在页面里，浏览器会拒绝。
 * 所以菜单只负责把面板打开，真正读剪贴板的是**面板上那个按钮**，
 * 它的点击是页面内的用户手势，readText() 才被允许。
 */

var PANEL_CSS = [
  '.vgenzh-panel{position:fixed;z-index:2147483000;right:20px;bottom:20px;width:430px;',
  'max-width:calc(100vw - 40px);background:#161b22;color:#e6edf3;border:1px solid #30363d;',
  'border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.5);',
  'font:13px/1.6 "Segoe UI",system-ui,sans-serif;overflow:hidden}',
  '.vgenzh-panel .hd{display:flex;align-items:center;justify-content:space-between;',
  'padding:10px 14px;background:#21262d;border-bottom:1px solid #30363d;font-weight:600}',
  '.vgenzh-panel .hd button{background:none;border:0;color:#8b949e;cursor:pointer;font-size:15px}',
  '.vgenzh-panel .bd{padding:12px 14px}',
  '.vgenzh-panel .info{color:#8b949e;margin-bottom:10px}',
  '.vgenzh-panel .info b{color:#e6edf3}',
  '.vgenzh-panel .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}',
  '.vgenzh-panel button.act{background:#238636;color:#fff;border:0;border-radius:6px;',
  'padding:7px 13px;cursor:pointer;font-size:13px}',
  '.vgenzh-panel button.act.sec{background:#30363d;color:#e6edf3}',
  '.vgenzh-panel button.act:disabled{opacity:.5;cursor:default}',
  '.vgenzh-panel .stat{min-height:20px;font-size:12px;word-break:break-all}',
  '.vgenzh-panel .ok{color:#3fb950}',
  '.vgenzh-panel .err{color:#f85149}',
  '.vgenzh-panel details{margin-top:10px;border-top:1px solid #30363d;padding-top:8px}',
  '.vgenzh-panel summary{cursor:pointer;color:#8b949e}',
  '.vgenzh-panel textarea{width:100%;height:110px;margin-top:8px;background:#0d1117;',
  'color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:8px;',
  'font:12px/1.5 Consolas,monospace;box-sizing:border-box;resize:vertical}',
  '.vgenzh-panel input{width:100%;margin-top:6px;background:#0d1117;color:#e6edf3;',
  'border:1px solid #30363d;border-radius:6px;padding:6px 8px;font-size:12px;box-sizing:border-box}',
  '.vgenzh-panel label{display:block;color:#8b949e;font-size:11px;margin-top:8px}',
  /* 自助翻译模式 */
  '.vgenzh-hl{outline:2px solid #f0883e !important;outline-offset:1px;cursor:crosshair !important}',
  '.vgenzh-xlate{position:fixed;z-index:2147483001;width:350px;background:#161b22;color:#e6edf3;',
  'border:1px solid #f0883e;border-radius:8px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.55);',
  'font:13px/1.6 "Segoe UI",system-ui,sans-serif}',
  '.vgenzh-xlate .en{color:#8b949e;font-size:12px;word-break:break-word;max-height:62px;overflow:auto;margin-bottom:6px}',
  '.vgenzh-xlate input{width:100%;box-sizing:border-box;background:#0d1117;color:#e6edf3;',
  'border:1px solid #30363d;border-radius:6px;padding:6px 8px;font-size:13px}',
  '.vgenzh-xlate .row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
  '.vgenzh-xlate button{background:#238636;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px}',
  '.vgenzh-xlate button.sec{background:#30363d}',
  '.vgenzh-xlate button.warn{background:#8b2c22}',
  '.vgenzh-xlate .tip{color:#8b949e;font-size:11px;margin-top:6px}'
].join('');

function injectPanelCss() {
  if (document.querySelector('style[data-vgenzh-panel-css]')) return;
  var s = document.createElement('style');
  s.setAttribute('data-vgenzh-panel-css', '1');
  s.textContent = PANEL_CSS;
  (document.head || document.documentElement).appendChild(s);
}

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * 把一段词库文本灌进篡改猴存储。
 * 接受两种格式：{v,count,terms:{...}} 或裸的 {英文: 中文, ...}
 * @returns {{ok:boolean, msg:string}}
 */
function applyDictText(text) {
  var raw = String(text || '').trim();
  if (!raw) return { ok: false, msg: '内容是空的' };

  var data;
  try { data = JSON.parse(raw); }
  catch (e) { return { ok: false, msg: '不是合法 JSON：' + e.message }; }

  var map = (data && typeof data === 'object' && data.terms && typeof data.terms === 'object')
    ? data.terms
    : data;

  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return { ok: false, msg: '结构不对，应该是 {英文: 中文} 的对象' };
  }

  var clean = {};
  var n = 0;
  for (var k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    var v = map[k];
    if (typeof v !== 'string' || v.trim() === '') continue;
    clean[k] = v;
    n++;
  }

  /* 防呆：明显少于内置词库就不接受，免得把词库写坏 */
  var seedCount = 0;
  for (var sk in SEED_TERMS) { if (Object.prototype.hasOwnProperty.call(SEED_TERMS, sk)) seedCount++; }
  if (n < 500) return { ok: false, msg: '只解析出 ' + n + ' 条，太少了（内置有 ' + seedCount + ' 条），已拒绝。' };

  try {
    GM_setValue(CONFIG.KEY.terms, clean);
    GM_setValue(CONFIG.KEY.termsVer, (data && data.v ? data.v + ' ' : '') + new Date().toLocaleString());
  } catch (e) {
    return { ok: false, msg: '写入篡改猴存储失败：' + e.message };
  }
  return { ok: true, msg: '已写入 ' + n + ' 条词库，刷新页面生效。' };
}

function clearStoredDict() {
  try {
    GM_setValue(CONFIG.KEY.terms, null);
    GM_setValue(CONFIG.KEY.termsVer, null);
    return { ok: true, msg: '已恢复内置词库，刷新页面生效。' };
  } catch (e) {
    return { ok: false, msg: '失败：' + e.message };
  }
}

function openDictPanel() {
  var old = document.querySelector('.vgenzh-panel');
  if (old) old.remove();

  injectPanelCss();

  var panel = el('div', 'vgenzh-panel');
  panel.setAttribute('data-vgenzh-skip', '1');

  var hd = el('div', 'hd');
  hd.appendChild(el('span', null, 'VGen 中文化 · 词库更新'));
  var closeBtn = el('button', null, '✕');
  closeBtn.title = '关闭';
  closeBtn.addEventListener('click', function () { panel.remove(); });
  hd.appendChild(closeBtn);

  var bd = el('div', 'bd');

  var curCount = Object.keys(TERMS).length;
  var info = el('div', 'info');
  info.appendChild(el('span', null, '生效词条：'));
  info.appendChild(el('b', null, String(curCount)));
  info.appendChild(el('span', null, ' 条（主词库 ' +
    (TERMS_SOURCE === 'stored' ? '存储' : '内置') + ' + 自订 ' + Object.keys(USER_TERMS).length + '）'));
  info.appendChild(el('br'));
  info.appendChild(el('span', null, '忽略名单：' + IGNORE_TERMS.size + ' 条　·　更新于：' + TERMS_VERSION));
  bd.appendChild(info);

  var row = el('div', 'row');
  var readBtn = el('button', 'act', '📥 从剪贴板读取并更新');
  var resetBtn = el('button', 'act sec', '♻️ 恢复内置词库');
  row.appendChild(readBtn);
  row.appendChild(resetBtn);
  bd.appendChild(row);

  var row2 = el('div', 'row');
  var expUserBtn = el('button', 'act sec', '✏️ 导出我的自订词条（' + Object.keys(USER_TERMS).length + '）');
  var impIgnoreBtn = el('button', 'act sec', '🚫 从剪贴板导入忽略名单');
  row2.appendChild(expUserBtn);
  row2.appendChild(impIgnoreBtn);
  bd.appendChild(row2);

  /* ---------------- 在线词库 ---------------- */
  var webBox = el('details');
  webBox.appendChild(el('summary', null, '🌐 在线词库（直接从 GitHub 更新，不用复制粘贴）'));

  webBox.appendChild(el('label', null, '词库地址'));
  var urlInput = el('input');
  urlInput.type = 'text';
  urlInput.value = getStored(CONFIG.KEY.dictUrl, DICT_URL_RAW);
  webBox.appendChild(urlInput);

  var webRow = el('div', 'row');
  webRow.style.marginTop = '10px';
  var fetchBtn = el('button', 'act', '🌐 立即更新');
  var resetUrlBtn = el('button', 'act sec', '恢复默认地址');
  webRow.appendChild(fetchBtn);
  webRow.appendChild(resetUrlBtn);
  webBox.appendChild(webRow);

  var autoWrap = el('label', null, '');
  autoWrap.style.marginTop = '10px';
  var autoChk = el('input');
  autoChk.type = 'checkbox';
  autoChk.checked = getStored(CONFIG.KEY.dictAuto, false) === true;
  autoChk.style.width = 'auto';
  autoChk.style.marginRight = '6px';
  autoChk.style.verticalAlign = 'middle';
  autoWrap.appendChild(autoChk);
  autoWrap.appendChild(document.createTextNode('启动时自动检查（12 小时一次；静默写入，下次打开页面才生效）'));
  webBox.appendChild(autoWrap);

  bd.appendChild(webBox);

  fetchBtn.addEventListener('click', function () {
    setStored(CONFIG.KEY.dictUrl, urlInput.value.trim());
    setStat({ ok: true, msg: '下载中…' });
    updateDictFromUrl(urlInput.value).then(function (r) { setStat(r); });
  });

  resetUrlBtn.addEventListener('click', function () {
    urlInput.value = DICT_URL_RAW;
    setStored(CONFIG.KEY.dictUrl, DICT_URL_RAW);
    setStat({ ok: true, msg: '已恢复默认地址' });
  });

  autoChk.addEventListener('change', function () {
    setStored(CONFIG.KEY.dictAuto, autoChk.checked);
    setStat({
      ok: true,
      msg: autoChk.checked ? '已开启：启动时自动检查词库更新（12 小时一次）' : '已关闭自动检查'
    });
  });

  /* ---------------- API 翻译配置 ---------------- */
  var aiBox = el('details');
  aiBox.appendChild(el('summary', null, '🤖 API 翻译' + (AI.ready() ? '（已配置：' + AI.model + '）' : '（未配置）')));

  aiBox.appendChild(el('label', null, '端点 URL（OpenAI 兼容接口）'));
  var epInput = el('input');
  epInput.type = 'text';
  epInput.value = AI.endpoint;
  epInput.setAttribute('placeholder', AI_DEFAULT_ENDPOINT);
  aiBox.appendChild(epInput);

  aiBox.appendChild(el('label', null, 'API 密钥（只存在篡改猴本地存储）'));
  var keyInput = el('input');
  keyInput.type = 'password';
  keyInput.value = AI.apiKey;
  keyInput.setAttribute('placeholder', 'sk-...');
  aiBox.appendChild(keyInput);

  aiBox.appendChild(el('label', null, '模型名'));
  var modelInput = el('input');
  modelInput.type = 'text';
  modelInput.value = AI.model;
  modelInput.setAttribute('placeholder', AI_DEFAULT_MODEL);
  aiBox.appendChild(modelInput);

  var aiRow = el('div', 'row');
  aiRow.style.marginTop = '10px';
  var saveCfgBtn = el('button', 'act sec', '保存配置');
  var cfgImpBtn = el('button', 'act sec', '📋 从剪贴板读配置');
  var testBtn = el('button', 'act sec', '测试连接');
  aiRow.appendChild(saveCfgBtn);
  aiRow.appendChild(cfgImpBtn);
  aiRow.appendChild(testBtn);
  aiBox.appendChild(aiRow);
  bd.appendChild(aiBox);

  cfgImpBtn.addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setStat({ ok: false, msg: '这个浏览器不支持读取剪贴板，请手动填。' });
      return;
    }
    navigator.clipboard.readText().then(function (txt) {
      var c;
      try { c = JSON.parse(txt); }
      catch (e) { setStat({ ok: false, msg: '剪贴板内容不是合法 JSON' }); return; }
      if (!c || typeof c !== 'object') { setStat({ ok: false, msg: '剪贴板内容格式不对' }); return; }
      AI.configure(c.endpoint, c.key || c.apiKey || '', c.model);
      epInput.value = AI.endpoint;
      keyInput.value = AI.apiKey;
      modelInput.value = AI.model;
      setStat({
        ok: !!AI.apiKey,
        msg: AI.apiKey
          ? '已从剪贴板读取：' + AI.model + '　·　密钥长度 ' + AI.apiKey.length
          : '读到了地址和模型，但没找到密钥字段（key / apiKey）'
      });
    }).catch(function (e) {
      setStat({ ok: false, msg: '读剪贴板被拒绝（' + (e && e.name ? e.name : e) + '），请手动填。' });
    });
  });

  saveCfgBtn.addEventListener('click', function () {
    AI.configure(epInput.value, keyInput.value, modelInput.value);
    setStat({ ok: true, msg: '配置已保存：' + AI.model + '　·　' + AI.endpoint });
  });

  testBtn.addEventListener('click', function () {
    AI.configure(epInput.value, keyInput.value, modelInput.value);
    setStat({ ok: true, msg: '测试中…' });
    AI.translate('Save draft').then(function (zh) {
      if (zh) setStat({ ok: true, msg: '✅ 连接正常，试译 “Save draft” → “' + zh + '”' });
      else setStat({ ok: false, msg: '接口通了，但译文没通过校验（可能返回了英文或格式不对）' });
    }).catch(function (e) {
      setStat({ ok: false, msg: '❌ ' + (e.message || e) });
    });
  });

  var stat = el('div', 'stat');
  bd.appendChild(stat);

  var setStat = function (res) {
    stat.className = 'stat ' + (res.ok ? 'ok' : 'err');
    stat.textContent = (res.ok ? '✅ ' : '❌ ') + res.msg;
  };

  readBtn.addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setStat({ ok: false, msg: '这个浏览器不支持读取剪贴板，请用下面的手动粘贴。' });
      return;
    }
    stat.className = 'stat';
    stat.textContent = '读取中…';
    navigator.clipboard.readText().then(function (text) {
      setStat(applyDictText(text));
    }).catch(function (e) {
      setStat({ ok: false, msg: '读剪贴板被拒绝（' + (e && e.name ? e.name : e) + '），请用下面的手动粘贴。' });
    });
  });

  resetBtn.addEventListener('click', function () {
    setStat(clearStoredDict());
  });

  expUserBtn.addEventListener('click', exportUserTerms);

  impIgnoreBtn.addEventListener('click', function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setStat({ ok: false, msg: '这个浏览器不支持读取剪贴板，请用下面的手动粘贴。' });
      return;
    }
    stat.className = 'stat';
    stat.textContent = '读取中…';
    navigator.clipboard.readText().then(function (text) {
      var n = importIgnoreFromText(text);
      setStat({ ok: true, msg: '已加入忽略名单 ' + n + ' 条（名单现有 ' + IGNORE_TERMS.size + ' 条）。以后既不收集、也不会出现在导出里。' });
    }).catch(function (e) {
      setStat({ ok: false, msg: '读剪贴板被拒绝（' + (e && e.name ? e.name : e) + '），请用下面的手动粘贴。' });
    });
  });

  /* 兜底：手动粘贴。剪贴板权限被拒、或想直接贴 JSON 时用 */
  var det = el('details');
  det.appendChild(el('summary', null, '剪贴板读不了？点这里手动粘贴'));
  var ta = el('textarea');
  ta.setAttribute('placeholder', '把词库 JSON 粘到这里…');
  var saveBtn = el('button', 'act sec', '保存这段内容');
  saveBtn.style.marginTop = '8px';
  saveBtn.addEventListener('click', function () {
    setStat(applyDictText(ta.value));
  });
  var saveIgnoreBtn = el('button', 'act sec', '作为忽略名单导入');
  saveIgnoreBtn.style.marginTop = '8px';
  saveIgnoreBtn.style.marginLeft = '8px';
  saveIgnoreBtn.addEventListener('click', function () {
    var n = importIgnoreFromText(ta.value);
    setStat({ ok: true, msg: '已加入忽略名单 ' + n + ' 条（名单现有 ' + IGNORE_TERMS.size + ' 条）。' });
  });
  det.appendChild(ta);
  det.appendChild(saveBtn);
  det.appendChild(saveIgnoreBtn);
  bd.appendChild(det);

  panel.appendChild(hd);
  panel.appendChild(bd);
  (document.body || document.documentElement).appendChild(panel);
}

/* ------------------------------------------------------------- 菜单 */

var menuIds = {};
var lastMissedShown = -1;

function reg(key, label, fn) {
  try {
    /* 同一个 key 重新注册前先注销旧项，否则菜单里会越堆越多 */
    if (typeof GM_unregisterMenuCommand === 'function' && menuIds[key] !== undefined) {
      try { GM_unregisterMenuCommand(menuIds[key]); } catch (e) { /* 忽略 */ }
    }
    var id = GM_registerMenuCommand(label, fn);
    if (id !== undefined) menuIds[key] = id;
  } catch (e) { /* 忽略 */ }
}

/*
 * 菜单标签是注册时固定的，不会自己变。
 * 所以条数变了就重新注册一次「导出」那一项，这样不用刷新页面也能看到实时条数。
 */
function refreshMissedMenu(force) {
  if (!force && missed.size === lastMissedShown) return;
  lastMissedShown = missed.size;
  reg('export', '📋 导出未命中词条（' + missed.size + '）', exportMissed);
}

function setupMenu() {
  reg('toggle', (enabled ? '✅' : '⛔') + ' VGen 中文化：' + (enabled ? '已开启' : '已关闭') + '（点击切换）', function () {
    setStored(CONFIG.KEY.enabled, !enabled);
    location.reload();
  });

  reg('regex', (regexOn ? '✅' : '⛔') + ' 正则翻译：' + (regexOn ? '开' : '关') + '（点击切换）', function () {
    setStored(CONFIG.KEY.regex, !regexOn);
    location.reload();
  });

  reg('font', (fontFixOn ? '✅' : '⛔') + ' 中文字体修正：' + (fontFixOn ? '开' : '关') + '（点击切换）', function () {
    setStored(CONFIG.KEY.font, !fontFixOn);
    location.reload();
  });

  reg('dict', '📥 更新词库（当前 ' + Object.keys(TERMS).length + ' 条）', openDictPanel);

  reg('xlate', (xlateModeOn ? '✏️' : '⭕') + ' 自助翻译模式：' +
    (xlateModeOn ? '已开启（点页面上的英文来翻译）' : '已关闭'),
    function () { setTranslateMode(!xlateModeOn); });

  refreshMissedMenu(true);

  reg('clear', '🧹 清空未命中记录', function () {
    missed.clear();
    flushMissed(true);
    refreshMissedMenu(true);
    alert('已清空。');
  });

  reg('rescan', '🔄 重新扫描当前页面', function () {
    pending.clear();
    translate(document.body);
    translateTitle();
  });

  reg('status', '📊 显示状态', function () {
    alert(
      'VGen 中文化 ' + VERSION + '\n' +
      '词条数：' + Object.keys(TERMS).length + '（' + (TERMS_SOURCE === 'stored' ? '篡改猴存储' : '脚本内置') + '）\n' +
      '词库更新于：' + TERMS_VERSION + '\n' +
      '正则规则：' + REGEX_RULES.length + '\n' +
      '未命中：' + missed.size + '\n' +
      '启用：' + enabled + ' / 正则：' + regexOn + ' / 字体修正：' + fontFixOn + '\n' +
      'AI 接口：' + (AI.ready() ? '已配置' : '未配置（占位，未实现）')    );
  });

  /* 让「导出」那一项的条数保持实时 */
  setInterval(function () {
    if (enabled) refreshMissedMenu(false);
  }, 4000);
}

/* ==========================================================================
 * API 翻译（OpenAI 兼容端点，默认 DeepSeek）
 *
 * 一开始留的那个空壳就是给这个用的，现在填上。
 * 跨域不受限，走 GM_xmlhttpRequest。
 *
 *   AI.translate(text)         单条
 *   AI.translateBatch(items)   批量（一次几十条，省 token 也省时间）
 *   AI.configure(endpoint,key,model)
 * ========================================================================== */

var AI_DEFAULT_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
var AI_DEFAULT_MODEL = 'deepseek-chat';
var AI_BATCH_SIZE = 40;

var AI_SYSTEM_PROMPT = [
  '你是 VGen（画师委托平台 vgen.co）界面的简体中文本地化译者。',
  '',
  '输入是一批英文界面文案，你要输出**一个 JSON 对象**：键是英文原文（一字不差），值是简体中文译文。',
  '',
  '硬性规则：',
  '1. 只输出 JSON，不要 markdown 围栏、不要解释、不要任何多余文字。',
  '2. 键必须与输入完全一致（大小写、空格、标点都一样），不要漏条。',
  '3. 只做翻译：不扩写、不加注释、不改动原意。',
  '4. 品牌与专有名词保持原样：VGen、PayPal、Stripe、Discord、Twitch、Twitter、YouTube、Patreon、Live2D、VRChat、VRoid、PNGtuber、GIFtuber、VTuber、Figma、Canva、Blender、Minecraft、SketchUp、Unity、VSONA、YCH、NSFW、OC、USD。',
  '5. 占位符与变量原样保留（如 {count}、%s、{{name}}）。',
  '6. 界面按钮与标签尽量短；说明性长句译通顺即可。',
  '7. 给了 glossary 就必须优先采用 glossary 里的译法，保持术语一致。',
  '8. 中文标点用全角；原文末尾没有句号就不要加。'
].join('\n');

/* 兜底核心术语：无论什么语境都带上，保证最基本的译法统一 */
var AI_CORE_GLOSSARY = {
  'Service': '服务', 'Product': '商品', 'Commission': '委托', 'Order': '订单',
  'Shop': '商店', 'License': '授权', 'Portfolio': '作品集', 'Showcase': '作品集展示',
  'Artist': '画师', 'Client': '客户', 'Request': '请求', 'Proposal': '提案',
  'Delivery': '交付', 'Revision': '修改', 'Discount': '折扣', 'Bundle': '套餐',
  'Wallet': '钱包', 'Payout': '提现', 'Invoice': '发票', 'Draft': '草稿',
  'Settings': '设置', 'Profile': '个人资料', 'Notification': '通知',
  'Sensitive Content': '敏感内容', 'Mature content': '成人内容'
};

/* 译文体检：模型偶尔漏翻、加戏、原样返回，这里全挡掉 */
function validTranslation(en, zh) {
  if (typeof zh !== 'string') return false;
  var v = zh.trim();
  if (!v) return false;
  if (v === en) return false;
  if (v.length > 200) return false;
  if (/[\r\n]/.test(v)) return false;
  if (!/[\u3400-\u9FFF\uF900-\uFAFF]/.test(v)) return false;    /* 必须含汉字 */
  if (/^(翻译|译文|中文|translation)\s*[:：]/i.test(v)) return false;
  return true;
}

/*
 * 长文本校验（客户填的附加信息 / 需求描述）。
 * 和 validTranslation 的区别：**允许换行、允许长** —— 那段本来就是多行分条的。
 * 仍然挡掉：和原文一样、不含汉字、模型加前言、离谱地长（说明它在加戏）。
 */
function validLongTranslation(en, zh) {
  if (typeof zh !== 'string') return false;
  var v = zh.trim();
  if (!v) return false;
  if (v === en) return false;
  if (v.length > String(en).length * 5 + 500) return false;
  if (!/[\u3400-\u9FFF\uF900-\uFAFF]/.test(v)) return false;
  if (/^(翻译|译文|中文|translation)\s*[:：]/i.test(v)) return false;
  return true;
}

/*
 * 长文本翻译的提示词。
 *
 * 特意**不内置"作品专有名词表"** —— 模型本身认识赛马娘 / 原神 / 明日方舟这些
 * 角色，直接要求它用中文官方译名，比我们硬编码一张永远不全的表可靠得多。
 *
 * 第 3、4 条是实测出来的（拿真实委托需求对比过新旧输出）：
 *   · "5 separate icons" 会被逐词直译成「5 把…分开画」，数字挂句首，中文不通
 *   · "a deredere" 会被译成「恋爱脑」，意思完全错（应为黏人撒娇）
 *   · "shes an oldie" 会被译成「老派的人」（应为老一辈/老资历）
 */
var AI_FIELD_PROMPT = [
  '你把英文翻译成简体中文，读者是英语不太好的中国画师。这是一份委托需求说明。',
  '',
  '规则：',
  '1. 逐句对应，**保留原有的换行和分条结构**（客户写了几行就是几行，不要合并成一段）',
  '2. 人名 / 角色名 / 作品名用中文通译名：知名作品（赛马娘、原神、明日方舟等）里的角色，',
  '   用该作品的中文官方译名，不要音译（Gold Ship → 黄金船，不是"金船"）',
  '3. **按中文语序重写，不要逐词直译**。特别是数量表达：',
  '   "5 separate icons" 要说"把参考图分成 5 个单独的图标来画"，',
  '   不要写成"5 把……画"这种数字挂句首的句子',
  '4. **日语借词按意思翻成中文描述，不要用网络梗**：',
  '   deredere = 表面上端着、私下很黏人撒娇（不是"恋爱脑"）',
  '   tsundere = 傲娇；yandere = 病娇；kuudere = 高冷',
  '   oldie = 老一辈 / 老资历（不是"老派的人"）',
  '5. 客户的口语、缩写可以理顺成通顺中文，但不要改意思、不要补他没说的内容',
  '6. 不要省略、不要总结、不要加解释、不要加"以下是译文"这类前言',
  '7. 只输出译文本身'
].join('\n');

/*
 * 从**现有词库**里挑出跟这批文案相关的术语喂给模型，
 * 这样它会沿用我们已经定下的译法，而不是自己另起一套。
 */
function pickGlossary(items) {
  var lower = (' ' + items.join(' \n ') + ' ').toLowerCase();
  var out = {};
  var n = 0;
  for (var k in TERMS) {
    if (!Object.prototype.hasOwnProperty.call(TERMS, k)) continue;
    if (n >= 60) break;
    if (k.length < 4 || k.length > 40) continue;
    if (lower.indexOf(k.toLowerCase()) < 0) continue;
    out[k] = TERMS[k];
    n++;
  }
  for (var g in AI_CORE_GLOSSARY) {
    if (Object.prototype.hasOwnProperty.call(AI_CORE_GLOSSARY, g) &&
        !Object.prototype.hasOwnProperty.call(out, g)) {
      out[g] = AI_CORE_GLOSSARY[g];
    }
  }
  return out;
}

/* 模型可能把 JSON 包在 ```json 里，或前后加话，这里尽量抠出来 */
function parseBatchResult(raw, items) {
  var s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  var first = s.indexOf('{');
  var last = s.lastIndexOf('}');
  if (first >= 0 && last > first) s = s.slice(first, last + 1);

  var obj;
  try { obj = JSON.parse(s); }
  catch (e) { return { ok: {}, bad: items.slice(), error: '返回不是合法 JSON' }; }

  var ok = {};
  var bad = [];
  for (var i = 0; i < items.length; i++) {
    var en = items[i];
    var zh = obj[en];
    if (zh === undefined) {
      /* 有些模型会改大小写或带尾空格，宽松找一次 */
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        if (k.trim().toLowerCase() === en.trim().toLowerCase()) { zh = obj[k]; break; }
      }
    }
    if (validTranslation(en, zh)) ok[en] = String(zh).trim();
    else bad.push(en);
  }
  return { ok: ok, bad: bad, error: null };
}

var AI = {
  endpoint: getStored(CONFIG.KEY.aiEndpoint, AI_DEFAULT_ENDPOINT),
  /* 密钥只从篡改猴存储读 —— 绝不打进产物，因为产物是要公开的 */
  apiKey: getStored(CONFIG.KEY.aiKey, ''),
  model: getStored(CONFIG.KEY.aiModel, AI_DEFAULT_MODEL),

  ready: function () { return !!this.endpoint && !!this.apiKey; },

  configure: function (endpoint, key, model) {
    this.endpoint = String(endpoint || '').trim() || AI_DEFAULT_ENDPOINT;
    this.apiKey = String(key || '').trim();
    this.model = String(model || '').trim() || AI_DEFAULT_MODEL;
    setStored(CONFIG.KEY.aiEndpoint, this.endpoint);
    setStored(CONFIG.KEY.aiKey, this.apiKey);
    setStored(CONFIG.KEY.aiModel, this.model);
  },

  /* 底层请求：返回模型输出的纯文本 */
  request: function (messages) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.ready()) { reject(new Error('还没配置 API 端点或密钥')); return; }
      if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest 不可用')); return; }
      GM_xmlhttpRequest({
        method: 'POST',
        url: self.endpoint,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + self.apiKey
        },
        data: JSON.stringify({
          model: self.model,
          messages: messages,
          temperature: 0.2,
          stream: false
        }),
        timeout: 120000,
        onload: function (res) {
          var data;
          try { data = JSON.parse(res.responseText); }
          catch (e) { reject(new Error('接口返回的不是合法 JSON（HTTP ' + res.status + '）')); return; }
          if (data && data.error) {
            reject(new Error('接口报错：' + (data.error.message || JSON.stringify(data.error))));
            return;
          }
          var txt = data && data.choices && data.choices[0] &&
                    data.choices[0].message && data.choices[0].message.content;
          if (typeof txt !== 'string') { reject(new Error('接口没有返回内容')); return; }
          resolve(txt);
        },
        onerror: function () { reject(new Error('请求失败（网络不通或被拦）')); },
        ontimeout: function () { reject(new Error('请求超时')); }
      });
    });
  },

  /** 单条翻译。返回 Promise<string|null>（null = 没通过校验） */
  translate: function (text) {
    return this.request([
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: '只翻译下面这一条，直接输出中文译文本身，不要引号、不要解释：\n' + text }
    ]).then(function (out) {
      var zh = String(out).trim().replace(/^```[\s\S]*?\n/, '').replace(/```\s*$/, '').trim();
      zh = zh.replace(/^["'「『]+/, '').replace(/["'」』]+$/, '').trim();
      return validTranslation(text, zh) ? zh : null;
    });
  },

  /** 批量翻译。返回 Promise<{ok:{en:zh}, bad:string[], error:string|null}> */
  translateBatch: function (items) {
    var user = JSON.stringify({ glossary: pickGlossary(items), items: items });
    return this.request([
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: user }
    ]).then(function (raw) { return parseBatchResult(raw, items); });
  },

  /**
   * 长文本翻译：客户填的附加信息 / 需求描述这类自由文本。
   * 词库永远覆盖不了它们，只能走 AI。返回 Promise<string|null>
   */
  translateField: function (text) {
    var src = String(text || '');
    if (!src.trim()) return Promise.resolve(null);
    var self = this;
    return this.request([
      { role: 'system', content: AI_FIELD_PROMPT },
      { role: 'user', content: src }
    ]).then(function (out) {
      var zh = String(out).trim().replace(/^```[\s\S]*?\n/, '').replace(/```\s*$/, '').trim();
      return validLongTranslation(src, zh) ? zh : null;
    });
  },

  /**
   * 批量翻译聊天消息（带上下文）。
   * @param {Array<{id,text}>} entries 要翻的条目
   * @param {Array<{text,mine}>} context 作为背景的整段对话原文
   * @returns {Promise<Object>} {id: 中文}
   */
  translateChat: function (entries, context) {
    if (!entries || !entries.length) return Promise.resolve({});
    var ctx = (context || []).map(function (m) {
      return (m.mine ? '我: ' : '客户: ') + m.text;
    }).join('\n');
    var user = '【对话上下文，按时间顺序，仅供参考】\n' + (ctx || '（无）') +
               '\n\n【需要翻译的条目】\n' + JSON.stringify(entries);
    return this.request([
      { role: 'system', content: AI_CHAT_PROMPT },
      { role: 'user', content: user }
    ]).then(function (raw) {
      var s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a < 0 || b < a) return {};
      var obj;
      try { obj = JSON.parse(s.slice(a, b + 1)); } catch (e) { return {}; }
      var out = {};
      for (var i = 0; i < entries.length; i++) {
        var id = entries[i].id;
        var zh = obj[id];
        if (typeof zh === 'string' && zh.trim() && /[\u3400-\u9FFF]/.test(zh)) out[id] = zh.trim();
      }
      return out;
    });
  },

  /** 中文 → 英文（带上下文）。返回 Promise<string|null> */
  zhToEn: function (text, context) {
    var src = String(text || '');
    if (!src.trim()) return Promise.resolve(null);
    var ctx = (context || []).map(function (m) {
      return (m.mine ? '我: ' : '客户: ') + m.text;
    }).join('\n');
    return this.request([
      { role: 'system', content: AI_ZH2EN_PROMPT },
      { role: 'user', content: '【对话上下文】\n' + (ctx || '（无）') + '\n\n【我要说的话（中文）】\n' + src }
    ]).then(function (out) {
      var en = String(out).trim().replace(/^```[\s\S]*?\n/, '').replace(/```\s*$/, '').trim();
      en = en.replace(/^["'「『]+/, '').replace(/["'」』]+$/, '').trim();
      if (!en || !/[A-Za-z]/.test(en)) return null;
      if (/[\u3400-\u9FFF]/.test(en)) return null;    /* 还带中文 = 没译完 */
      return en;
    });
  },

  /**
   * 讨论（多轮）。history = [{role:'user'|'assistant', content}]。
   * context 是接稿弹窗里的全部可见文字，作为 system 的第二段。
   */
  discuss: function (history, context) {
    var msgs = [{
      role: 'system',
      content: AI_DISCUSS_PROMPT + '\n\n【这一单的全部资料】\n' + (context || '（没读到弹窗资料）')
    }];
    var h = (history || []).slice(-16);
    for (var i = 0; i < h.length; i++) msgs.push({ role: h[i].role, content: h[i].content });
    if (msgs.length === 1) msgs.push({ role: 'user', content: '先帮我看看这单有什么要注意的。' });
    return this.request(msgs).then(function (out) {
      var t = String(out || '').trim();
      return t || null;
    });
  },

  /** 生成「范围」字段的英文 + 中文对照。返回 Promise<{en,zh}|null> */
  makeScope: function (history, context) {
    var msgs = [{
      role: 'system',
      content: AI_SCOPE_PROMPT + '\n\n【这一单的全部资料】\n' + (context || '（没读到弹窗资料）')
    }];
    var h = (history || []).slice(-16);
    for (var i = 0; i < h.length; i++) msgs.push({ role: h[i].role, content: h[i].content });
    msgs.push({ role: 'user', content: '现在按上面谈定的内容，生成「范围」字段的英文和中文对照。只返回 JSON。' });
    return this.request(msgs).then(function (raw) {
      var s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a < 0 || b < a) return null;
      var o;
      try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
      if (!o || typeof o.en !== 'string' || !o.en.trim()) return null;
      return { en: o.en.trim(), zh: typeof o.zh === 'string' ? o.zh.trim() : '' };
    });
  },

  /** 留给以后的「AI 回复助手」，未实现 */
  draftReply: function () { return Promise.resolve(null); }
};


/* ==========================================================================
 * 注：曾经做过「整页批量翻译」，但已移除。
 * 理由：它是"把页面上所有英文都送出去"，会翻到别人写的消息、简介、服务标题 ——
 * 而词库匹配那条路天然不会碰这些。用户要的是「我点哪条才翻哪条」，
 * 所以只保留点击驱动的单条翻译（弹窗里的「🤖 自动翻译」→「保存」两步都要人点）。
 * 相关基础能力仍然保留：AI.translate() 单条、AI.translateBatch() 批量（供以后按需调用）。
 * ========================================================================== */

/* ------------------------------------------------------------- 启动 */

function boot() {
  enabled = getStored(CONFIG.KEY.enabled, true) !== false;
  regexOn = getStored(CONFIG.KEY.regex, true) !== false;
  fontFixOn = getStored(CONFIG.KEY.font, true) !== false;

  /* 调试入口始终挂上，不管开没开 */
  try {
    var uw = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    uw.VGenZH = {
      version: VERSION,
      terms: TERMS,
      termsSource: TERMS_SOURCE,
      termsVersion: TERMS_VERSION,
      seedTerms: SEED_TERMS,
      regex: REGEX_RULES,
      ai: AI,
      openDictPanel: openDictPanel,
      applyDict: applyDictText,
      resetDict: clearStoredDict,
      setTranslateMode: setTranslateMode,
      saveUserTerm: saveUserTerm,
      ignoreTerm: ignoreTerm,
      importIgnore: importIgnoreFromText,
      exportUserTerms: exportUserTerms,
      updateDict: updateDictFromUrl,
      autoCheckDict: autoCheckDictUpdate,
      lookup: lookup,
      userTerms: function () { return USER_TERMS; },
      ignoreList: function () { return Array.from(IGNORE_TERMS); },
      missed: function () { return Array.from(missed).sort(); },
      rescan: function () { pending.clear(); translate(document.body); translateTitle(); }
    };
  } catch (e) { /* 忽略 */ }

  /* 必须先读历史记录，再注册菜单——否则菜单上的条数是 0 */
  loadMissed();
  setupMenu();

  if (!enabled) return;

  /*
   * 字体修正和 lang 要尽早注入：晚了会先按日文字形渲染一帧，
   * 眼睛能看到闪一下。
   */
  injectFontFix();
  try { document.documentElement.lang = 'zh-CN'; } catch (e) { /* 忽略 */ }

  /* 自助翻译模式：上次开着的话这次继续开着 */
  if (getStored(CONFIG.KEY.xlateMode, false) === true) setTranslateMode(true);

  /* 在线词库自动检查（默认关；只写存储，下次开页面生效） */
  autoCheckDictUpdate();

  /*
   * 尽早开始：@run-at document-start 时 <body> 还不存在，
   * 但 <html> 已经在，而且观察器先挂上就能边渲染边翻，少一截闪烁。
   */
  startObserver();
  startRouteWatcher();
  startChatSendIntercept();      /* 中译英发送拦截，挂一次就够 */
  translate(document.documentElement);
  translateTitle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onBodyReady, { once: true });
  } else {
    onBodyReady();
  }
}

function onBodyReady() {
  translate(document.body);
  translateTitle();

  /* 首屏多半还在异步渲染，补几刀兜底 */
  var delays = [120, 400, 1000, 2500];
  for (var i = 0; i < delays.length; i++) {
    setTimeout(function () {
      translate(document.body);
      translateTitle();
    }, delays[i]);
  }
}

boot();
