# VGen 中文化

vgen.co 汉化油猴脚本。词库整条精确匹配，只翻界面，用户自己写的东西不动。可选接 AI 处理客户需求和对话。

[![安装](https://img.shields.io/badge/%E5%AE%89%E8%A3%85-%E7%82%B9%E8%BF%99%E9%87%8C-2ea44f?style=for-the-badge)](https://raw.githubusercontent.com/takeez/vgen-chinese/main/dist/vgen-chinese.user.js)

## 装

装着篡改猴，开着开发者模式（Edge 在 `edge://extensions` 左下角，MV3 之后没这个跑不了用户脚本），点上面的按钮。

GreasyFork 同步发了一份：`greasyfork.org/zh-CN/scripts/598815`。两边内容一样，各自独立更新。

## 汉化

2400 词条，77 条正则。纯本地，不联网，不要 key。

整条匹配，不做模糊。没收录就留英文，不猜。日期页码这类拼接文本走正则（`Today at 7:15 AM`、`Page 1 / 2`、`3 hr ago`），不然永远补不完。

用户内容——画师名、服务标题、需求原文——不在范围内，也不进待翻清单。

字体也修了。VGen 的栈里只有 Noto Sans JP/KR/TC，没有简体，中文按日文字形渲染，看着像繁体。跟编码无关，是字形问题。覆盖 `font-family` 解决，细节在[开发笔记](./开发笔记.md)。

## AI

可选。自己准备 OpenAI 兼容的 key，默认 DeepSeek。没有 key 就只用汉化。

- 接稿弹窗里客户写的需求，点「译」就地变中文
- 聊天双方消息自动翻，右下角 `EN` 看原文，按 message-id 缓存
- 输入框打中文，点发送不会发出去，先转英文，改完再点一次才真发。带上下文，代词不会指错
- 提案标题旁「讨论这单」，读当前弹窗做上下文，聊完生成范围文本，一键填入

发出去的是英文，看到的是中文。全程点击触发。

一次翻译几厘钱，讨论一单几分钱。

## 已知问题

- VGen 用 `slice` 截断的长文本（列表里那种 `Character Re`）根本不在 DOM 里，翻不了
- `input` 的 `value` 不动
- `<option>` 只翻带显式 `value` 的。没有 value 的，提交值就是文本，翻了表单就坏
- `<pre>` 里的代码块靠 `isCodeBlock` 排除，是按 class 猜的，哪天 VGen 换写法可能误判
- Edge 大版本更新后开发者模式可能被重置

## 许可

MIT，与 VGen 无关。
