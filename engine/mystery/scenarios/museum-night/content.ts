// 《恐龙蛋失踪之夜》· 流程、推理题、投票、复盘（服务器端专用：含真相）
import type { AccuseQuestion, CaseFileDef, ChoiceOption, Scenario, StepDef } from '../../types'
import { KIDS_META } from '../meta'
import { CULPRIT, DAZHUANG, DUODUO, ROLES, XIAOMI, YIMING } from './roles'
import { CLUES, LOCATIONS, ROLE_MEMORY, ROLE_START, SECRET_OF } from './clues'
import { NPCS } from './npcs'

const PROLOGUE = `欢迎来到剧本杀！

**规则：**
- 每个人扮演故事里的一个角色，拿到一份**只有自己能看的剧本**。
- 大家一起搜线索、问证人、互相盘问，最后投票：到底是谁干的？
- 真正拿走恐龙蛋的人，叫"**隐藏者**"。隐藏者可能就在你们中间——如果是你，你的剧本第一行就会告诉你。隐藏者可以说谎，也可以把证据藏起来。
- 剧本说你是**侦探**的人：不能说谎，但可以有不想说的秘密。不想说，就说"这是我的秘密"。
- 电脑演的营员、博物馆里的大人，也都有嫌疑。他们不会说谎，但也可能有不想说的秘密。
- 主持人（DM）是电脑。它会带着大家一步一步玩，每段字都能读出来。

**案件：**
星河自然博物馆的"小小讲解员过夜营"，今晚只有四个营员——全市讲解比赛的前四名。你们睡在恐龙大厅角落的帐篷里，头顶就是 12 米长的霸王龙骨架。
大厅正中的玻璃展柜里，放着博物馆的镇馆之宝：一枚 **6800 万岁的恐龙蛋化石**。明天早上 8 点，电视台要来拍它。

**22:30**，整座博物馆突然停电。十分钟后，灯亮了。
**22:45**，保安赵叔叔巡逻时发现：展柜的盖子盖得好好的，锁也锁着——**恐龙蛋却不见了！**
大门 22:15 以后就没开过，蛋一定还在馆里。

馆长明早 7 点到。在那之前，找出是谁拿走了它，把蛋找回来。`

const AUCTION_TEXT = `许姐姐搬来一个工具箱："馆长同意了，这些工具借给你们破案用。可每样只有一个——用你们的营地金币来拍吧！"

**怎么拍：** 四样东西同时出价。每样写下你愿意出几个金币（不想要就写 0），加起来不能超过你有的金币。大家同时亮价：
- 出价最高的人拿走，付自己出的价；没拿到的人，一个金币都不用付。
- 如果最高价一样：谁也拿不到，都不用付。所以可以先商量好谁要什么——不过别忘了，隐藏者也会出价，答应你的话不一定算数。
- 剩下的金币，最后每 4 个换 1 分。

想清楚：工具能帮你找到关键线索，金币能直接变成分。`

const READ2_TEXT = `半夜 12 点，赵叔叔打开了员工区的门："监控室、配电箱、茶水间，你们都可以进去看了。"

先读一读"我又想起来了"：每个人都又想起了一件事。`

const SECRET_PROMPT = `秘密时刻：要不要公开你的秘密卡？

📢 **公开**：所有人都会看到你的秘密卡，更容易相信你不是隐藏者。

🤐 **不公开**：到最后都没公开，加 2 分。可是守秘密的人更容易被怀疑：最后投票时，每有一个人投你，扣 1 分。
选了"不公开"，在聊天里也不能说出秘密的内容——嘴上说出来，也算公开了。

大家同时秘密地选，选完一起揭晓，选了就不能改。可以先在聊天里商量——但别忘了，隐藏者可以说谎。`

