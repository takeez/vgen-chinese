/**
 * 生成 test/fixture.html —— 一个仿 VGen 结构的最小页面，
 * 里面**内联**打包好的引擎（含 GM_* 桩），这样用 file:// 打开就能跑，
 * 不需要篡改猴、不需要起服务器。
 *
 *   node make-fixture.mjs
 *
 * 用途：无头 Edge 截图验证引擎是否真的按预期工作。
 * 页面里刻意混入了「用户自己写的内容」，用来验证不会被误翻。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const engine = readFileSync(join(ROOT, 'dist', 'vgen-chinese.user.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>VGen | For the love of human creativity</title>
<style>
  /* ↓ 刻意照抄 vgen.co 的全局字体栈：有日文/繁体，唯独没有简体。
       用来验证脚本注入的字体修正能不能压过站点自己的声明。 */
  *, *::before, *::after {
    font-family: Satoshi, 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans TC',
                 Arial, Tahoma, sans-serif;
  }
  body { font-size: 14px; line-height: 1.6; margin: 0; padding: 16px 24px; background:#0d1117; color:#e6edf3; }
  h2 { font-size: 15px; margin: 22px 0 8px; color:#7d8590; border-bottom:1px solid #30363d; padding-bottom:4px; }
  nav a { margin-right: 14px; color:#58a6ff; text-decoration:none; }
  .row { display:flex; flex-wrap:wrap; gap:8px; margin:6px 0; }
  .chip { border:1px solid #30363d; border-radius:999px; padding:3px 12px; background:#161b22; }
  .card { border:1px solid #30363d; border-radius:8px; padding:10px 14px; margin:8px 0; background:#161b22; }
  .muted { color:#7d8590; }
  .userblob { border-left:3px solid #d29922; padding-left:10px; margin:8px 0; }
  label { display:block; margin-top:10px; color:#7d8590; }
  input, select { background:#0d1117; color:#e6edf3; border:1px solid #30363d; border-radius:6px; padding:5px 8px; }
  button { background:#238636; color:#fff; border:0; border-radius:6px; padding:6px 14px; }
</style>
</head>
<body>

<!-- 错误捕获：必须放在最前面，否则抓不到后面的错 -->
<script>
  window.__errs = [];
  window.addEventListener('error', function (e) {
    window.__errs.push((e.message || 'unknown') + ' @' + (e.lineno || '?') + ':' + (e.colno || '?'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__errs.push('unhandled rejection: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
</script>
<div id="errbox" style="color:#f85149;font-size:12px;white-space:pre-wrap;margin:6px 0"></div>

<!-- 测试用 GM_* 桩：必须在引擎之前定义 -->
<script>
  window.__store = {};
  window.GM_getValue = function (k, d) { return (k in window.__store) ? window.__store[k] : d; };
  window.GM_setValue = function (k, v) { window.__store[k] = v; };
  window.GM_registerMenuCommand = function () {};
  window.GM_setClipboard = function () {};
  /* 无头环境里 confirm/alert 会卡住，直接放行/静音 */
  window.confirm = function () { return true; };
  window.alert = function () {};
  /* 桩接口：假装是模型返回。刻意漏掉含 "Skip" 的条目，用来测译文校验 */
  window.GM_xmlhttpRequest = function (opts) {
    /* GET = 在线词库；POST = 翻译接口 */
    if (opts.method === 'GET') {
      var terms = {};
      for (var i = 0; i < 600; i++) terms['Fake Term ' + i] = '假词条' + i;
      setTimeout(function () {
        opts.onload({
          status: 200,
          responseText: JSON.stringify({ v: 'fixture', count: 600, terms: terms })
        });
      }, 0);
      return;
    }
    var body = JSON.parse(opts.data);
    var userMsg = body.messages[body.messages.length - 1].content;
    var reply;
    var payload = null;
    try { payload = JSON.parse(userMsg); } catch (e) { payload = null; }

    var CHAT_MARK = '【需要翻译的条目】';
    var ZH2EN_MARK = '【我要说的话（中文）】';
    var sys = (body.messages[0] && body.messages[0].content) || '';

    if (userMsg.indexOf('这单要注意什么？给个报价。') >= 0) {
      reply = '要确认的：客户说 5 个，列了 6 个。\\n报价：$60 - $72（6 个 × $10）\\n范围字段：只写数量这一条。';
    } else if (userMsg.indexOf('给客户写一条消息') >= 0) {
      reply = "Hi~ I saw your request. You said five icons but listed six, so I'll quote and draw six. $60 total — does that work?";
    } else if (sys.indexOf('你替他看客户要求') >= 0) {
      reply = '模拟讨论回复：先把 5 还是 6 确认掉。';
    } else if (userMsg.indexOf(CHAT_MARK) >= 0) {
      /* 聊天批量：标记后面跟一个 [{id,text}] 数组 -> {id:"模拟中文"} */
      var arr = [];
      try { arr = JSON.parse(userMsg.slice(userMsg.indexOf(CHAT_MARK) + CHAT_MARK.length).trim()); }
      catch (e) { arr = []; }
      var cm = {};
      arr.forEach(function (it) { if (it && it.id) cm[it.id] = '模拟中文'; });
      reply = JSON.stringify(cm);
    } else if (userMsg.indexOf(ZH2EN_MARK) >= 0) {
      reply = 'Sounds good, thanks for checking in!';
    } else if (payload && payload.items) {
      var out = {};
      payload.items.forEach(function (en) {
        if (en.indexOf('Skip') >= 0) return;          /* 故意漏一条 */
        if (/^[A-Za-z ]+$/.test(en)) out[en] = '模拟译文';
      });
      reply = JSON.stringify(out);
    } else {
      /* 单条：如果输入里带 ECHO，就原样回吐英文 —— 用来测「原样返回」会被校验挡下 */
      var lastLine = userMsg.split('\\n').pop().trim();
      reply = (lastLine.indexOf('ECHO') >= 0) ? lastLine : '模拟单条译文';
    }
    window.__apiCalls = (window.__apiCalls || 0) + 1;
    setTimeout(function () {
      opts.onload({
        status: 200,
        responseText: JSON.stringify({ choices: [{ message: { content: reply } }] })
      });
    }, 0);
  };
</script>

<!-- 引擎本体（由 build.mjs 产出，此处内联） -->
<script>
${engine}
</script>

<h2>导航（应全部变中文）</h2>
<nav>
  <a>Discover</a><a>Commissions</a><a>Shop</a><a>Challenges</a>
  <a>Community</a><a>Messages</a><a>Notifications</a><a>Settings</a>
  <a>Log in</a>
</nav>

<h2>筛选器（命中率最高的那批）</h2>
<div>Vibe</div>
<div class="row">
  <span class="chip">Cute / Sweet</span><span class="chip">Chill / Cozy</span>
  <span class="chip">Dark / Mysterious</span><span class="chip">Epic / Powerful</span>
  <span class="chip">Angry  / Aggressive</span>
</div>
<div>Style</div>
<div class="row">
  <span class="chip">Anime / Manga</span><span class="chip">Semi-realistic</span>
  <span class="chip">Pixel Art</span><span class="chip">Retro / Vintage</span>
</div>
<div>Movement</div>
<div class="row">
  <span class="chip">Static</span><span class="chip">Animated</span>
  <span class="chip">Movement included</span><span class="chip">Not made to move</span>
</div>
<div>Type</div>
<div class="row"><span class="chip">Other</span><span class="chip">All</span><span class="chip">None</span></div>

<h2>分类与卡片</h2>
<div class="card">
  <strong>2D VTuber Model Art</strong>
  <div class="muted">A treasure trove of 2D vtuber model art creations!</div>
</div>
<div class="card">
  <strong>3D Animation Tutorials</strong>
  <div class="muted">Level up your 3D animation skills with step-by-step tutorials!</div>
</div>
<div class="card">
  <strong>Logo Design</strong>
  <div class="muted">Memorable, iconic, and the cornerstone of your brand and being.</div>
</div>

<h2>带变量的文案（走正则）</h2>
<div>380,000+ commission services</div>
<div>2 days ago</div>
<div>Jan 5, 2026</div>
<div>0 - 2 hrs</div>
<div>Page 2 of 5</div>

<h2>表单</h2>
<label>Username or email</label>
<input placeholder="Username or email">
<label>Password</label>
<input type="password" placeholder="Password">
<!-- placeholder 专项：该翻的要翻，纯格式示例不许碰，未收录的要进待翻清单 -->
<textarea id="ph-hit" placeholder="Type your message..."></textarea>
<textarea id="ph-hit2" placeholder="Confirm what's going to be done if anything was unclear from the service description or additional add-ons were requested.&#10;&#10;If everything is covered by the service description already, you can just send a &quot;Thank you for your commission!&quot;"></textarea>
<input id="ph-format" placeholder="https://">
<input id="ph-format2" placeholder="YYYY-MM-DD">
<input id="ph-miss" placeholder="This placeholder is definitely not in the dictionary">
<!-- option 专项：有 value 的要翻（value 不许动），没有 value 的整条不许碰 -->
<select id="sel-valued">
  <option value="2026-10">Oct 2026</option>
  <option value="2026-11">Nov 2026</option>
</select>
<select id="sel-novalue">
  <option>Oct 2026</option>
</select>
<button>Continue</button>
<button>Cancel</button>

<h2>被拆开的文本（首字母在独立 span 里，必须能合并翻译）</h2>
<p class="optlabel"><span>F</span>amily</p>
<p class="optlabel"><span>F</span>igures</p>
<p class="optlabel"><span>F</span>ull Mix</p>
<p class="optlabel"><span>Other Re</span>ference Sheets</p>

<h2>⚠️ 带图标的按钮（绝不能被子节点合并毁掉）</h2>
<button id="btn1"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#58a6ff"/></svg> Save</button>
<button id="btn2"><i class="icon-star"></i> Settings</button>
<div id="btncheck" class="muted"></div>

<h2>🗂 仿接稿弹窗（结构照抄真实页面快照）</h2>
<div role="dialog" aria-modal="true" aria-label="Edit check" id="fake-modal">
  <div data-request-form-screen-item="true" class="LongTextField__Container">
    <p class="questionText">附加信息</p>
    <p class="questionDescription">姿势、特征、多角色、附加内容等</p>
    <div class="questionContent">
      <pre class="detailsText">5 Separate icons of the references above. Feel free to simplify the outfits if you need to. Agnes Tachyon: Smug, playful Gold Ship Summer: kinda crazy, draw her with a smile.</pre>
    </div>
  </div>
  <div class="inputGroup">
    <div class="inputGroupHeader"><h4 class="inputGroupTitle">提案</h4></div>
    <div class="proposalContainer">
      <div class="inputSection">
        <h4 class="groupSubHeader">范围</h4>
        <div class="InputField__Container-vg__sc-x scope">
          <label class="formLabel"><div class="inputContainer">
            <textarea class="formField" placeholder="确认将要完成的内容" rows="9"></textarea>
          </div></label>
        </div>
      </div>
    </div>
  </div>
  <div class="inputGroupHeader"><span>COMM#NBOI5DUCLRKS</span></div>
</div>
<!-- 真代码块：必须有 <code>，引擎要跳过它 -->
<pre id="real-code"><code>const status = "Draft";</code></pre>

<h2>💬 仿聊天（Stream Chat 结构，照抄真实快照）</h2>
<div class="str-chat__list">
  <ul class="str-chat__ul">
    <li class="str-chat__li" data-message-id="msg-1">
      <div class="str-chat__message str-chat__message--other">
        <div class="str-chat__message-inner"><div class="str-chat__message-bubble">
          <div class="str-chat__message-text">
            <div class="str-chat__message-text-inner"><div>Oh thank you! It's great!</div></div>
          </div>
        </div></div>
      </div>
    </li>
    <li class="str-chat__li" data-message-id="msg-2">
      <div class="str-chat__message str-chat__message--me">
        <div class="str-chat__message-inner"><div class="str-chat__message-bubble">
          <div class="str-chat__message-text">
            <div class="str-chat__message-text-inner"><div>Although it was difficult, I finally managed to do it.</div></div>
          </div>
        </div></div>
      </div>
    </li>
  </ul>
</div>
<div class="str-chat__message-input">
  <textarea data-testid="message-input"></textarea>
  <button class="sendButton" type="button"><span>send</span></button>
</div>

<h2>⚠️ 用户自己写的内容（必须保持英文原样）</h2><div class="userblob">
  <div><strong>Komori_night</strong> <span class="muted">· 2 days ago</span></div>
  <div>hi! i want a full body illustration of my oc, budget around 120 usd, deadline end of march. is that ok?</div>
</div>
<div class="card">
  <strong>I will draw your original character in my anime style</strong>
  <div class="muted">Delivery in 14 days · Starting at $85 · 3 revisions included</div>
</div>
<div class="userblob">
  <div>Service title written by the artist: <em>Custom VTuber model rigging for your debut stream</em></div>
  <div class="muted">this whole block is user generated content and must NOT be translated</div>
</div>

<h2>不该被动的东西</h2>
<div>Price: $1,234.56 · 30% OFF · order #VG-99881</div>
<code>const status = "Draft";</code>

<h2>字体修正自检（验证 !important 有没有压过站点声明）</h2>
<div id="fontcheck">检查中…</div>
<div class="muted" id="fontcheck2"></div>

<script>
  (function () {
    var el = document.querySelector('nav a') || document.body;
    var got = getComputedStyle(el).fontFamily;
    var ok = /noto sans sc/i.test(got);
    var box = document.getElementById('fontcheck');
    box.textContent = (ok ? '✅ 修正生效' : '❌ 修正未生效') + '\\ncomputed: ' + got;
    box.style.whiteSpace = 'pre-wrap';
    box.style.fontSize = '12px';
    document.getElementById('fontcheck2').textContent =
      'html lang = ' + JSON.stringify(document.documentElement.lang) +
      '   |   日文样本（应仍可读）: こんにちは、VTuber のイラスト';

    /* 图标按钮自检：必须等到 load 之后 —— 引擎在 DOMContentLoaded 还有一次补扫，
       内联脚本在解析期就跑完了，那时按钮还没被翻译，会误报 ❌ */
    window.addEventListener('load', function () {
      var out = [];
      var b1 = document.getElementById('btn1');
      var b2 = document.getElementById('btn2');
      var ok1 = !!b1.querySelector('svg') && b1.textContent.indexOf('保存') >= 0;
      var ok2 = !!b2.querySelector('i.icon-star') && b2.textContent.indexOf('设置') >= 0;
      document.getElementById('btncheck').textContent =
        (ok1 ? '✅' : '❌') + ' 按钮1（svg + Save）: ' + JSON.stringify(b1.textContent.trim()) +
        '   |   ' + (ok2 ? '✅' : '❌') + ' 按钮2（icon + Settings）: ' + JSON.stringify(b2.textContent.trim());

      /* 忽略名单 / 用户内容区 / 自助翻译 的自检 */
      try {
        var Z = window.VGenZH;

        /* ① 用户内容区（artistDisplayName）里的文字不该被收集 */
        var probe = document.createElement('p');
        probe.className = 'artistDisplayName';
        probe.textContent = 'ZzzUntranslatedArtistName';
        document.body.appendChild(probe);
        Z.rescan();
        var collectedArtistName = Z.missed().some(function (s) { return s.indexOf('ZzzUntranslatedArtistName') >= 0; });
        out.push('用户内容区不收集=' + (collectedArtistName ? '❌ 被收集了' : '✅'));

        /* ② 忽略名单生效：加进去后不再收集 */
        Z.ignoreTerm('ZzzIgnoreMePlease');
        var p2 = document.createElement('p');
        p2.textContent = 'ZzzIgnoreMePlease';
        document.body.appendChild(p2);
        Z.rescan();
        var inMissed = Z.missed().some(function (s) { return s.indexOf('ZzzIgnoreMePlease') >= 0; });
        out.push('忽略名单不收集=' + (inMissed ? '❌' : '✅') +
                 ' 名单条数=' + Z.ignoreList().length);

        /* ③ 自助翻译：存一条自订词条 */
        Z.saveUserTerm('Zzz My Custom English', '自定义中文', null);
        out.push('自订词条写入=' +
                 (window.VGenZH.userTerms()['Zzz My Custom English'] === '自定义中文' ? '✅' : '❌'));

        /* ④ 直接粘导出清单（带 TAB）也能导入忽略名单 */
        var n = Z.importIgnore(['Storefront\\tNAV.navItem', 'Basket\\tBUTTON.btn'].join('\\n'));
        out.push('粘导出清单导入忽略=' + (n === 2 ? '✅ 2 条' : '❌ ' + n + ' 条'));

        /* ⑤ 自助翻译的完整链路：悬停 → 高亮 → 点击 → 弹窗 → 保存 → 就地生效 */
        Z.setTranslateMode(true);
        var tgt = document.createElement('p');
        tgt.textContent = 'Zzz Simulated Hover Target';
        document.body.appendChild(tgt);

        tgt.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        var highlighted = tgt.classList.contains('vgenzh-hl');

        tgt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 120, clientY: 120 }));
        var pop = document.querySelector('.vgenzh-xlate');
        out.push('悬停高亮=' + (highlighted ? '✅' : '❌') + ' 点击弹窗=' + (pop ? '✅' : '❌'));

        if (pop) {
          var inp = pop.querySelector('input');
          inp.value = '模拟译文';
          /* 按文字找「保存」按钮 —— 弹窗里现在还有「🤖 自动翻译」，不能靠第一个 */
          var btns = Array.prototype.slice.call(pop.querySelectorAll('button'));
          var saveBtn = btns.filter(function (b) { return b.textContent === '保存'; })[0];
          out.push('找到保存按钮=' + (saveBtn ? '✅' : '❌'));
          if (saveBtn) saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          out.push('保存后就地生效=' +
            (tgt.textContent.trim() === '模拟译文' ? '✅' : '❌ ' + JSON.stringify(tgt.textContent.trim())));
          out.push('弹窗已关闭=' + (document.querySelector('.vgenzh-xlate') ? '❌' : '✅'));
        }
        Z.setTranslateMode(false);
      } catch (e) { out.push('忽略/翻译自检抛错: ' + e.message); }

      /* ⑥ 字体修正的范围：只能打在翻译过的元素上，没翻译的地方一个字都不许碰 */
      try {
        var marked = document.querySelectorAll('[data-vgenzh="1"]');
        out.push('翻译过的元素有标记=' + (marked.length > 0 ? '✅ ' + marked.length + ' 个' : '❌'));
        if (marked.length) {
          var csM = getComputedStyle(marked[0]).fontFamily || '';
          out.push('标记元素字体已修正=' + (csM.indexOf('Noto Sans SC') >= 0 ? '✅' : '❌ ' + csM.slice(0, 60)));
        }
        /* 造一个"没被翻译"的元素，它的字体必须保持原样 */
        var pure = document.createElement('p');
        pure.textContent = '这段是纯中文，引擎不会碰它';
        document.body.appendChild(pure);
        var csP = getComputedStyle(pure).fontFamily || '';
        out.push('未翻译元素字体未被动=' +
          (csP.indexOf('Noto Sans SC') < 0 && csP.indexOf('Microsoft YaHei') < 0 ? '✅' : '❌ 被改了: ' + csP.slice(0, 60)));
        /* 全局 * 规则必须已经不存在 */
        var hasGlobal = false;
        for (var si = 0; si < document.styleSheets.length; si++) {
          var rules; try { rules = document.styleSheets[si].cssRules; } catch (e2) { continue; }
          if (!rules) continue;
          for (var ri = 0; ri < rules.length; ri++) {
            var sel = rules[ri].selectorText || '';
            /* 注意：这里不用正则，避免在模板字符串里被吃掉反斜杠 */
            if (sel.charAt(0) === '*' && sel.indexOf('code') >= 0) hasGlobal = true;
          }
        }
        out.push('全局字体覆盖已移除=' + (hasGlobal ? '❌ 还在' : '✅'));
      } catch (e) { out.push('字体范围自检抛错: ' + e.message); }

      /* ⑦ placeholder（属性）专项 */
      try {
        var ph = document.getElementById('ph-hit');
        out.push('placeholder 已翻=' +
          (ph && ph.getAttribute('placeholder') === '输入消息…' ? '✅' : '❌ ' + JSON.stringify(ph && ph.getAttribute('placeholder'))));

        var ph2 = document.getElementById('ph-hit2');
        var v2 = ph2 ? ph2.getAttribute('placeholder') : '';
        out.push('多行 placeholder 已翻=' +
          (v2 && /[一-龥]/.test(v2) ? '✅' : '❌ ' + JSON.stringify(String(v2).slice(0, 60))));

        var pf = document.getElementById('ph-format');
        out.push('格式示例未被动=' +
          (pf && pf.getAttribute('placeholder') === 'https://' ? '✅' : '❌ ' + JSON.stringify(pf && pf.getAttribute('placeholder'))));
        var pf2 = document.getElementById('ph-format2');
        out.push('日期掩码未被动=' +
          (pf2 && pf2.getAttribute('placeholder') === 'YYYY-MM-DD' ? '✅' : '❌ ' + JSON.stringify(pf2 && pf2.getAttribute('placeholder'))));

        /* 未收录的 placeholder 必须进待翻清单，否则永远隐身 */
        var pm = document.getElementById('ph-miss');
        var missed = window.VGenZH.missed() || [];
        var inList = missed.some(function (s) { return s.indexOf('definitely not in the dictionary') >= 0; });
        out.push('未收录 placeholder 进清单=' + (inList ? '✅' : '❌ 共 ' + missed.length + ' 条'));
        out.push('格式示例未污染清单=' +
          (missed.some(function (s) { return s === 'https://' || s === 'YYYY-MM-DD'; }) ? '❌ 被塞进去了' : '✅'));
      } catch (e) { out.push('placeholder 自检抛错: ' + e.message); }

      /* ⑧ 动态文案：日期 / 时间 / 页码（这些是拼接出来的，只能靠正则） */
      try {
        var dyn = [
          ['Today at 7:15 AM', '今天 上午7:15'],
          ['Oct 24 at 7:15AM', '10月24日 上午7:15'],
          ['Oct 24, 2026 at 7:15am', '2026年10月24日 上午7:15'],
          ['Page 1 / 2', '第 1 / 2 页'],
          ['5 min ago', '5分钟前'],
          ['3 hr ago', '3小时前'],
          ['Monday at 7:15 AM', '星期一 上午7:15']
        ];
        var badDyn = [];
        for (var di = 0; di < dyn.length; di++) {
          var got = window.VGenZH.lookup(dyn[di][0]);
          if (got !== dyn[di][1]) badDyn.push(dyn[di][0] + ' → ' + JSON.stringify(got));
        }
        out.push('动态文案(日期/页码)=' +
          (badDyn.length ? '❌ ' + badDyn.join(' | ') : '✅ ' + dyn.length + ' 条'));
      } catch (e) { out.push('动态文案自检抛错: ' + e.message); }

      /* ⑨ <option> 专项：有 value 的翻文本、value 不变；没 value 的不许碰 */
      try {
        var sv = document.getElementById('sel-valued');
        var o1 = sv ? sv.options[0] : null;
        out.push('有value的option已翻=' +
          (o1 && o1.textContent === '2026年10月' ? '✅' : '❌ ' + JSON.stringify(o1 && o1.textContent)));
        out.push('option的value未改动=' +
          (o1 && o1.value === '2026-10' ? '✅' : '❌ ' + JSON.stringify(o1 && o1.value)));
        var sn = document.getElementById('sel-novalue');
        var o2 = sn ? sn.options[0] : null;
        out.push('无value的option未被动=' +
          (o2 && o2.textContent === 'Oct 2026' ? '✅' : '❌ ' + JSON.stringify(o2 && o2.textContent)));
      } catch (e) { out.push('option 自检抛错: ' + e.message); }

      /* ⑩ 接稿弹窗字段：按钮注入 + 点译 + 展开原文 + 真代码块要跳过 */
      try {
        var fbtn = document.querySelector('#fake-modal [data-vgenzh-field-btn]');
        out.push('字段挂上译按钮=' + (fbtn ? '✅' : '❌'));

        var codeBtn = document.querySelector('#real-code [data-vgenzh-field-btn]');
        var codeTxt = document.getElementById('real-code').textContent;
        out.push('真代码块不挂按钮=' + (codeBtn ? '❌ 挂了' : '✅'));
        out.push('真代码块文字未被动=' + (codeTxt === 'const status = "Draft";' ? '✅' : '❌ ' + JSON.stringify(codeTxt)));
      } catch (e) { out.push('字段按钮自检抛错: ' + e.message); }

      try {
        window.VGenZH.openDictPanel();
        var p = document.querySelector('.vgenzh-panel');
        var btns = p ? p.querySelectorAll('button.act') : [];
        out.push('面板=' + (p ? '✅' : '❌') + ' 按钮数=' + btns.length +
                 ' 有文本框=' + (p && p.querySelector('textarea') ? '✅' : '❌'));
      } catch (e) { out.push('面板开不出来: ' + e.message); }

      try {
        var r1 = window.VGenZH.applyDict('{"Only":"一条"}');
        out.push('防呆(太少)=' + (r1.ok ? '❌ 不该通过' : '✅ 已拒绝'));
        var r2 = window.VGenZH.applyDict('这不是 JSON');
        out.push('防呆(非JSON)=' + (r2.ok ? '❌ 不该通过' : '✅ 已拒绝'));
      } catch (e) { out.push('applyDict 抛错: ' + e.message); }

      var bc = document.getElementById('btncheck');
      bc.textContent += '\\n[' + out.join('  |  ') + ']';
      document.getElementById('errbox').textContent =
        window.__errs.length ? ('JS 报错 ' + window.__errs.length + ' 条:\\n' + window.__errs.join('\\n')) : '';

      /* ⑥ API 翻译（走桩接口）：只测底层单条/批量接口与校验闸门。
            「整页批量翻译」已按用户要求移除，不再测。 */
      var apiStart = out.length;
      var Z2 = window.VGenZH;
      try {
        Z2.ai.configure('http://stub.local/v1/chat/completions', 'test-key', 'stub-model');
        out.push('AI已配置=' + (Z2.ai.ready() ? '✅' : '❌'));

        Z2.ai.translateBatch(['Widget Alpha Nine', 'Widget Skip Beta']).then(function (r) {
          var okN = Object.keys(r.ok).length;
          out.push('批量接口: 成功' + okN + ' 未过校验' + r.bad.length);
          out.push('未过校验的是=' + JSON.stringify(r.bad));
          out.push('通过的译文=' + JSON.stringify(r.ok['Widget Alpha Nine']));
          return Z2.ai.translate('Save draft');
        }).then(function (one) {
          out.push('单条翻译=' + (one === '模拟单条译文' ? '✅' : '❌ ' + JSON.stringify(one)));
          /* 校验闸门：桩接口把 ECHO 开头的原样回吐英文，必须被挡下返回 null */
          return Z2.ai.translate('ECHO please return me as is');
        }).then(function (bad) {
          out.push('原样返回被挡下=' + (bad === null ? '✅' : '❌ 竟然通过了 ' + JSON.stringify(bad)));
          /* 在线词库：GET 拉一份 600 条的假词库，必须被接受并写进存储 */
          return Z2.updateDict('http://stub.local/dist/vgen-dict.json');
        }).then(function (r) {
          out.push('在线词库=' + (r.ok ? '✅ ' + r.msg : '❌ ' + r.msg));
          /* 接稿字段：点「译」→ 正文换中文（带换行也要过校验）→ 出现原文块 → 点 EN 展开 */
          var pre = document.querySelector('#fake-modal pre.detailsText');
          var btn = document.querySelector('#fake-modal [data-vgenzh-field-btn]');
          if (!pre || !btn) { out.push('字段按钮缺失=❌'); return null; }
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return new Promise(function (res) { setTimeout(res, 300); }).then(function () {
            out.push('点译后正文变中文=' +
              (/[一-龥]/.test(pre.textContent) ? '✅' : '❌ ' + JSON.stringify(pre.textContent.slice(0, 40))));
            var orig = document.querySelector('#fake-modal [data-vgenzh-field-orig]');
            out.push('原文块已生成=' + (orig ? '✅' : '❌'));
            out.push('原文块默认隐藏=' +
              (orig && orig.getAttribute('data-open') !== '1' ? '✅' : '❌'));
            out.push('原文内容正确=' +
              (orig && orig.textContent.indexOf('5 Separate icons') === 0 ? '✅' : '❌ ' + JSON.stringify(orig && orig.textContent.slice(0, 30))));
            if (btn && orig) {
              btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              out.push('点EN后展开=' + (orig.getAttribute('data-open') === '1' ? '✅' : '❌'));
            }
            return null;
          });
        }).then(function () {
          /* 聊天：rescan 触发 maybeStartChat -> 自动翻 */
          window.VGenZH.rescan();
          return new Promise(function (res) { setTimeout(res, 400); }).then(function () {
            var t1 = document.querySelector('[data-message-id="msg-1"] .str-chat__message-text-inner');
            out.push('聊天消息已翻中文=' +
              (t1 && /[一-龥]/.test(t1.textContent) ? '✅' : '❌ ' + JSON.stringify(t1 && t1.textContent.slice(0, 30))));
            out.push('我发的也翻了=' +
              (function () {
                var t2 = document.querySelector('[data-message-id="msg-2"] .str-chat__message-text-inner');
                return t2 && /[一-龥]/.test(t2.textContent) ? '✅' : '❌';
              })());
            var enBtn = document.querySelector('[data-message-id="msg-1"] .vgenzh-msg-en');
            var msgOrig = document.querySelector('[data-message-id="msg-1"] [data-vgenzh-msg-orig]');
            out.push('聊天有EN按钮=' + (enBtn ? '✅' : '❌'));
            out.push('聊天原文块默认隐藏=' + (msgOrig && msgOrig.getAttribute('data-open') !== '1' ? '✅' : '❌'));
            out.push('聊天原文内容正确=' +
              (msgOrig && msgOrig.textContent.indexOf("Oh thank you") === 0 ? '✅' : '❌ ' + JSON.stringify(msgOrig && msgOrig.textContent.slice(0, 30))));
            if (enBtn && msgOrig) {
              enBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              out.push('聊天点EN后展开=' + (msgOrig.getAttribute('data-open') === '1' ? '✅' : '❌'));
            }
            return null;
          });
        }).then(function () {
          /* 发送拦截：打中文 -> 点发送 -> 不许发送，内容换成英文 */
          var ta = document.querySelector('textarea[data-testid="message-input"]');
          var send = document.querySelector('button.sendButton');
          if (!ta || !send) { out.push('聊天输入区缺失=❌'); return null; }
          ta.value = '我觉得可以，明天发你';
          send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return new Promise(function (res) { setTimeout(res, 400); }).then(function () {
            out.push('中文被换成英文=' +
              (ta.value === 'Sounds good, thanks for checking in!' ? '✅' : '❌ ' + JSON.stringify(ta.value)));
            out.push('没弹提示=' + (document.querySelector('.vgenzh-chat-hint') ? '❌ 弹了' : '✅'));
            /* 再点一次（现在框里是英文）应该放行，不改内容 */
            send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return new Promise(function (res2) { setTimeout(res2, 200); }).then(function () {
              out.push('英文原样放行=' +
                (ta.value === 'Sounds good, thanks for checking in!' ? '✅' : '❌ ' + JSON.stringify(ta.value)));
              return null;
            });
          });
        }).then(function () {
          /* 讨论窗口：打开就自动写英文消息 + 报价，然后是普通对话 */
          var pbtn = document.querySelector('#fake-modal .vgenzh-propose-btn');
          out.push('讨论按钮已挂=' + (pbtn ? '✅' : '❌'));
          if (!pbtn) return null;
          pbtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

          return new Promise(function (res) { setTimeout(res, 600); }).then(function () {
            var dlg = document.querySelector('.vgenzh-dlg');
            out.push('讨论窗口已开=' + (dlg ? '✅' : '❌'));
            if (!dlg) return null;
            out.push('窗口显示委托编号=' +
              ((dlg.textContent || '').indexOf('COMM#NBOI5DUCLRKS') >= 0 ? '✅' : '❌'));

            var text = dlg.textContent || '';
            out.push('自动给了分析=' + (/要确认的/.test(text) ? '✅' : '❌'));
            out.push('分析里带报价=' + (/报价：/.test(text) ? '✅' : '❌'));
            out.push('不自动代写英文=' + (/I saw your request/.test(text) ? '❌ 自动写了' : '✅'));

            /* 手动点「代写一版英文」，才出现英文 + 填入范围 */
            var all = dlg.querySelectorAll('.vgenzh-dlg-row button');
            var draftB = null;
            for (var ai2 = 0; ai2 < all.length; ai2++) {
              if ((all[ai2].textContent || '').indexOf('代写一版英文') >= 0) { draftB = all[ai2]; break; }
            }
            out.push('有代写按钮=' + (draftB ? '✅' : '❌'));
            if (draftB) draftB.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            return new Promise(function (res2) { setTimeout(res2, 500); }).then(function () {
              var text2 = dlg.textContent || '';
              out.push('代写后出现英文=' + (/I saw your request/.test(text2) ? '✅' : '❌'));

              var fillB = null;
              var bs = dlg.querySelectorAll('.vgenzh-dlg-row button');
              for (var fi = 0; fi < bs.length; fi++) {
                if ((bs[fi].textContent || '').indexOf('填入范围') >= 0) { fillB = bs[fi]; break; }
              }
              var scopeTa = document.querySelector('#fake-modal .proposalContainer .scope textarea');
              if (fillB) fillB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              out.push('一键填入范围=' +
                (scopeTa && /I saw your request/.test(scopeTa.value) ? '✅' : '❌ ' + JSON.stringify(scopeTa && scopeTa.value.slice(0, 30))));

              /* 接着聊 */
              var dta = dlg.querySelector('.vgenzh-dlg-ftb textarea');
              dta.value = '价格报高一点';
              var send2 = dlg.querySelector('.vgenzh-dlg-ftb .vgenzh-dlg-row button');
              if (send2) send2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              return new Promise(function (res3) { setTimeout(res3, 400); }).then(function () {
                out.push('后续对话有回复=' +
                  ((dlg.textContent || '').indexOf('模拟讨论回复') >= 0 ? '✅' : '❌'));
                return null;
              });
            });
          });
        }).catch(function (e) {
          out.push('API 测试抛错: ' + (e && e.message ? e.message : e));
        }).then(function () {
          document.getElementById('btncheck').textContent += '\\n[API] ' + out.slice(apiStart).join('  |  ');
          document.getElementById('errbox').textContent =
            window.__errs.length ? ('JS 报错 ' + window.__errs.length + ' 条:\\n' + window.__errs.join('\\n')) : '';
        });
      } catch (e) { out.push('API 测试准备抛错: ' + e.message); }
    });
  })();
</script>

</body>
</html>
`;

mkdirSync(join(ROOT, 'test'), { recursive: true });
const out = join(ROOT, 'test', 'fixture.html');
writeFileSync(out, html, 'utf8');
console.log('已生成: ' + out);
console.log('大小  : ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
