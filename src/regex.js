/* ==========================================================================
 * 正则词条：处理"带变量"的文案
 * 每条 = [正则, 替换内容]；替换内容可以是字符串，也可以是函数
 * 只在词库精确匹配失败后才尝试，所以不会有性能压力
 * ========================================================================== */

var UNIT_ZH = {
  /* 全称 */
  second: '秒', minute: '分钟', hour: '小时', day: '天',
  week: '周', month: '个月', year: '年',
  /* 缩写 —— VGen 的通知列表就是用缩写的（`${n} sec ago` / `${n} min ago` / `${n} hr ago`） */
  sec: '秒', min: '分钟', hr: '小时',
  wk: '周', mo: '个月', yr: '年'
};

var WEEKDAY_ZH = {
  sunday: '星期日', monday: '星期一', tuesday: '星期二', wednesday: '星期三',
  thursday: '星期四', friday: '星期五', saturday: '星期六',
  sun: '周日', mon: '周一', tue: '周二', wed: '周三',
  thu: '周四', fri: '周五', sat: '周六'
};

var MONTH_ZH = {
  jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6',
  jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12'
};

/* 时间正则片段：h:mm / h:mm:ss，AM/PM 可有可无（有没有空格都行，VGen 两种都有）
 * 两个版本都保证**只有一个捕获组**，这样替换函数的参数位置是稳定的。 */
var TIME_CORE = '\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:[AaPp]\\.?[Mm]\\.?)?';
var TIME_PAT = '(' + TIME_CORE + ')?';   /* 可选：日期后面可能没有时间 */
var TIME_REQ = '(' + TIME_CORE + ')';    /* 必需：单独的"时间"文案 */

/*
 * "7:15AM" / "7:15 AM" / "7:15am" -> "上午7:15" / "下午7:15"
 * 24 小时制或认不出的原样返回（返回和入参一样时调用方会跳过，不会白改）。
 */
function zhTime(t) {
  var s = String(t).trim();
  var m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP])\.?M\.?$/i.exec(s);
  if (!m) return s;
  var ap = m[3].toUpperCase() === 'A' ? '上午' : '下午';
  return ap + parseInt(m[1], 10) + ':' + m[2];
}

/* 月份 + 日 + 年 组合成中文日期 */
function zhDate(mon, day, year) {
  var mm = MONTH_ZH[String(mon).slice(0, 3).toLowerCase()] || mon;
  var s = mm + '月';
  if (day !== undefined && day !== null && day !== '') s += parseInt(day, 10) + '日';
  if (year) s = year + '年' + s;
  return s;
}

/* 日期后面接时间；没有时间就不留尾随空格 */
function joinDate(dateStr, t) {
  var zt = t ? zhTime(t) : '';
  return zt ? dateStr + ' ' + zt : dateStr;
}

var MONTH_PAT = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?';

/* 时间单位（长的在前，避免 sec 抢掉 second）；复数由 unitZh 去掉 s 处理 */
var UNIT_PAT = '(seconds|second|secs|sec|minutes|minute|mins|min|hours|hour|hrs|hr|days|day|weeks|week|wks|wk|months|month|mos|mo|years|year|yrs|yr)';

function unitZh(u) {
  var k = String(u).toLowerCase();
  return UNIT_ZH[k] || UNIT_ZH[k.replace(/s$/, '')] || u;
}

