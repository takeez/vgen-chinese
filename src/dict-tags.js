/* ==========================================================================
 * 词库 7/7：筛选标签胶囊（li.filterPillWrapper）
 *
 * ⚠️ 这批是 VGen 的标签体系，字面看着像用户内容，但它是**浏览/筛选界面**
 *    的一部分，翻了才看得懂。如果你更希望标签保持英文，把本文件从
 *    build.mjs 的 DICT_FILES 里去掉即可，其它词库不受影响。
 *
 * 这些键是小写形式；引擎有大小写回退，所以 Alien / alien 都能命中。
 * ========================================================================== */

var DICT_TAGS = {

  /* ------------------------------------------------------ 角色 / 物种 */
  'oc': '原创角色',
  'oc art': '原创角色图',
  'oc x canon': '原创角色 × 原作角色',
  'original character': '原创角色',
  'original character art': '原创角色图',
  'original character artwork': '原创角色作品',
  'sona': '个人形象',
  'persona': '人格形象',
  'self insert': '自我代入',
  'yumeship': '梦女向',
  'human': '人类',
  'humanoid': '类人',
  'anthro': '兽人',
  'furry': '福瑞',
  'fursona': '兽设',
  'kemonomimi': '兽耳',
  'cat': '猫',
  'cat girl': '猫娘',
  'catgirl': '猫娘',
  'dog': '狗',
  'fox': '狐狸',
  'wolf': '狼',
  'bunny': '兔子',
  'kitsune': '狐妖',
  'dragon': '龙',
  'demon': '恶魔',
  'demon oc': '恶魔原创角色',
  'angel': '天使',
  'fairy': '妖精',
  'ghost': '幽灵',
  'elf': '精灵',
  'mermaid': '人鱼',
  'monster': '怪物',
  'vampire': '吸血鬼',
  'succubus': '魅魔',
  'shapeshifter': '变形者',
  'robot': '机器人',
  'pirate': '海盗',
  'witch': '女巫',
  'wizard': '法师',
  'princess': '公主',
  'idol': '偶像',
  'magical girl': '魔法少女',
  'mascot': '吉祥物',
  'pet': '宠物',
  'alien': '外星人',
  'alien oc': '外星人原创角色',
  'tiefling': '提夫林',
  'ttrpg character': '桌游角色',
  'dnd': 'D&D',
  'dungeons and dragons': '龙与地下城',
  'rp': '角色扮演',

  /* ------------------------------------------------------ 主题 / 风格 */
  'anime': '动漫',
  'chibi': 'Q 版',
  'cute': '可爱',
  'art': '美术',
  'artist': '画师',
  'character design': '角色设计',
  'fanart': '同人图',
  'fantasy': '奇幻',
  'cyberpunk': '赛博朋克',
  'goth': '哥特',
  'horror': '恐怖',
  'space': '太空',
  'magic': '魔法',
  'envtuber': '环境系 VTuber',
  'vtuber': 'VTuber',
  'pngtuber': 'PNGtuber',
  'streamer': '主播',
  'pink': '粉色',
  'purple': '紫色',
  'female': '女性',
  'male': '男性',
  'femboy': '伪娘',
  'girl': '女孩',

  /* ------------------------------------------------------ 作品 / 题材 */
  'genshin impact': '原神',
  'ffxiv': '最终幻想 14',
  'ffxiv oc': 'FF14 原创角色',
  'pokemon': '宝可梦',
  'mlp': '小马宝莉'
};
