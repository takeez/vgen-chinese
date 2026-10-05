/* ==========================================================================
 * 正则词条：处理"带变量"的文案
 * 每条 = [正则, 替换内容]；替换内容可以是字符串，也可以是函数
 * 只在词库精确匹配失败后才尝试，所以不会有性能压力
 * ========================================================================== */

var UNIT_ZH = {
  second: '秒', minute: '分钟', hour: '小时', day: '天',
  week: '周', month: '个月', year: '年'
};

var MONTH_ZH = {
  jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6',
  jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12'
};

var REGEX_RULES = [

  /* ------------------------------------------------------ 相对时间 */
  [/^(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago$/i, function (m, n, u) {
    return n + (UNIT_ZH[u.toLowerCase()] || u) + '前';
  }],
  [/^in\s+(\d+)\s*(second|minute|hour|day|week|month|year)s?$/i, function (m, n, u) {
    return n + (UNIT_ZH[u.toLowerCase()] || u) + '后';
  }],
  [/^a\s+(second|minute|hour|day|week|month|year)\s+ago$/i, function (m, u) {
    return '1' + (UNIT_ZH[u.toLowerCase()] || u) + '前';
  }],
  [/^just\s+now$/i, '刚刚'],
  [/^yesterday$/i, '昨天'],
  [/^today$/i, '今天'],
  [/^tomorrow$/i, '明天'],

  /* ---------------------------------------------------------- 日期 */
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i,
    function (m, mon, day, year) {
      return year + '年' + (MONTH_ZH[mon.slice(0, 3).toLowerCase()] || mon) + '月' + parseInt(day, 10) + '日';
    }],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})$/i,
    function (m, mon, day) {
      return (MONTH_ZH[mon.slice(0, 3).toLowerCase()] || mon) + '月' + parseInt(day, 10) + '日';
    }],

  /* ------------------------------------------------------ 计数 / 统计 */
  [/^About\s+([\d,]+)\s+results?$/i, '$1 条结果'],
  [/^([\d,]+)\+?\s+commission services$/i, '$1+ 个委托服务'],
  [/^([\d,]+)\+?\s+services?$/i, '$1+ 项服务'],
  [/^([\d,]+)\+?\s+products?$/i, '$1+ 件商品'],
  [/^([\d,]+)\+?\s+artists?$/i, '$1+ 位画师'],
  [/^([\d,]+)\+?\s+results?$/i, '$1+ 条结果'],
  [/^([\d,]+)\s+Reviews?$/i, '$1 条评价'],
  [/^([\d,]+)\s+Sales?$/i, '$1 笔销量'],
  [/^([\d,.,KMB]+)\s+views?$/i, '$1 次观看'],
  [/^([\d,.,KMB]+)\s+likes?$/i, '$1 个赞'],
  [/^([\d,.,KMB]+)\s+followers?$/i, '$1 位粉丝'],
  [/^([\d,]+)\s+following$/i, '$1 个关注'],
  [/^([\d,]+)\s+items?$/i, '$1 件'],
  [/^([\d,]+)\s+characters?$/i, '$1 个角色'],
  [/^([\d,]+)\s+left$/i, '剩余 $1'],
  [/^Page\s+(\d+)\s+of\s+(\d+)$/i, '第 $1 页，共 $2 页'],
  [/^(\d+)\s+more$/i, '还有 $1 个'],

  /* ------------------------------------------------------ 时长（分钟/小时） */
  [/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*hrs?$/i, '$1 - $2 小时'],
  [/^(\d+(?:\.\d+)?)\s*hrs?$/i, '$1 小时'],
  [/^(\d+)\s*-\s*(\d+)\s*min$/i, '$1-$2 分钟'],
  [/^(\d+)\s*min$/i, '$1 分钟'],
  [/^(\d+)\+?\s*BPM$/i, '$1+ BPM'],

  /* ---------------------------------------------------------- 其它 */
  [/^(\d+)%\s*off$/i, '减 $1%'],
  [/^Save\s+(\d+)%$/i, '省 $1%'],
  [/^(\d+)\s+days?\s+left$/i, '剩余 $1 天'],
  [/^(\d+)\s+hours?\s+left$/i, '剩余 $1 小时'],
  [/^Slide\s+(\d+)\s+of\s+(\d+)$/i, '第 $1 张，共 $2 张'],
  [/^\((\d+)%\s*off\)$/i, '（省 $1%）'],
  [/^\((\d+)\s+reviews?\)$/i, '（$1 条评价）'],
  [/^Used for\s+(\d+)\s+services?$/i, '已用于 $1 个服务'],
  [/^Add\s+(\d+)\s+(services|social links|portfolio showcases)$/i, function (m, n, what) {
    var map = { 'services': '个服务', 'social links': '个社交链接', 'portfolio showcases': '个作品集展示' };
    return '添加 ' + n + ' ' + (map[what.toLowerCase()] || what);
  }],
  [/^Thanks for leaving a review for\s+(.+)$/i, '感谢你为 $1 留下评价'],
  [/^Payment from\s+(.+?)\s+-\s+(\S+)$/i, '来自 $1 的付款 - $2'],
  [/^Be as thorough as you can so that\s+(.+?)\s+can give you an accurate proposal!$/i,
    function (m, who) {
      var zh = TERMS[who];
      return '请尽可能写得详细，这样 ' + (zh !== undefined ? zh : who) + ' 才能给你准确的提案！';
    }],

  /* 时间戳：As of / Submitted / Published + 日期 + 时间 */
  [/^(As of|Submitted|Published|Updated|Created)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4})\s+at\s+(.+)$/i,
    function (m, prefix, datePart, time) {
      var map = { 'as of': '截至', 'submitted': '提交于', 'published': '发布于', 'updated': '更新于', 'created': '创建于' };
      var dm = /^([A-Za-z]+)\.?\s+(\d{1,2}),\s+(\d{4})$/.exec(datePart);
      if (!dm) return m[0];
      var zh = dm[3] + '年' + (MONTH_ZH[dm[1].slice(0, 3).toLowerCase()] || dm[1]) + '月' + parseInt(dm[2], 10) + '日';
      return (map[prefix.toLowerCase()] || prefix) + ' ' + zh + ' ' + time;
    }],

  /* 「月份 年份」：Aug 2026 */
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})$/i,
    function (m, mon, year) {
      return year + '年' + (MONTH_ZH[mon.slice(0, 3).toLowerCase()] || mon) + '月';
    }],

  /* 「状态：XXX」/「时区：XXX（在设置中修改）」 */
  [/^Status:\s*(.+)$/i, function (m, v) {
    var zh = TERMS[v];
    if (zh === undefined) zh = TERMS[v.toLowerCase()];
    return '状态：' + (zh !== undefined ? zh : v);
  }],
  [/^Timezone:\s*(.+?)\s*\(edit in settings\)$/i, function (m, tz) {
    return '时区：' + tz + '（在设置中修改）';
  }],
  [/^Timezone:\s*(.+?)\s*$/i, function (m, tz) {
    return '时区：' + tz;
  }],

  /* 「XXX 的服务条款 / 描述」 */
  [/^(.+?)'s Terms of Service$/i, function (m, who) {
    var zh = TERMS[who];
    return (zh !== undefined ? zh : who) + ' 的服务条款';
  }],
  [/^(.+?)'s Description$/i, function (m, who) {
    var zh = TERMS[who];
    return (zh !== undefined ? zh : who) + ' 的描述';
  }],

  /* ==========================================================================
   * 下面这几条会**回查词库**：把捕获到的部分再拿去 TERMS 里查一次。
   * 这样 "From 2D Avatars" / "Settings - Account - VGen" 这类组合文案
   * 能自动拼出来，不用为每个组合各写一条。
   *
   * 注意顺序：放在最后，让上面那些更具体的规则先跑。
   * ======================================================================== */

  [/^From\s+(.+)$/, function (m, rest) {
    var zh = TERMS[rest];
    if (zh === undefined) zh = TERMS[rest.toLowerCase()];
    return '来自 ' + (zh !== undefined ? zh : rest);
  }],

  [/^Settings\s+-\s+(.+?)\s+-\s+VGen$/, function (m, rest) {
    var zh = TERMS[rest];
    if (zh === undefined) zh = TERMS[rest.toLowerCase()];
    return '设置 - ' + (zh !== undefined ? zh : rest) + ' - VGen';
  }],

  [/^(.+?)\s+-\s+VGen$/, function (m, rest) {
    var zh = TERMS[rest];
    if (zh === undefined) zh = TERMS[rest.toLowerCase()];
    return (zh !== undefined ? zh : rest) + ' - VGen';
  }],

  [/^(.+?)\s+\|\s+VGen$/, function (m, rest) {
    var zh = TERMS[rest];
    if (zh === undefined) zh = TERMS[rest.toLowerCase()];
    return (zh !== undefined ? zh : rest) + ' | VGen';
  }]
];
