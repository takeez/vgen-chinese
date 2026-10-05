/* ==========================================================================
 * 纯函数：引号归一化、大小写别名、空译文防线
 *
 * 单独成一个文件，是为了让它在打包产物里排在 `var TERMS = sanitize(...)`
 * 【之前】—— 否则自测脚本 eval 产物时只能喂一个空壳 sanitize，
 * 测出来的覆盖率是假的（引号归一化和大小写回退都没生效）。
 * ========================================================================== */

/*
 * 防线：空译文会把页面文字抹掉。任何空的/非字符串的译文一律当没命中。
 * （词库里留空行是手滑，不是"删掉这段文字"的意思）
 *
 * 顺带处理引号：VGen 有的地方用弯引号 ’ “ ”，有的地方用直角引号 ' "。
 * 不归一化的话，同一句话两种引号版本会漏翻一半。这里给每个键
 * 额外注册一个"直角引号版"别名，lookup 那边也会把待查文本归一化。
 */
function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function normalizeQuotes(s) {
  return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}

function sanitize(map) {
  var clean = {};
  for (var k in map) {
    if (!hasOwn(map, k)) continue;
    var v = map[k];
    if (typeof v !== 'string') continue;
    if (v.trim() === '') {
      console.warn('[vgenzh] 词库里有一条空译文，已忽略：' + JSON.stringify(k));
      continue;
    }
    clean[k] = v;

    var nk = normalizeQuotes(k);
    if (nk !== k && !hasOwn(clean, nk)) clean[nk] = v;
  }

  /*
   * 大小写回退。站点同一个词常有两种写法（Account Type / Account type、
   * Artist / artist），逐条维护两份太蠢。这里给每个键补一个小写别名，
   * 只有当小写键本身不是词条时才补，避免把真正的键覆盖掉。
   */
  var lower = {};
  for (var k2 in clean) {
    if (!hasOwn(clean, k2)) continue;
    var lk = k2.toLowerCase();
    if (lk === k2) continue;
    if (hasOwn(clean, lk)) continue;      /* 已有真正的键，别动 */
    if (hasOwn(lower, lk)) continue;      /* 已有别的键占了，先到先得 */
    lower[lk] = clean[k2];
  }
  for (var k3 in lower) {
    if (!hasOwn(lower, k3)) continue;
    if (!hasOwn(clean, k3)) clean[k3] = lower[k3];
  }

  return clean;
}
