// ==UserScript==
// @name         VGen 中文化
// @name:zh-CN   VGen 中文化
// @namespace    https://github.com/takeez/vgen-chinese
// @version      __VERSION__
// @description  Translate vgen.co into Simplified Chinese with a term dictionary (no AI required for the UI).
// @description:zh-CN 把 vgen.co 界面汉化成简体中文。词库式整条精确匹配，不误伤用户自己写的内容；可选接 API 辅助翻译。
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
