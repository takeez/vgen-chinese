/*
 * 通知、动作提示、确认对话框
 *
 * 这一组的来源是 VGen 的通知列表和"确认/接受/拒绝"类弹窗 —— 接稿流程里
 * 出现频率高、但都散落在各种组件里，之前一个词都没收。
 *
 * 注意：`will you accept?` 在源码里其实是 `– will you accept?`（带一个破折号），
 * 所以破折号版本和纯文本版本都要收 —— 否则文字节点里带着破折号就匹配不上。
 */
var DICT_NOTIFY = {
  /* ---- 接稿 / 拒绝 ---- */
  '– will you accept?': '—— 要接受吗？',
  '— will you accept?': '—— 要接受吗？',
  '- will you accept?': '—— 要接受吗？',
  'will you accept?': '要接受吗？',
  'Will you accept?': '要接受吗？',
  'Decline commission': '拒绝委托',
  'Decline commission?': '拒绝这个委托？',
  'Decline commissions?': '拒绝这些委托？',
  'Accept': '接受',
  'Declined': '已拒绝',
  'Accepted': '已接受',
  'Accepted Terms': '已接受条款',
  'Pay to accept': '付款后接受',
  'Not accepting requests': '暂不接受请求',
  'Starts accepting requests': '开始接受请求',
  'Requested milestones have been auto-accepted': '请求的里程碑已自动接受',
  'Your commission has been successfully accepted, funded, and confirmed.':
    '你的委托已成功接受、付款并确认。',

  /* ---- 通知里的动作 ---- */
  'declined a Request': '拒绝了一个请求',
  'cancelled a Request': '取消了一个请求',
  'edited their reply': '编辑了回复',
  'submitted an inquiry': '提交了咨询',
  'sent you a message': '给你发了消息',
  'left a review': '留下了评价',
  'Requested by client': '客户申请',

  /* ---- 条款 / 提醒 ---- */
  'Accept terms to start request': '接受条款以开始请求',
  'Accept terms to start inquiry': '接受条款以开始咨询',
  'Accept terms to join waitlist': '接受条款以加入等候名单',
  'Please accept when you feel comfortable doing so.': '你方便的时候接受即可。',
  'Please note': '请注意',
  'Your accepted Terms of Service have not changed.': '你已接受的《服务条款》没有变化。',

  /* ---- 确认对话框 ---- */
  'Are you sure?': '确定吗？',
  'Do you approve?': '你同意吗？',
  'Are you sure you want to publish?': '确定要发布吗？',
  'Are you sure you want to mark as WIP?': '确定要标记为「进行中」吗？',
  'Are you sure you want to remove this discount?': '确定要删除这个折扣吗？',
  'Are you sure you want to remove this item?': '确定要删除这一项吗？',
  'Are you sure you want to update an active discount?': '确定要修改进行中的折扣吗？',

  /* ---- 表单校验 / 提示 ---- */
  'Please choose a discount value.': '请选择折扣额度。',
  'Please specify a currency.': '请指定币种。',
  'Please enter a valid VSONA': '请输入有效的 VSONA',
  'Please enter an email address first.': '请先填写邮箱地址。',
  'Please select an option for each discovery tag.': '每个发现标签都要选一项。',
  'Please confirm that this product has no deliverables.': '请确认这个商品没有交付物。',
  'Would you like to add any other contact methods?': '要添加其它联系方式吗？',
  'Do you have a deadline?': '这个项目有截止日期吗？',
  'Do you have a deadline for this project?': '这个项目有截止日期吗？',
  'Please try reloading the page and emptying your cache.': '请尝试刷新页面并清除缓存。',

  /* ---- 屏幕阅读器用的（VGen 有 aria 文案，顺手翻） ---- */
  'Are the artist of the piece': '是作品的画师',
  'Are the recipient of the piece': '是作品的接收方'
};