const CULPRIT_PROMPT = `秘密时刻：侦探们正在决定要不要公开自己的秘密卡。

你是隐藏者，你有两个选择：

🤐 **什么都不公开**。

🎭 **公开一张"假的秘密卡"**：上面写着你编好的说法——你其实很怕黑，21:30 听见动静就吓得跑回帐篷，停电时一直缩在睡袋里。在别人眼里，它和真的秘密卡一模一样。

大家同时选，选完一起揭晓。`

function secretChoice(roleId: string): { prompt: string; options: ChoiceOption[] } {
  const name = ROLES.find(r => r.id === roleId)?.name ?? ''
  const announce = { dm: `📢 ${name}公开了自己的秘密卡！`, to: 'both' as const }
  if (roleId === CULPRIT) {
    return {
      prompt: CULPRIT_PROMPT,
      options: [
        { id: 'keep', label: '🤐 什么都不公开', effects: [{ setSeatFlag: 'told', value: false }] },
        { id: 'fake', label: '🎭 公开假的秘密卡', desc: '大家看到的是你编的说法', // 先给自己（隐藏者是这张卡的主人，和真秘密卡一样），再给别人
          effects: [{ setSeatFlag: 'told', value: true }, announce, { giveClue: 'yiming_fake' }, { giveClue: 'yiming_fake', to: 'other' }] },
      ],
    }
  }
  return {
    prompt: SECRET_PROMPT,
    options: [
      { id: 'keep', label: '🤐 不公开', desc: '最后加 2 分；可是别人可能会怀疑你', effects: [{ setSeatFlag: 'told', value: false }] },
      { id: 'tell', label: '📢 公开我的秘密卡', desc: '大家更容易相信你', effects: [{ setSeatFlag: 'told', value: true }, announce, { giveClue: SECRET_OF[roleId], to: 'both' }] },
    ],
  }
}

export const FLOW: StepDef[] = [
  { id: 'prologue', kind: 'story', title: '开场 · 恐龙蛋不见了', text: PROLOGUE, seconds: 240, onEnter: [{ giveClue: 'case' }, { giveClue: 'bracelets' }] },
  {
    id: 'read1', kind: 'read', title: '读剧本', chapter: 'act1', seconds: 360,
    text: '读你自己的剧本（可以点「🔊 读给我听」）。剧本只有你能看见：可以把内容说给别人听，但不要把原文念出来，也不要拍给别人看。',
    onEnter: Object.entries(ROLE_START).flatMap(([role, ids]) => ids.map(id => ({ giveClue: id, role }))),
  },
  {
    id: 'intro', kind: 'discuss', title: '自我介绍', seconds: 300,
    text: '轮流介绍你的角色：你是谁？22:30 停电的时候，你在哪儿、在干什么？\n侦探不能说谎，不想说的可以说"这是我的秘密"；隐藏者可以编。\n听的人想一想：谁的话对不上？',
  },
  {
    id: 'auction', kind: 'auction', title: '工具拍卖', text: AUCTION_TEXT, seconds: 180,
    tie: { log: '最高价一样！许姐姐把这件工具放回了工具箱。', label: '出价一样 · 没人拿到' },
    lots: [
      { id: 'lot_flashlight', title: '强光手电筒', desc: '照亮黑乎乎的地方：帐篷区多一个地方可以搜。', item: 'item_flashlight', min: 1 },
      { id: 'lot_magnifier', title: '放大镜', desc: '看清小东西：恐龙大厅多一个地方可以搜。', item: 'item_magnifier', min: 1 },
      { id: 'lot_uv', title: '紫外线灯', desc: '照出隐形墨水写的字：互动区多一个地方可以搜。', item: 'item_uv', min: 1 },
      { id: 'lot_badge', title: '小小讲解员徽章', desc: '最后算分时，直接加 2 分。', item: 'item_badge', min: 1 },
    ],
  },
  {
    id: 'search1', kind: 'search', title: '搜线索（第一轮）', ap: 5, seconds: 480,
    text: '每人有 5 点⚡体力。搜一个地方、问一个问题，都要用掉体力。\n你找到的线索只有你能看见：可以「公开」给所有人，也可以「交给」某一个人，也可以留着不说。\n同一个地方只能被搜一次——谁先搜到就是谁的。',
  },
  {
    id: 'talk1', kind: 'discuss', title: '第一轮讨论', seconds: 360,
    text: '说说你找到了什么。谁的说法和证据对不上？\n「推理题」已经开放：答对了能拿金币。\n下一步是「秘密时刻」：想一想，要不要公开你的秘密卡。',
  },
  {
    id: 'secret', kind: 'choice', title: '秘密时刻', seconds: 240,
    text: '每个人同时秘密地决定：要不要公开自己的秘密卡。选完一起揭晓。',
    choice: Object.fromEntries([YIMING, XIAOMI, DAZHUANG, DUODUO].map(r => [r, secretChoice(r)])),
  },
  {
    id: 'read2', kind: 'read', title: '我又想起来了', chapter: 'act2', text: READ2_TEXT, seconds: 150,
    onEnter: Object.entries(ROLE_MEMORY).map(([role, id]) => ({ giveClue: id, role })),
  },
  {
    id: 'search2', kind: 'search', title: '搜线索（第二轮）', ap: 4, seconds: 420,
    text: '每人有 4 点⚡体力。员工区开放了：监控室、配电箱、茶水间、许姐姐的桌子、大门记录。\n互动区也多了一个可以搜的地方。',
  },
  {
    id: 'talk2', kind: 'discuss', title: '最后的讨论', seconds: 360,
    text: '把证据都摆出来，一个一个排除：\n停电那十分钟里，谁不可能去拿蛋？谁的话和证据对不上？蛋现在在哪儿？拿蛋的人为什么要拿？',
  },
  {
    id: 'accuse', kind: 'accuse', title: '投票', seconds: 300,
    text: '每个人自己投票，别人看不到你投了谁。\n侦探：选出你认为的真相，答对的题有金币奖励。\n隐藏者：把你的一票投给一个人——守着秘密的人被投到会扣分。',
  },
  { id: 'ending', kind: 'ending', title: '真相大白' },
]