var REGEX_RULES = [

  /* ------------------------------------------------------ 相对时间 */
  /* 注意：VGen 的通知列表用的是缩写（sec / min / hr），所以单位必须放宽 */
  [new RegExp('^(\\d+)\\s*' + UNIT_PAT + '\\s+ago$', 'i'), function (m, n, u) {
    return n + unitZh(u) + '前';
  }],
  [new RegExp('^in\\s+(\\d+)\\s*' + UNIT_PAT + '$', 'i'), function (m, n, u) {
    return n + unitZh(u) + '后';
  }],
  [new RegExp('^an?\\s+' + UNIT_PAT + '\\s+ago$', 'i'), function (m, u) {
    return '1' + unitZh(u) + '前';
  }],
  [/^just\s+now$/i, '刚刚'],
  [/^yesterday$/i, '昨天'],
  [/^today$/i, '今天'],
  [/^tomorrow$/i, '明天'],

  /* ---------------------------------------------------------- 日期 */
  /*
   * VGen 用 dayjs 的 calendar() 显示"相对日期"，按远近输出四种形态：
   *   今天    -> "Today at 7:15 AM"
   *   昨天    -> "Yesterday at 7:15 AM"
   *   一周内  -> "Monday at 7:15 AM" / "Last Monday at 7:15 AM"
   *   同年更早 -> "Oct 24 at 7:15 AM"
   *   跨年    -> "Oct 24, 2026 at 7:15 AM"
   * 另外 h:mm A 有空格、h:mmA 没空格，两种都要吃下。
   *
   * ⚠️ MONTH_PAT 是**非捕获**的（(?:...)），需要捕获月份的地方必须自己包一层 ()，
   *    否则后面的捕获组序号整体错位 —— 这个坑踩过一次（time 收到了月份名）。
   */
  [new RegExp('^(Today|Yesterday|Tomorrow)\\s+at\\s+' + TIME_PAT + '$', 'i'),
    function (m, d, t) {
      var map = { today: '今天', yesterday: '昨天', tomorrow: '明天' };
      return joinDate(map[d.toLowerCase()], t);
    }],

  [new RegExp('^(?:Last\\s+)?(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\\s+at\\s+' + TIME_PAT + '$', 'i'),
    function (m, d, t) {
      return joinDate(WEEKDAY_ZH[d.toLowerCase()] || d, t);
    }],

  /* 带年份 + 可选 at + 时间（三种写法都收） */
  [new RegExp('^(' + MONTH_PAT + ')\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*,?\\s*(?:at\\s+)?' + TIME_PAT + '$', 'i'),
    function (m, mon, day, year, t) {
      return joinDate(zhDate(mon, day, year), t);
    }],

  /* 日-月-年 at 时间：24 Oct, 2026 at 7:15am */
  [new RegExp('^(\\d{1,2})\\s+(' + MONTH_PAT + ')\\s*,?\\s*(\\d{4})?\\s+at\\s+' + TIME_PAT + '$', 'i'),
    function (m, day, mon, year, t) {
      return joinDate(zhDate(mon, day, year), t);
    }],

  /* 无年份 + at 时间：「Oct 24 at 7:15AM」← 截图那个 */
  [new RegExp('^(' + MONTH_PAT + ')\\s+(\\d{1,2})\\s+at\\s+' + TIME_PAT + '$', 'i'),
    function (m, mon, day, t) {
      return joinDate(zhDate(mon, day), t);
    }],

  /* 纯日期 */
  [new RegExp('^(' + MONTH_PAT + ')\\s+(\\d{1,2}),?\\s+(\\d{4})$', 'i'),
    function (m, mon, day, year) {
      return zhDate(mon, day, year);
    }],
  [new RegExp('^(' + MONTH_PAT + ')\\s+(\\d{1,2})$', 'i'),
    function (m, mon, day) {
      return zhDate(mon, day);
    }],
  /* 单独的月份名（May 排除：它同时是常用词，误伤面太大） */
  [/^(January|February|March|April|June|July|August|September|October|November|December)$/i,
    function (m, mon) {
      return (MONTH_ZH[mon.slice(0, 3).toLowerCase()] || mon) + '月';
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
  /* 分页：VGen 的字符串是 `Page ${r} / ${c}` -> "Page 1 / 2" */
  [/^Page\s+(\d+)\s*\/\s*(\d+)$/i, '第 $1 / $2 页'],
  [/^Page\s+(\d+)$/i, '第 $1 页'],
  /* 被 React 拆开的动作片段：`X submitted a <strong>Request</strong>` */
  [/^submitted an?$/i, '提交了'],
  [/^placed an? order$/i, '下了单'],
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
  [new RegExp('^(As of|Submitted|Published|Updated|Created|Last updated)\\s+(' + MONTH_PAT + '\\s+\\d{1,2},?\\s+\\d{4})\\s+at\\s+' + TIME_PAT + '$', 'i'),
    function (m, prefix, datePart, time) {
      var map = {
        'as of': '截至', 'submitted': '提交于', 'published': '发布于',
        'updated': '更新于', 'created': '创建于', 'last updated': '最后更新于'
      };
      var dm = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(datePart);
      if (!dm) return m[0];
      return (map[prefix.toLowerCase()] || prefix) + ' ' + joinDate(zhDate(dm[1], dm[2], dm[3]), time);
    }],

  /* 单独的时间：7:15 AM / 7:15AM（24 小时制会原样返回，调用方自动跳过） */
  [new RegExp('^' + TIME_REQ + '$'), function (m, t) {
    return zhTime(t || '');
  }],

  /* 单独的星期几：dayjs 的 calendar 在"一周内"时直接输出星期名 */
  [/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i, function (m, d) {
    return WEEKDAY_ZH[d.toLowerCase()] || d;
  }],

  /* 「XXX description」——接稿弹窗里服务名的后缀。服务名本身是用户内容，原样保留 */
  [/^(.{2,120})\s+description$/, '$1 的描述'],

  /* ---- 聊天里的系统行（截图里抓到的漏翻） ---- */
  [/^You left a review for\s+(.+)$/i, '你给 $1 留下了评价'],
  [/^(.{1,60}?)[’']s request was moved to your Waitlist$/i, '$1 的请求已移至你的候补名单'],
  [/^moved to your Waitlist$/i, '已移至你的候补名单'],
  [/^(\d+)\s+commission updates?$/i, '$1 条委托更新'],
  [/^(\d+)\s+review period (?:has |is )?ended$/i, '评价期已结束'],

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
  }],

  /* ------------------------------------------------ 带变量的 placeholder */
  /* 这些是输入框提示里塞了画师名/类型名的，没法精确匹配，只能走模板 */
  [/^Let\s+(.+?)[’']s curators know any additional allowed usage or restrictions$/i,
    function (m, who) { return '让 ' + who + ' 的收藏者了解任何额外的使用许可或限制'; }],

  [/^Write something personal to\s+(.+?)\s+about your project~$/i,
    function (m, who) {
      var zh = TERMS[who];
      return '写点关于你这个项目的私信给 ' + (zh !== undefined ? zh : who) + '～';
    }],

  [/^A short description of who\s+(.+?)\s+is and what they[’']re all about\.$/i,
    function (m, who) {
      var zh = TERMS[who];
      return '简单介绍 ' + (zh !== undefined ? zh : who) + ' 是谁、以及 TA 的一切。';
    }],

  [/^Note to self about this\s+(.+?)\.\.\.$/i, function (m, what) {
    var zh = TERMS[what];
    if (zh === undefined) zh = TERMS[what.toLowerCase()];
    return '关于这个' + (zh !== undefined ? zh : what) + '的私人备注…';
  }],

  [/^Select a\s+(.+)$/i, function (m, what) {
    var zh = TERMS[what];
    if (zh === undefined) zh = TERMS[what.toLowerCase()];
    return '选择一个' + (zh !== undefined ? zh : what);
  }]
];
