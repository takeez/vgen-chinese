/* ==========================================================================
 * 词库：第三轮补漏（设置页发票/通知/支付/安全）
 *
 * 来源：
 *   1) 用户截图上可见的英文（这是最权威的，因为是真实渲染结果）
 *   2) 顺着关键词在 JS 里继续挖到的邻近文案
 *
 * 备注：截图里那两句支付页说明（"Processor availability..."、
 * "You'll be able to add sales tax profiles..."）在 21.3 MB JS 里
 * 用多种关键词都搜不到 —— 疑似服务端渲染或来自 API。仍收录，因为
 * 键就是页面上的原文，只要 DOM 里出现就能命中。
 * ========================================================================== */

var DICT_ROUND3 = {

  /* ------------------------------------------------- 发票预览的字段名 */
  'FROM': '来自',
  'BILL TO': '收件方',
  'NOTE': '备注',
  'Client Name': '客户姓名',
  'Client name': '客户姓名',

  /* ------------------------------------------------------ 发票设置说明 */
  '"Billing address" section will appear in all your request form. Collected details will appear in your invoices.': '「账单地址」区块会出现在你所有的需求表单中。收集到的信息会显示在你的发票上。',
  'Asking for ANY personal details may deter clients, but may be necessary for your tax compliance.': '索取任何个人信息都可能让客户却步，但或许是你税务合规所必需的。',
  'Edits will apply to future requests. You can manually update missing information for existing commissions in your Commission details or Wallet.': '修改仅适用于未来的请求。已有委托缺失的信息，你可以在「委托详情」或「钱包」中手动补充。',
  'Edits will apply to future-generated invoices. You can manually update missing information for existing commissions in your Commission details or Wallet.': '修改仅适用于之后生成的发票。已有委托缺失的信息，你可以在「委托详情」或「钱包」中手动补充。',
  'Edits will apply to future-generated invoices. Previously downloaded invoices will be outdated.': '修改仅适用于之后生成的发票。此前已下载的发票将失效。',
  'This shows up under the "NOTE" section in all of your invoices unless it is overwritten in specific invoices.': '它会显示在你所有发票的「NOTE」区块下，除非在某张具体发票中被覆盖。',

  /* ------------------------------------------------------ 支付 / 提现 */
  'Processor availability depends on where you\'re located. Actual payout method depends on how clients choose to pay.': '可用的支付处理渠道取决于你所在的地区。实际提现方式取决于客户选择的付款方式。',
  'You\'ll be able to add sales tax profiles directly in your proposals. Note that these should only be used for government-reported sales taxes.': '你可以直接在提案中添加销售税档案。注意：这些只应用于需向政府申报的销售税。',
  'Action required': '需要操作',
  'In order to receive payouts, you must activate at least one payout method.': '要接收提现，你必须至少激活一种提现方式。',
  'Payout country': '提现国家／地区',
  'This is where your bank is based and determines your eligible payout methods. Once set, you will not be able to change this.': '这是你银行所在地，决定你可用的提现方式。设置后无法更改。',
  'No sales tax will be applied to this product': '此商品不会收取销售税',
  'Exclude sales tax': '排除销售税',
  'Add sales tax': '添加销售税',
  'Note to only use these for government-reported sales taxes.': '注意：这些只应用于需向政府申报的销售税。',
  'Go to settings': '前往设置',

  /* ---------------------------------------------------------- 通知设置 */
  'Personal recommendations': '个性化推荐',
  'Occasional VGen announcements': '偶尔的 VGen 公告',
  'Occasional artist announcements': '偶尔的画师公告',

  /* ------------------------------------------------------ 安全 / 私信 */
  '"Chat" button on profile': '主页上的「Chat」按钮',
  '"Chat" button on services': '服务页上的「Chat」按钮'
};
