// ==UserScript==
// @name         VGen 中文化
// @name:zh-CN   VGen 中文化
// @name:en      VGen Chinese
// @namespace    https://github.com/takeez/vgen-chinese
// @version      __VERSION__
// @description  把 vgen.co（画师委托平台）汉化成简体中文。约 2400 条词条整条精确匹配，不误伤用户自己写的内容；不需要 AI 就能完整使用。可选接 API：一键翻客户需求、聊天自动翻、中文输入自动转英文、提案讨论与报价参考。
// @description:zh-CN 把 vgen.co（画师委托平台）汉化成简体中文。约 2400 条词条整条精确匹配，不误伤用户自己写的内容；不需要 AI 就能完整使用。可选接 API：一键翻客户需求、聊天自动翻、中文输入自动转英文、提案讨论与报价参考。
// @description:en Translate vgen.co into Simplified Chinese with an exact-match term dictionary (no AI needed), plus optional AI help: one-click request translation, auto-translated chat, Chinese-to-English send, and proposal drafting.
// @author       takeez
// @license      MIT
// @homepageURL  https://github.com/takeez/vgen-chinese
// @supportURL   https://github.com/takeez/vgen-chinese/issues
// @updateURL    https://raw.githubusercontent.com/takeez/vgen-chinese/main/dist/vgen-chinese.user.js
// @downloadURL  https://raw.githubusercontent.com/takeez/vgen-chinese/main/dist/vgen-chinese.user.js
// @match        https://vgen.co/*
// @match        https://www.vgen.co/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      api.deepseek.com
// @connect      *
// @noframes
// ==/UserScript==
