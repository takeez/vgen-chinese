/**
 * 单条查词调试：看看某个字符串到底命中没有、走的是哪条路。
 *
 *   node probe.mjs                        # 跑一批关键回归用例
 *   node probe.mjs "My Requests" "Vibe"   # 查指定字符串
 */

import { loadEngine } from './harness.mjs';

const { TERMS, REGEX_RULES, lookup } = loadEngine();

function dump(s) {
  const out = lookup(s);
  console.log('输入 : ' + JSON.stringify(s));
  if (out !== undefined) {
    console.log('命中 : ' + JSON.stringify(out));
  } else {
    console.log('未命中');
  }
  console.log('');
}

const args = process.argv.slice(2);
if (args.length) {
  args.forEach(dump);
} else {
  /* 关键回归用例：覆盖精确 / 折叠空白 / 引号归一 / 大小写 / 正则 / 组合 */
  [
    'Vibe', 'Static', 'Other',
    'Angry  / Aggressive',                     // 双空格 → 折叠空白
    'Your following\u2019s following',         // 弯引号 → 精确
    "Your following's following",              // 直角引号 → 引号归一
    'Ready \u2192 WIP',
    'My Requests',                             // 大小写回退
    'Account type',                            // 大小写回退
    'Edit Profile',
    '2 days ago',                              // 正则
    'Jan 5, 2026',
    '380,000+ commission services',
    'Page 2 of 5',
    'Slide 1 of 2',
    '(15% off)',
    'From 2D Avatars',                         // 回查词库的组合规则
    'Settings - Account - VGen',
    'My Requests - VGen',
    'Commission human artists | VGen'
  ].forEach(dump);

  console.log('词条数: ' + Object.keys(TERMS).length + '   正则数: ' + REGEX_RULES.length);
}