export const CASE_FILES: CaseFileDef[] = [
  {
    id: 'cf_dark', title: '推理题：停电的十分钟', desc: '回答两个问题。全答对，得 3 个金币；答错扣 1 个，可以试 2 次。', reward: 3, penalty: 1, maxAttempts: 2,
    opens: 'search1', closes: 'talk2',
    questions: [
      { id: 'when', prompt: '恐龙蛋是什么时候被拿走的？', options: [
        { id: 'early', label: '停电以前（22:30 以前）' },
        { id: 'dark', label: '停电的那十分钟（22:30–22:40）' },
        { id: 'late', label: '来电以后（22:40 以后）' },
      ], answer: 'dark' },
      { id: 'alibi', prompt: '停电那十分钟里，哪两个人一直在一起，都不可能去拿蛋？', options: [
        { id: 'guard_ym', label: '赵叔叔和一鸣' },
        { id: 'guard_dz', label: '赵叔叔和大壮' },
        { id: 'guide_xm', label: '许姐姐和小米' },
        { id: 'guide_dd', label: '许姐姐和朵朵' },
        { id: 'xm_ym', label: '小米和一鸣' },
      ], answer: 'guard_dz' },
    ],
  },
]

const WHO_OPTIONS = [
  { id: YIMING, label: '👓 一鸣' }, { id: XIAOMI, label: '🦕 小米' }, { id: DAZHUANG, label: '🏀 大壮' }, { id: DUODUO, label: '🎨 朵朵' },
  { id: 'guard', label: '👮 保安赵叔叔' }, { id: 'guide', label: '👩‍🏫 讲解员许姐姐' }, { id: 'cleaner', label: '🧹 清洁工刘阿姨' },
]

