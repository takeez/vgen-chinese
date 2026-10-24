/*
 * 输入框提示文案（placeholder / title / aria-label）
 *
 * 为什么要单独一个文件：placeholder 是**属性**，不是文本节点。
 * 引擎的 TRANS_ATTRS 会读 placeholder / title / aria-label / alt 四个属性，
 * 所以只要词库里有，就能翻。
 *
 * 一个特殊处理：VGen 有几段多行 placeholder（两段之间是 \n\n），
 * 而 lookup() 会把连续空白折叠成一个空格再查，所以这里的键写成**折叠后的单行**，
 * 就能同时命中多行原文和单行原文。
 *
 * 来源：从 VGen 的 525 个 JS chunk 里精确挖出所有 `placeholder:` 字符串字面量
 * （tools/mine-placeholders2.mjs），再过滤掉已被词库覆盖的、纯格式示例（XX.XX、
 * ABC123、https://…）和带 ${插值} 的（那些走 regex.js）。
 */
var DICT_PLACEHOLDER = {
  /* ---- 输入框通用 ---- */
  'Type your message...': '输入消息…',
  'Be as detailed as you like...': '想写多详细都可以…',
  'Write a brief description here': '在这里写一段简短描述',
  'Enter new name': '输入新名称',
  'Add tags...': '添加标签…',
  'Add a title to your reference': '给你的参考图加个标题',
  'Add a Spotify song link': '添加 Spotify 歌曲链接',
  'Spotify song link': 'Spotify 歌曲链接',
  'Social media link': '社交媒体链接',
  'Social media link ': '社交媒体链接',
  'Link': '链接',
  'X / Instagram / credit URL': 'X／Instagram／署名链接',
  'Name / nickname': '名称／昵称',
  'Character name': '角色名',
  'VSONA name': 'VSONA 名称',
  'Section name': '分区名称',
  'Custom trait': '自定义特征',
  'Custom license': '自定义授权',
  'Write tagline': '写标语',
  'Optional label (phobias, etc)': '可选标签（如恐惧症等）',
  'Optional label ': '可选标签',
  'Sister, pet, etc.': '姐姐、宠物等',
  'Min (e.g. Cold)': '最小（如「冷淡」）',
  'Max (e.g. Friendly)': '最大（如「友善」）',
  'e.g. hair color': '例：发色',
  'e.g., Designer': '例：设计师',
  'e.g. VTuber outfit design, animated emote': '例：VTuber 服装设计、动态表情',
  'Ex. Twitch': '例：Twitch',
  'Ex. Twitter': '例：Twitter',
  'Ex. writing': '例：写作',
  'Ex. https://trello.com/': '例：https://trello.com/',
  'e.g. VAT, GST, HST': '例：增值税、消费税、HST',
  'e.g. 12345 67890 VG0000': '例：12345 67890 VG0000',
  'e.g. VGFC OIAN MFIS RBOI': '例：VGFC OIAN MFIS RBOI',
  'Option name (e.g. Size)': '选项名称（如：尺寸）',
  'Attribute (e.g. # of emotes)': '属性（如：表情数量）',
  'Value (e.g. 5)': '值（如：5）',

  /* ---- 地址表单 ---- */
  'Address line 1': '地址第一行',
  'Address line 2': '地址第二行',
  'Address line 1*': '地址第一行*',
  'City*': '城市*',
  'Postal code*': '邮政编码*',

  /* ---- 委托提案 ---- */
  "Confirm what's going to be done if anything was unclear from the service description or additional add-ons were requested. If everything is covered by the service description already, you can just send a \"Thank you for your commission!\"":
    '确认将要完成的内容 —— 如果服务说明里有不清楚的地方，或者客户要求了附加项。如果服务说明已经涵盖了一切，你也可以只发一句「感谢你的委托！」',
  'What are you offering?': '你提供什么？',
  'Add a description of the service': '添加服务描述',
  'The terms you and the client will adhere to': '你和客户都要遵守的条款',
  'Note to client': '给客户的备注',
  'Note to self about order...': '关于这笔订单的私人备注…',
  'Note to self about this commission...': '关于这个委托的私人备注…',
  'Note to self about this gallery piece...': '关于这幅画廊作品的私人备注…',
  'Request template': '请求模板',

  /* ---- 评价 / 审核 ---- */
  'Leave a written review (optional)...': '写下评价（可选）…',
  'Write a public review (optional) ...': '写公开评价（可选）…',
  'Write a semi-public review (optional) ...': '写半公开评价（可选）…',
  'Write a private note (optional) ...': '写私人备注（可选）…',
  'Write a public response here...': '在这里写公开回复…',
  'Add proof or context... (optional)': '添加凭证或说明…（可选）',
  'Provide details and evidence here ...': '在这里提供细节和证据…',
  'How did you incorporate this month\'s theme into your piece?': '你是如何把本月主题融入作品的？',
  'My submission': '我的投稿',

  /* ---- 自定义问答表单 ---- */
  'Question': '问题',
  'Answer': '回答',
  'Choice': '选项',
  'Long text answer': '长文本回答',
  'Short text answer': '短文本回答',
  'New Form': '新表单',
  'This will be shown to clients before they submit their request': '这段会在客户提交请求前展示给他们',

  /* ---- 商品 / 服务编辑器 ---- */
  'Describe your product here...': '在这里描述你的商品…',
  'Write any details your customer should to know about how to access, set up, install, or use your product...':
    '写下客户需要知道的细节：如何获取、配置、安装或使用你的商品…',
  'Add a small blurb for how amazing it is to purchase your bundle, or anything else you\'d like!':
    '写一段小简介，说说买你的组合包有多棒，或者任何你想说的话！',
  'Other (additional fees may apply)': '其他（可能产生额外费用）',
  'New Bundle': '新组合包',
  'New Service': '新服务',
  'New Showcase': '新作品展示',
  'New gallery piece': '新画廊作品',
  'Wishlist': '愿望单',
  'No response': '无回复',
  'Franchise': '所属作品',
  'height': '身高',

  /* ---- 画廊 / 角色 ---- */
  'Add a backstory, caption, details, or whatever else you\'d like to include. Write a little... or a lot... (or leave this completely blank)... up to you!':
    '可以写背景故事、配文、细节，或任何你想补充的内容。写一点也行…写很多也行…（也可以完全留空）…随你！',
  'What\'s changed in this update?': '这次更新改了什么？',
};
