/* ==========================================================================
 * 词库 8/9：长句说明文本（分类落地页描述、徽章文案、授权条款、系统提示）
 *
 * 来源：harvest/longtext-real.txt（二次挖掘）。
 * 第一次挖词条时正则写了 {2,80} 的长度上限，且只匹配双引号字符串，
 * 导致这批 60~200 字符的说明段落**全部漏掉**——就是页面上那些英文段落。
 *
 * 已剔除：第三方库内部报错（Sentry / PostHog / LiveKit / hls.js / lottie /
 * Stream.io / Next.js）、代码片段、非英文的其他语言文案。
 * 那些永远不会渲染成 VGen 界面，翻了纯属浪费。
 * ========================================================================== */

var DICT_LONGTEXT = {

  /* ------------------------------------------------ 分类落地页描述 */
  'Optimized for TikTok / Reels / Shorts': '针对 TikTok／Reels／Shorts 优化',
  'Optimized for YouTube / Twitch': '针对 YouTube／Twitch 优化',
  'To start recording, allow the camera access in your browser': '要开始录制，请在浏览器中允许访问摄像头',
  'To start recording, allow the microphone access in your browser': '要开始录制，请在浏览器中允许访问麦克风',
  'Until generative AI is made with Consent, Credit, and Compensation, it is not welcome here.': '在生成式 AI 做到「同意、署名、付酬」之前，这里不欢迎它。',
  'Verified artists, commissions, and reviews, but IRL info stays strictly between you and VGen!': '认证画师、委托与评价都在，但现实身份信息严格保密于你与 VGen 之间！',
  'Everything you need for vtubing / streaming, music, game, and content adventures - fans welcome too!': 'VTubing／直播、音乐、游戏与内容冒险所需的一切——也欢迎粉丝！',
  'Just enough to get them excited and hungry for more!': '刚好勾起他们的兴趣，让他们想要更多！',
  'A trove of services to bring your vision to life through graphic design!': '用平面设计让你的构想成真的服务宝库！',
  'Brand new music that\'s created and composed just for you~': '为你量身创作与编曲的全新音乐～',
  'Instrumental background music that\'s created and composed just for you~': '为你量身创作与编曲的纯音乐背景曲～',
  'Talented voices to bring your stories, scripts, and characters to life~': '有才华的声线，让你的故事、剧本和角色活起来～',
  'Breathe life into unique characters designed just for you.': '为独一无二、专属于你的角色注入生命。',
  'For Twitch, Discord, and everywhere you chat.': '适用于 Twitch、Discord 以及你聊天的任何地方。',
  'Streamline your workflow with stamps and stencils!': '用印章和模板让工作流更顺畅！',
  'Customizable templates to DIY your own professional-looking graphics!': '可自定义的模板，让你自己做出专业感十足的图形！',
  'Add a little fun to your stream immersion or your day-to-day browsing!': '给你的直播沉浸感或日常浏览添点乐趣！',
  'Useful apps and tools to lend a hand or make life more fun!': '帮你一把、或让生活更有趣的实用应用与工具！',

  /* 音乐 / 音频 */
  'How to make my music more full sounding?': '怎么让我的音乐听起来更饱满？',
  '"How to make my music more full sounding?" Harmonies are your answer!': '「怎么让我的音乐听起来更饱满？」和声就是答案！',
  '"Am I on beat?" You will be after your vocals are synced to your music!': '「我跟上拍子了吗？」人声对齐音乐之后就稳了！',
  '"Am I on pitch?" You will be after your vocals are tuned to your music!': '「我音准对吗？」人声调准之后就对了！',
  'Breaking language barriers while keeping to the meaning, mood, and beat~': '跨越语言障碍，同时守住原意、情绪与节拍～',
  'Breaking language barriers to help you better communicate with the world!': '跨越语言障碍，帮你更好地与世界沟通！',
  'Your favourite beat from a song you love, covered from a new perspective!': '你喜欢的歌里最爱的那段节奏，以全新视角翻唱！',
  'Turn your raw recordings into your perfect final track - let\'s make some music!': '把原始录音变成完美的成品曲——我们来做点音乐！',

  /* 2D / 3D 模型 */
  'Detail-oriented reference sheets to solidify your creature\'s appearance.': '细致入微的设定图，让生物的外观稳定下来。',
  'Detail-oriented reference sheets to solidify your character\'s appearance.': '细致入微的设定图，让角色的外观稳定下来。',
  'Detail-oriented reference sheets for various concepts beyond characters and creatures.': '细致入微的设定图，覆盖角色与生物之外的各类概念。',
  'Level up tracking for better coordination between you and your 2D model.': '升级追踪，让你和你的 2D 模型配合更默契。',
  'Level up your tracking so you and your 3D model can move together as one~': '升级追踪，让你和你的 3D 模型如同一体地动起来～',
  'Celebrate support with animations and effects that\'ll make chat say wow!': '用让观众惊呼的动画和特效来庆祝支持！',
  'Customizable and pre-made chibi models to kickstart your VTubing journey ~': '可定制与预制的 Q 版模型，助你开启 VTubing 之旅～',
  'Customizable and pre-made creature models for your pet or VTubing persona ~': '为你的宠物或 VTubing 形象准备的可定制与预制生物模型～',
  'Rigged L2D models/assets, hand-drawn animation, animatics, and motion graphic animations, etc.': '已绑定的 Live2D 模型／素材、手绘动画、动态分镜、动态图形动画等。',
  '3D characters, props, and worlds for streaming, game dev, and everything in between!': '用于直播、游戏开发以及其间一切的 3D 角色、道具与世界！',
  'Up your immersion with mics, desks, and other props that look and feel like you!': '用麦克风、桌子和其它贴合你风格的设备提升沉浸感！',
  'Whether creating content for the world or streaming with just your friends, bring your 2D self to life!': '无论是面向大众做内容，还是只和朋友一起直播，让你的 2D 自我活起来！',
  'No matter what you\'re streaming, overlay your world and bring chat along for the fun.': '不管你播什么，把你的世界叠加上去，带观众一起玩。',
  'Take your streams to the next level with more immersion, more engagement, and more you!': '用更多沉浸感、更多互动、更多「你」，让直播更上一层楼！',
  'Spruce up your sub goals or chat boxes with custom widgets that match you perfectly!': '用完美贴合你的自定义挂件装点订阅目标或聊天框！',

  /* 直播素材 / 表情 */
  'Nothing gets chat more excited than being about to throw things at you.': '没有什么比能往你身上扔东西更让观众兴奋了。',
  'A great first and closing impression to keep viewers engaged and ready for more.': '出色的开场与收尾，让观众保持投入、意犹未尽。',
  'Make a great first impression with reveals that\'ll leave them wanting more.': '用让人意犹未尽的公开形象留下绝佳第一印象。',
  'When are you going to be live this week? Keep your community in the know!': '这周什么时候开播？让你的社区心里有数！',
  'Everything you need to promote your stream event and make everyone say WOW!': '推广直播活动、让所有人惊呼 WOW 所需的一切！',
  'Everything you need to promote your tournament and make everyone say WOW!': '推广赛事、让所有人惊呼 WOW 所需的一切！',
  'Turn clips and moments into lasting stories that people can watch over and over again.': '把片段与瞬间变成让人反复观看的持久故事。',
  'Congrats on your upcoming debut! Now let\'s get you ready to blow chat\'s socks off!': '恭喜即将出道！现在让我们准备好，让观众惊艳到炸！',

  /* 平面 / 品牌 / 网站 */
  'Give your logo that extra edge with animations that people won\'t soon forget.': '用让人过目难忘的动画，让你的标志更有辨识度。',
  'Reactive avatars made for streaming, videos, and hanging out!': '为直播、视频和闲聊打造的反应式头像！',
  'Joined our 1 million user Drawpile challenge.': '参加了我们的百万用户 Drawpile 挑战。',
  'Use a backup verification code to regain access to your account.': '使用备用验证码找回你的账号。',
  'Took part in the DTIYS challenge to celebrate our IG launch.': '参加了庆祝我们 IG 上线的 DTIYS 挑战。',
  'Proud owner of a VG mug.': '自豪的 VG 马克杯拥有者。',
  'Visited the VGen booth at Anime North 2024.': '到访了 Anime North 2024 的 VGen 展位。',
  'VG\'s parents are officially married!': 'VG 的爸妈正式结婚了！',
  'Welcome to the exciting world of VRChat and 3D VTuber Models~': '欢迎来到 VRChat 与 3D VTuber 模型的精彩世界～',
  'Make sure your brand across all of your platforms look and feel like you!': '确保你在所有平台上的品牌看起来、感觉起来都是你！',
  'Need help building and growing your brand? You\'ve come to the right place.': '需要帮你打造并壮大品牌？你来对地方了。',
  'Custom created websites designed to take your brand or project to the next level.': '定制网站，助你的品牌或项目更上一层楼。',
  'Your carrd is your calling card, so be sure to make it looks and feels like you~': '你的 Carrd 就是你的名片，务必让它看起来、感觉起来都是你～',
  'Turn your empty walls into galleries filled with art that makes you happy.': '把空白的墙变成让你开心的画作长廊。',
  'Your go to background, wrapping paper, or something else, patterns are everywhere!': '常备背景、包装纸，或别的什么——图案无处不在！',
  'Intuitive and delightful UI that perfectly complements the rest of your game.': '直观又讨喜的 UI，与你的游戏浑然一体。',

  /* 插画 / 绘画 / 手作 */
  'One of a kind paintings created with brushes and paint, created just for you.': '用画笔和颜料创作的独一无二画作，只为你而作。',
  'One of a kind drawings created with pencil, pen, and /or marker, made just for you.': '用铅笔、钢笔和／或马克笔创作的独一无二画作，只为你而作。',
  'Custom plushies to hug, to squish, to hold, and to love, in the physical world~': '可以抱、可以捏、可以握在手里爱的定制毛绒玩具，就在现实世界～',
  'Bring your existing illustrations to life with animations that\'ll take your breath away.': '用令人屏息的动画，让你已有的插画活起来。',
  'Adorable stock illustrations for your project, created by human artists without GenAI!': '为你项目准备的可爱素材插画，人类画师创作，无生成式 AI！',
  'Beautiful stock illustrations for your project, created by human artists without GenAI!': '为你项目准备的精美素材插画，人类画师创作，无生成式 AI！',
  'Stunning stock graphics ready for your next project, made by humans! NO GenAI!': '为你的下一个项目准备的惊艳素材图形，人类制作！无生成式 AI！',
  'A treasure trove of graphics and assets, all created without the use of GenAI!': '图形与素材的宝库，全部不使用生成式 AI 创作！',
  'Adorable pets to terrifying monsters, created by human artists without GenAI!': '从可爱宠物到恐怖怪物，由人类画师创作，不含生成式 AI！',
  'All the illustrations, textures, icons, vectors, and graphics you need to bring your creative projects to life!': '让你的创意项目落地所需的全部插画、贴图、图标、矢量与图形！',
  'X marks the spot and you\'ve found a treasure trove of interesting categories!': '宝藏就在脚下——你找到了趣味分类的宝库！',

  /* 写作 / 出版 */
  'Find your next read and directly support the self-publishing authors you love!': '找到你的下一本书，直接支持你喜欢的自助出版作者！',
  'Find your next obsession and directly support the self-publishing authors you love!': '找到你的下一个心头好，直接支持你喜欢的自助出版作者！',
  'You have stories and ideas... but how does it play out? who says what? when? how?': '你有故事和点子……但怎么演？谁在什么时候、怎么说话？',
  'You have a character... but who are they and what are they really about? What\'s their story?': '你有个角色……但他到底是谁、是个什么样的人？他的故事是什么？',
  'Bring your stories to life with dynamic images, captivating animations, and engaging videos.': '用动态图像、迷人动画和引人入胜的视频让你的故事活起来。',

  /* 教程 / 咨询 / 学习资料 */
  'Want to improve your digital illustration skills? Get the help you need!': '想提升数字插画技能？来找你需要的帮助！',
  'Want to improve your hand-drawn animation skills? Get the help you need!': '想提升手绘动画技能？来找你需要的帮助！',
  'Want to improve your writing + translation skills? Get the help you need!': '想提升写作 + 翻译技能？来找你需要的帮助！',
  'Improve your graphic design skills by experimenting with learning files!': '用学习文件动手试验，提升你的平面设计技能！',
  'Improve your motion graphic skills by experimenting with learning files!': '用学习文件动手试验，提升你的动态图形技能！',
  'Improve your music production skills by experimenting with learning files!': '用学习文件动手试验，提升你的音乐制作技能！',
  'Improve your audio engineering skills by experimenting with learning files!': '用学习文件动手试验，提升你的音频工程技能！',
  'Improve your coding skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的编程技能！',
  'Improve your UI / UX skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的 UI／UX 技能！',
  'Improve your game mod skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的游戏 Mod 技能！',
  'Improve your animation skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的动画技能！',
  'Improve your voice work skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的配音技能！',
  'Improve your 3D modelling skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的 3D 建模技能！',
  'Improve your 3D animation skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的 3D 动画技能！',
  'Improve your video editing skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的视频剪辑技能！',
  'Improve your Live2D rigging skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的 Live2D 绑定技能！',
  'Improve your digital illustration skills by observing and experimenting with learning files!': '通过观察和动手试验学习文件，提升你的数字插画技能！',
  'No matter how you learn, you\'re sure to find what you need to take your skills to the next level ~': '不管你用什么方式学习，都能找到进阶所需的东西～',
  'To level up or get out of a rut, sometimes all it takes is to try some new tools~': '想进阶或走出瓶颈，有时只需要试试新工具～',
  'Need help navigating through your career? Talk to someone who\'s been in similar places.': '职业方向需要指引？找经历过相似处境的人聊聊。',
  'Personalized guidance to help you reach your business, creative, and life goals.': '个性化指导，帮你达成商业、创作与人生目标。',
  'For safety, fun, and random tools, there\'s a Discord bot for everything~': '为了安全、好玩、以及各种小工具，什么都有对应的 Discord 机器人～',

  /* 游戏 / Mod / 素材 */
  'For you feed may take a few minutes to update': '为你推荐的信息流可能需要几分钟更新',
  'Once purchased by a single buyer, this item will never be restocked again.': '一旦被一位买家买走，这件商品将不再补货。',
  'Want to create merch but not sure how to start or scale? You\'ve come to the right place.': '想做周边却不知从何开始或如何扩大？你来对地方了。',
  'Create for yourself or sell some inspired comms, illustration bases are here to help!': '自己创作或接些有灵感的委托——插画底稿来帮忙！',
  'You never know when inspiration will hit, but these poses and references might help~': '灵感何时降临说不准，但这些姿势和参考或许能帮上忙～',
  'Run by an individual or organization that subcontracts other out-of-house artists+.': '由个人或机构运营，外包给其它外部画师+。',
  'Unleash your potential with memorable designs and eye-catching visuals that\'ll make your audience say wow!': '用令人难忘的设计和吸睛的视觉释放你的潜力，让观众惊呼！',

  /* ------------------------------------------------------ 徽章 / 成就 */
  'Took part in the #VGDTIYS challenge.': '参加了 #VGDTIYS 挑战。',
  'Took part in VG\'s 2nd birthday party.': '参加了 VG 的两岁生日会。',
  'Took part in the #GenieDTIYS March 2026 challenge.': '参加了 2026 年 3 月的 #GenieDTIYS 挑战。',
  'Took part in the DTIYS challenge to celebrate our IG launch.': '参加了庆祝我们 IG 上线的 DTIYS 挑战。',
  'Took part in the DTIYS challenge to celebrate 50K on Twitter/X.': '参加了庆祝 Twitter/X 粉丝破 5 万的 DTIYS 挑战。',
  'Took part in the Polaroid DTIYS challenge for VG\'s 3rd birthday.': '参加了 VG 三周年庆的拍立得 DTIYS 挑战。',
  'Came to our first livestream to celebrate the release of shop.': '参加了我们庆祝商店上线的首场直播。',
  'Came to our SPRING26 release livestream.': '参加了我们的 SPRING26 发布直播。',
  'Came to our SUMMER25 release livestream.': '参加了我们的 SUMMER25 发布直播。',
  'Came to our SUMMER26 release livestream.': '参加了我们的 SUMMER26 发布直播。',
  'Came to our FALL25 VSONA release livestream.': '参加了我们的 FALL25 VSONA 发布直播。',
  'Visited the VGen booth at OffKai 2026.': '到访了 OffKai 2026 的 VGen 展位。',
  'Visited the VGen booth at OshiUpLink 2026.': '到访了 OshiUpLink 2026 的 VGen 展位。',
  'Visited the VGen booth at Anime North 2024.': '到访了 Anime North 2024 的 VGen 展位。',
  'Joined us to celebrate our first 100K followers on Twitter/X and Discord.': '参加了我们庆祝 Twitter/X 与 Discord 粉丝破 10 万的活动。',
  'Contributed their original music to VG Radio.': '向 VG Radio 贡献了原创音乐。',
  'Served as an official VGen community moderator.': '曾担任 VGen 官方社区版主。',
  'Pledged for VG in our first ever Makeship drop.': '在我们首次 Makeship 众筹中支持了 VG。',
  'Shop Beta partner whose feedback and support helped bring VGen Shop to life.': '商店 Beta 合作伙伴，其反馈与支持帮助 VGen 商店落地。',
  'App Alpha partner whose feedback and support helped shape the VGen mobile app.': 'App Alpha 合作伙伴，其反馈与支持塑造了 VGen 移动端应用。',
  'Trusted Artist and Shopkeeper with a proven track record of quality work, service, and products.': '作品、服务与商品质量有口皆碑的值得信赖的画师兼店主。',

  /* -------------------------------------------------------- 授权条款 */
  'Creation of digital or physical (ie. print) end products for personal enjoyment': '为个人欣赏而制作数字或实体（如印刷）成品',
  'For businesses who want to create, promote, and re-sell their own digital or physical end products made with the asset': '适用于想用该素材创作、推广并转售自有数字或实体成品的商家',
  'For content creators and businesses who want to use the asset as part of creating and distributing commercial and monetized digital content': '适用于想将该素材用于创作和分发商业、变现数字内容的内容创作者与商家',
  'Creation and distribution of digital end products shared to commercial and monetized social and content platform accounts belonging to the Licensee': '制作并分发数字成品，发布到被授权方拥有的商业、变现社交媒体与内容平台账号',
  'Creation and distribution of non-competing digital end products shared to non-commercial and non-monetized social and content platform accounts belonging to the Licensee': '制作并分发非竞争性数字成品，发布到被授权方拥有的非商业、非变现社交媒体与内容平台账号',
  'Creation and distribution of digital and physical content to promote the re-selling of value-add digital or physical end products created by the Licensee': '制作并分发数字与实体内容，以推广被授权方创作的增值数字或实体成品的转售',

  /* ------------------------------------------------ 委托流程 / 表单说明 */
  'Client submits request form. Choose to accept by sending custom scope, price, and time. Client pays to confirm.': '客户提交需求表。你选择接受并给出范围、价格与时间。客户付款后确认。',
  'Client pays a fixed price to submit request form. Requests are auto-accepted and confirmed instantly.': '客户支付固定价格后提交需求表。请求会自动接受并立即确认。',
  'The client has also Boosted this commission as an extra token of appreciation for the artist and work!': '客户还「助推」了这笔委托，作为对画师与作品的额外心意！',
  'This is a Boosted Verified VGen commission': '这是一笔「已助推认证」的 VGen 委托',
  'This media was verified by a VGen client': '该素材已由 VGen 客户认证',
  'May I publicly stream / share the work with credit?': '我可以公开直播／分享作品并署名吗？',
  'Refers to your preferred completion date. Artists are not required to deliver by this date. Once you receive a proposal, make sure the guaranteed delivery date fits with your timeline before accepting. Rush order fees may apply.': '指你希望完成的日期。画师没有义务在此日期前交付。收到提案后，请在接受前确认「保证交付日期」符合你的时间安排。可能产生加急费用。',
  'Once you submit your request, I\'ll review it to determine if I\'m the right fit for your needs. If so, I\'ll send you a proposal with your exact pricing and timing before we move forward. Please provide as much detail upfront as possible!': '你提交需求后，我会评估自己是否适合。如果合适，我会在推进前给你一份包含确切价格与时间的提案。请尽量一开始就提供详细需求！',
  'Once you start chatting, you\'ll be able to message and manage your commission or request directly in the chat.': '开始聊天后，你就能直接在聊天里沟通并管理你的委托或请求。',
  'Character reference sheets, PSD for rigging, mood boards, sample of poses / angles / expressions, any other relevant files or links.': '角色设定图、用于绑定的 PSD、情绪板、姿势／角度／表情样例，以及其它相关文件或链接。',
  'Drag your files here to add to your post': '把文件拖到这里以添加到你的帖子',
  'You\'ve reached the maximum number of files': '你已达到文件数量上限',
  'Usernames can only contain numbers, letters, underscores and dashes': '用户名只能包含数字、字母、下划线和连字符',

  /* ------------------------------------------------------ 账号 / 安全 */
  'Your authenticator app should have a 6-digit code for VGen that regenerates every 30s. Enter it here before it expires!': '你的验证器应用里应该有一个 VGen 的 6 位验证码，每 30 秒刷新一次。请在过期前输入！',
  'We will NEVER show you these codes again. If you lose them, you will need to regenerate them.': '我们不会再次显示这些代码。如果丢失，你需要重新生成。',
  'Use these backup codes to recover your account in case you lose access to your authenticator app.': '如果你无法使用验证器应用，可用这些备用码找回账号。',
  'Use a backup verification code to continue.': '使用备用验证码以继续。',
  'Your birthdate will not be shown publicly. Confirm your own age, even if this account is for a business. This will help us customize your experience on VGen.': '你的出生日期不会公开显示。即使这是企业账号，也请确认你自己的年龄。这有助于我们为你定制 VGen 体验。',
  'Gentle reminder to never share your account login, payment, or payout information on- or off-site. Official VGen staff will never ask for your personal information through DMs.': '温和提醒：无论站内站外，都不要分享你的账号登录信息、支付或收款信息。VGen 官方人员绝不会通过私信索要你的个人信息。',
  'Creating an account means you\'re agreeing to our': '创建账号即表示你同意我们的',
  'This site is protected by reCAPTCHA and the Google': '本站受 reCAPTCHA 保护，适用 Google 的',
  'If you\'re still having trouble, get help': '如果仍然有问题，获取帮助',

  /* ---------------------------------------------------------- 系统提示 */
  'Your session has expired. Please reload the page.': '你的会话已过期，请刷新页面。',
  'Please try reloading the page and emptying your cache.': '请尝试刷新页面并清空缓存。',
  'Error connecting to chat, refresh the page to try again.': '连接聊天失败，刷新页面重试。',
  'This message did not meet our content guidelines': '这条消息不符合我们的内容准则',
  'Reached the vote limit. Remove an existing vote first.': '已达投票上限，请先移除一个已有投票。',
  'No matches. Adjust your filters to see more Products.': '没有匹配结果。调整筛选条件以查看更多商品。',
  'There\'s nothing more immersive than the perfect background music~': '没有什么比完美的背景音乐更让人沉浸～',

  /* ------------------------------------------------------------ 站点介绍 */
  'VGen is a commissions hub connecting VTubers, streamers, and content creators with human artists+. Find everything you need to become a VTuber, streamer, YouTuber ...': 'VGen 是连接 VTuber、主播、内容创作者与人类画师+ 的委托平台。找到你成为 VTuber、主播、YouTuber 所需的一切……'
};