export const ACCUSE: AccuseQuestion[] = [
  { id: 'who', prompt: '是谁拿走了恐龙蛋？', notRole: CULPRIT, options: WHO_OPTIONS, answer: YIMING, points: 3, bonus: 2 },
  { id: 'where', prompt: '恐龙蛋现在在哪儿？', notRole: CULPRIT, options: [
    { id: 'basket', label: '混在互动区"摸一摸"的蛋筐里' },
    { id: 'backpack', label: '在小米的背包里' },
    { id: 'trex', label: '藏在霸王龙骨架的肚子里' },
    { id: 'out', label: '已经被带出博物馆了' },
  ], answer: 'basket', points: 2, bonus: 1 },
  { id: 'why', prompt: '拿蛋的人为什么要拿走恐龙蛋？', notRole: CULPRIT, options: [
    { id: 'home', label: '太喜欢恐龙蛋了，想趁停电偷偷带回家，摆在自己的书架上' },
    { id: 'protect', label: '听见大人说要把真蛋"换掉""送走"，以为有人要偷，想先藏起来保护它' },
    { id: 'accident', label: '想偷偷摸一下，蛋差点滑掉，怕挨骂，就先把它藏了起来' },
    { id: 'show', label: '想等天亮以后自己"找到"蛋，在电视镜头前出风头' },
  ], answer: 'protect', points: 2, bonus: 1 },
  { id: 'blackout', prompt: '停电是怎么回事？', notRole: CULPRIT, options: [
    { id: 'cooker', label: '大壮在茶水间用小电锅煮泡面，把电闸弄跳了' },
    { id: 'thief', label: '拿蛋的人故意关掉了电闸' },
    { id: 'storm', label: '外面打雷，把电打断了' },
    { id: 'guard', label: '赵叔叔巡逻时关掉的' },
  ], answer: 'cooker', points: 1, bonus: 1 },
  // 隐藏者专属：他的一票也算数（被投的人扣分），自己不因为这题得分
  { id: 'frame', prompt: '你是隐藏者：你要把这一票投给谁？（守着秘密的人被投到会扣 1 分）', onlyRole: CULPRIT,
    options: WHO_OPTIONS.filter(o => o.id !== CULPRIT), answer: '', points: 0 },
]

export const TRUTH: { title: string; text: string }[] = [
  {
    title: '一、那天晚上的时间线',
    text: `**20:30** 合影。拍完照，许姐姐转身接电话，盖子还开着，小米偷偷摸了一下恐龙蛋。许姐姐打着电话把盖子盖上，却忘了把锁按上。一鸣看见了。
**20:40** 小米和一鸣换了手环：小米戴绿色，一鸣戴蓝色。登记表没改。
**21:30** 一鸣上厕所时，在员工休息室门口偷听到许姐姐打电话："明天一早把真的换下来，换成复制品……真的要送走。"大壮和赵叔叔都看见他在门口偷听。
**22:00** 赵叔叔巡逻，蛋还在。刘阿姨擦了展柜玻璃，给沙坑洒水、耙平，数了"摸一摸"蛋：20 个。
**22:10** 朵朵溜上二楼画画。**22:15** 刘阿姨下班，大门从此没再开过。
**22:20** 大壮溜去茶水间，用小电锅煮泡面。
**22:30** 大壮又插上电水壶，电闸跳了，全馆停电，监控也停了。赵叔叔赶到茶水间，抓住大壮，一直把他留在身边。
**22:30–22:40** 黑暗中，一鸣取下锁，掀开展柜，抱出恐龙蛋，再把锁"咔哒"按上；抱着蛋穿过湿沙坑，把它放进"摸一摸"的筐里。二楼的朵朵只看见一个蓝色的手环光点。
**22:40** 来电。监控里，展柜已经空了。赵叔叔把大壮送到帐篷区门口，大壮看见一鸣穿着鞋坐在帐篷里。**22:45** 赵叔叔巡逻时发现蛋不见了。`,
  },
  {
    title: '二、三条证据链',
    text: `**鞋印链：** 沙坑 22:00 刚洒水、耙平，所以上面的鞋印都是后来踩的。一串闪电花纹的小鞋印，从展柜那边穿过沙坑走到蛋筐——帐篷门口只有一鸣的鞋是闪电花纹，鞋缝里还有湿沙子。

**手环链：** 停电时，黑暗里只看得见夜光手环。朵朵看见的是**蓝色**。登记表上蓝色是小米——**这是本案最大的陷阱**。20:40 小米和一鸣换了手环，那天晚上戴蓝色的，是一鸣。只看登记表，就会冤枉小米。

**时间链：** 监控 22:29 蛋还在，22:40 已经没了，所以只能是停电那十分钟。那十分钟里，赵叔叔和大壮一直在一起；许姐姐在打视频电话；刘阿姨 22:15 就下班了。展柜玻璃 22:00 刚擦过，上面新留下的是小孩的手指印——大人都排除了，剩下的只有营员。

**为什么：** 一鸣 21:30 偷听到电话（赵叔叔和大壮都看见了，他的笔记本上也记着）。可许姐姐桌上的拍摄计划写得清清楚楚：换成复制品，是为了让参观的孩子们能摸，**真蛋是要送进恒温库房保护起来**。一鸣只听到了一半，就干了一件大事。`,
  },
  {
    title: '三、每个人的秘密',
    text: `剧本杀结束以后，大家会把所有秘密摊开来看，这叫"**复盘**"。

- 👓 **一鸣**（隐藏者）：拿走了恐龙蛋，想保护它不被"换掉"。
- 🦕 **小米**：拍照时偷偷摸了恐龙蛋；背包里的蛋是礼品店买的模型。她还和一鸣换了手环，差点因此背锅。
- 🏀 **大壮**：半夜在茶水间煮泡面，把全馆的电闸弄跳了——停电是他弄的，可蛋不是他拿的。
- 🎨 **朵朵**：违反营规溜上二楼画画，却因此成了唯一的目击者。

每个人都做了点不该做的事，所以每个人看起来都可疑。可疑不等于干了这件事——要看证据。`,
  },
  {
    title: '四、博弈复盘：为什么这么选？',
    text: `**拍卖：** 大家同时出价，看不见别人出多少。出太高，金币亏了；出太低，拿不到。紫外线灯能直接照出真蛋——所以隐藏者也很想买它：他买到了，别人就用不上了。

**秘密时刻：** 守住秘密，自己能多 2 分；可说出来，大家就能更快抓到隐藏者，每个侦探都能拿团队奖。朵朵手里握着最关键的线索：她说出来，自己少 2 分，却可能让每个侦探都多 2 分。像这样"我选得好不好，还要看别人怎么选"的情况，就叫**博弈**。

**隐藏者：** 他可以抢先拿走线索、编一张假的秘密卡、把票投给别人。侦探能做的，就是把证据摆出来，让谎话对不上。`,
  },
]

export const SCENARIO: Scenario = {
  id: KIDS_META.id,
  title: KIDS_META.title,
  subtitle: KIDS_META.subtitle,
  tagline: KIDS_META.tagline,
  intro: KIDS_META.intro,
  minPlayers: 2,
  maxPlayers: 4,
  era: KIDS_META.era,
  duration: KIDS_META.duration,
  roles: ROLES,
  npcs: NPCS,
  locations: LOCATIONS,
  clues: CLUES,
  flow: FLOW,
  caseFiles: CASE_FILES,
  accuse: ACCUSE,
  endings: [],
  truth: TRUTH,
  currency: { unit: '个金币', icon: '🪙', step: 1 },
  ap: { short: '⚡', long: '体力' },
  theme: 'kids',
  scoreUnit: '分',
  rewardWord: '奖励',
}
