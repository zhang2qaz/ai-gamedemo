// 《摇摆州》· 流程、案卷、指认、复盘（服务器端专用，含剧透）
import type { AccuseQuestion, CaseFileDef, Scenario, StepDef } from '../../types'
import { ETHAN, MANDY, ROLES } from './roles'
import { CLUES, LOCATIONS } from './clues'
import { NPCS } from './npcs'
import { SCENARIO_META } from '../meta'

const PROLOGUE = `2016 年 11 月 8 日，星期二，佛罗里达州棕榈滩。

大选之夜。十六年前，这个州几百张有争议的选票决定了谁是总统；今晚，佛罗里达又一次是全美国最大的摇摆州。

滨海大道尽头的海葡萄庄园灯火通明。主人吉迪恩·万斯，七十八岁，靠柑橘园和远洋航运起家的棕榈滩首富，两党都捐钱——谁赢，他都不输。今晚他大宴八方：红州的金主、蓝州的说客、迈阿密来的巴西开发商、《棕榈滩纪事报》的记者，还有俱乐部里最漂亮的"海葡萄女郎"。

七点整，宾客们照老规矩把手机交给安保室。自从十六年前那个夜晚之后，这座庄园里就不许有镜头。

九点，吉迪恩举起酒杯："今晚十一点半，我要和陪了我三十年的罗丝订婚。等美国做出了它的选择，凌晨三点，我也会宣布我的决定。"

大厅的大屏幕上，CNN 的选举地图一块一块地变红、变蓝。

你们两个人，今晚都在这座房子里工作。你们都带着一个秘密来到这里。`

const AUCTION_TEXT = `21:30，慈善拍卖开始，善款捐给"海员遗孤基金"。

拍卖师是吉迪恩本人。他笑着说："今晚的拍品都很特别——也许比你们想的更有用。"

规则：四件拍品同时暗标。不想要的拍品出价 0 即可放弃；要出价的话，每件最低 $500、以 $100 为单位，总出价不能超过你的现金。价高者得，付自己的出价；只有一方出价，就以这个价成交；**双方出价相同，会被维克多·奥利维拉以更高的价钱截走**，你们谁都拿不到；双方都放弃则流拍。

每件拍品都会在天亮前的「黎明计票」里派上用场。`

const DISCOVERY = `02:57，巴西开发商维克多·奥利维拉从露台冲进大厅："灯塔那边出事了！"

吉迪恩·万斯仰面躺在灯塔底部的珊瑚石平台上——两分钟前，给他送香槟的老酒保赫克托发现了他。03:02，普莱斯医生蹲下摸了摸脉搏，摇头："喝多了，心脏又不好，一个人上塔……失足。"

03:12，员工楼里传来第二声尖叫。罗丝·阿尔瓦雷斯死在自己的床上，手还搭在电话上。普莱斯看了一眼："心脏病。大概是听到噩耗……可怜的罗丝。"

普雷斯顿·万斯——如今这座庄园的继承人——下令锁上大门："律师来之前，谁也不许报警。这个家已经够丢人了。"普莱斯点点头："警长是我的老朋友，我请他六点过来。"

宾客们被留在大厅，手机仍锁在安保室。只有工作人员还能在庄园里走动。

记者乔安·默瑟走到你们身边，压低声音："同一座房子，同一座灯塔，同一个大选之夜，又死了人。十六年前我什么都没查到。你们俩在这里工作，哪儿都能去——天亮之前，找出真相。"

现在是凌晨 03:20。离警长到达还有两个小时四十分钟。`

const ACT3_TEXT = `凌晨 04:15。大屏上，特朗普的胜选演讲已经重播了第三遍。

有人收到了一封信。有人听到了一条留言。`

const FINALE_TEXT = `05:00。普雷斯顿拍了拍手："六点，警长和律师就到。所有人都要做笔录。"

普莱斯医生在大厅另一头整理袖口，冲你们微微一笑。

乔安低声说："你们交给警长的东西，决定了明天全世界相信什么。在佛罗里达——"她看了一眼屏幕上那张红色的地图——"**计票就是一切。**"`

export const FLOW: StepDef[] = [
  { id: 'prologue', kind: 'story', title: '序幕 · 大选之夜', text: PROLOGUE, seconds: 300 },
  {
    id: 'act1', kind: 'read', title: '第一幕 · 八方豪宴', chapter: 'act1', seconds: 900,
    text: '请阅读你的私密剧本。注意：不要把原文发给对方——你可以选择说什么、隐瞒什么。',
    onEnter: [{ giveClue: 'frank_letter', role: ETHAN }],
  },
  {
    id: 'intro', kind: 'discuss', title: '自我介绍', seconds: 420,
    text: '以角色身份向对方介绍自己：你是谁、今晚为什么在这里、你和吉迪恩、罗丝是什么关系。可以说真话，也可以撒谎。',
  },
  {
    id: 'auction', kind: 'auction', title: '21:30 · 慈善拍卖', text: AUCTION_TEXT, seconds: 420,
    tie: { log: '被维克多·奥利维拉以更高的价钱截走', label: '平局 · 被维克多截走' },
    lots: [
      { id: 'lot_lawyer', title: '罗伊·凯斯勒律师的一年法律顾问', desc: '棕榈滩最贵的刑辩律师。【终局】一级谋杀降为较轻的罪名（只降一级）。', item: 'item_lawyer', min: 500 },
      { id: 'lot_headline', title: '《棕榈滩纪事报》头版专访', desc: '乔安亲自执笔。【终局】你递交的一张证据权重 ×2（限一次）。', item: 'item_headline', min: 500 },
      { id: 'lot_recount', title: '2000 年重新计票纪念放大镜', desc: '棕榈滩县计票员用过的放大镜。【终局】事先布置，揭晓时作废对方本轮递交的一张证据（限一次）。', item: 'item_recount', min: 500 },
      { id: 'lot_yacht', title: '"第二次机会号"游艇周末', desc: '附钥匙，码头就在庄园西侧。【终局】第三轮可出海逃亡（不被起诉，放弃遗产）。', item: 'item_yacht', min: 500 },
    ],
  },
  {
    id: 'act2', kind: 'read', title: '第二幕 · 两点四十分', chapter: 'act2', seconds: 900,
    text: '请阅读你的私密剧本：从拍卖结束到凌晨三点二十分，你做了什么、看到了什么。',
    onEnter: [
      { giveClue: 'a_saw', role: MANDY }, { giveClue: 'a_confess', role: MANDY },
      { giveClue: 'b_saw', role: ETHAN }, { giveClue: 'b_confess', role: ETHAN },
    ],
  },
  { id: 'discovery', kind: 'story', title: '噩耗', text: DISCOVERY, seconds: 300 },
  {
    id: 'search1', kind: 'search', title: '搜证一 · 03:20', ap: 8, seconds: 1080,
    text: '每人 8 点行动力。搜查地点、问询人物都要花费行动力。你找到的线索只有你看得到，可以选择公开或交给对方。注意：有些东西对你不利——先找到它的人，就能决定它的命运。',
  },
  {
    id: 'debate1', kind: 'discuss', title: '交锋一', seconds: 720,
    text: '交换（或隐瞒）你们的发现。「案卷」已开放：私下向 DM 递交推理，全对即领酬金。',
  },
  {
    id: 'act3', kind: 'read', title: '第三幕 · 04:15', chapter: 'act3', text: ACT3_TEXT, seconds: 600,
    onEnter: [{ giveClue: 'rose_letter', role: MANDY }, { giveClue: 'voicemail', role: ETHAN }, { giveClue: 'safe_key', role: ETHAN }],
  },
  {
    id: 'search2', kind: 'search', title: '搜证二 · 04:30', ap: 6, seconds: 900,
    text: '每人 6 点行动力。新的搜查点出现了。吉迪恩书房的保险箱是双重锁——密码加钥匙。'
  },
  {
    id: 'debate2', kind: 'discuss', title: '交锋二', seconds: 720,
    text: '最后一次交换信息。想清楚：天亮以后，你希望警长相信什么？',
  },
  {
    id: 'accuse', kind: 'accuse', title: '盘凶 · 向 DM 交底', seconds: 1200,
    text: '各自独立回答（20 分钟内提交；超时未交视为放弃作答）。每答对一题，DM 会私下付给你 $1,000 酬金（只告诉你总额），供终局使用；答对的题目也计入最终得分。',
  },
  { id: 'finale', kind: 'finale', title: '终局 · 黎明计票', text: FINALE_TEXT },
  { id: 'ending', kind: 'ending', title: '06:00 · 破晓之前' },
]

export const CASE_FILES: CaseFileDef[] = [
  {
    id: 'cf_rose', title: '案卷一 · 罗丝之死', desc: '普莱斯说罗丝死于心脏病。你同意吗？', reward: 3000, penalty: 500, maxAttempts: 2,
    opens: 'search1', closes: 'debate2',
    questions: [
      { id: 'cause', prompt: '罗丝的死因', options: [
        { id: 'heart', label: '自然的心脏病发作' }, { id: 'digoxin', label: '地高辛（洋地黄）中毒' },
        { id: 'alcohol', label: '急性酒精中毒' }, { id: 'pills', label: '误服自己的降压药' },
      ], answer: 'digoxin' },
      { id: 'vehicle', prompt: '毒（或致死原因）是通过什么进入她体内的？', options: [
        { id: 'toast', label: '23:30 订婚祝酒的那杯香槟' }, { id: 'dinner', label: '晚宴的食物' },
        { id: 'room', label: '她房间里的水杯' }, { id: 'gideon_pills', label: '吉迪恩药瓶里的药片' },
      ], answer: 'toast' },
      { id: 'claim', prompt: '普莱斯说"她大概三点钟听到噩耗，一下子就过去了"——这可能吗？', options: [
        { id: 'possible', label: '可能：噩耗诱发了心脏骤停' },
        { id: 'impossible', label: '不可能：她死在噩耗传开之前' },
      ], answer: 'impossible' },
    ],
  },
  {
    id: 'cf_fall', title: '案卷二 · 两点四十分', desc: '吉迪恩是怎么从灯塔上掉下去的？', reward: 3000, penalty: 500, maxAttempts: 2,
    opens: 'search1', closes: 'debate2',
    questions: [
      { id: 'time', prompt: '吉迪恩坠落的时刻', options: [
        { id: '0229', label: '02:29' }, { id: '0233', label: '02:33' }, { id: '0237', label: '02:37' },
        { id: '0240', label: '02:40' }, { id: '0248', label: '02:48' },
      ], answer: '0240' },
      { id: 'alone', prompt: '坠落时塔顶还有别人吗？', options: [
        { id: 'yes', label: '有' }, { id: 'no', label: '没有，他是自己掉下去的' },
      ], answer: 'yes' },
      { id: 'exclude', prompt: '安保人员麦克和路易斯，为什么可以排除？', options: [
        { id: 'radio', label: '有记录：对讲和录像显示他们一直在岗' },
        { id: 'size', label: '看体型：和目击者描述的身形不符' },
        { id: 'motive', label: '没动机：他们没理由害老板' },
        { id: 'cant', label: '无法排除' },
      ], answer: 'radio' },
    ],
  },
  {
    id: 'cf_glass', title: '案卷三 · 毒酒为何到了罗丝手里', desc: '那杯毒酒，本来是给谁的？', reward: 4000, penalty: 500, maxAttempts: 2,
    opens: 'search2', closes: 'debate2',
    questions: [
      { id: 'source', prompt: '毒药来自哪里？', options: [
        { id: 'price_bag', label: '普莱斯医疗箱里的地高辛浓缩液' }, { id: 'gideon', label: '吉迪恩自己的地高辛片' },
        { id: 'bar', label: '吧台' }, { id: 'victor', label: '维克多带来的' },
      ], answer: 'price_bag' },
      { id: 'how', prompt: '毒酒为什么落到了罗丝手里？', options: [
        { id: 'swap', label: '调包：祝酒时有人趁乱换了杯子' },
        { id: 'mirror', label: '左右颠倒：面对面递托盘，下药者的"右边"是另一只杯子' },
        { id: 'rose_chose', label: '拿错：罗丝自己拿了吉迪恩那杯' }, { id: 'gave', label: '让杯：吉迪恩把自己那杯递给了罗丝' },
      ], answer: 'mirror' },
      { id: 'knew', prompt: '下药的人知道那是毒药吗？', options: [
        { id: 'knew', label: '知道' }, { id: 'deceived', label: '不知道，以为是安眠药' },
      ], answer: 'deceived' },
    ],
  },
]

const PEOPLE = [
  { id: 'mandy', label: '曼迪' }, { id: 'ethan', label: '伊森' }, { id: 'price', label: '普莱斯医生' },
  { id: 'hector', label: '赫克托' }, { id: 'preston', label: '普雷斯顿' }, { id: 'victor', label: '维克多' },
  { id: 'joan', label: '乔安' }, { id: 'gideon', label: '吉迪恩自己' }, { id: 'rose', label: '罗丝自己' },
]

function people(ids: string[]) {
  return PEOPLE.filter(p => ids.includes(p.id))
}

export const ACCUSE: AccuseQuestion[] = [
  { id: 'poured', prompt: '谁亲手把毒下进了祝酒的香槟？', options: people(['mandy', 'ethan', 'price', 'hector', 'rose']), answer: 'mandy', points: 10, bonus: 1000 },
  { id: 'mastermind_r', prompt: '毒杀罗丝的幕后主使是谁？', options: [...people(['price', 'gideon', 'preston', 'victor']), { id: 'nobody', label: '没有主使，是下药者自己的主意' }], answer: 'price', points: 10, bonus: 1000 },
  { id: 'pusher', prompt: '谁把吉迪恩推下了灯塔？', options: [...people(['ethan', 'mandy', 'preston', 'victor', 'price']), { id: 'accident', label: '没有人，他是失足' }], answer: 'ethan', points: 10, bonus: 1000 },
  { id: 'lure', prompt: '伊森储物柜里那封匿名信，是谁写的？', options: [
    { id: 'price', label: '普莱斯' }, { id: 'gideon', label: '吉迪恩本人' }, { id: 'rose', label: '罗丝' },
    { id: 'preston', label: '普雷斯顿' }, { id: 'joan', label: '乔安' },
  ], answer: 'price', points: 10, bonus: 1000 },
  { id: 'mei', prompt: '2000 年，林梅是怎么死的？', options: [
    { id: 'price', label: '被普莱斯推下灯塔' }, { id: 'frank', label: '被弗兰克·科尔推下' }, { id: 'gideon', label: '被吉迪恩推下' },
    { id: 'accident', label: '醉酒失足' }, { id: 'suicide', label: '自杀' },
  ], answer: 'price', points: 10, bonus: 1000 },
  { id: 'father', prompt: '曼迪的亲生父亲是谁？', options: [
    { id: 'gideon', label: '吉迪恩·万斯' }, { id: 'frank', label: '弗兰克·科尔' }, { id: 'price', label: '哈兰·普莱斯' }, { id: 'unknown', label: '无法确定' },
  ], answer: 'gideon', points: 10, bonus: 1000 },
  { id: 'mother', prompt: '伊森的亲生母亲是谁？', options: [
    { id: 'rose', label: '罗丝·阿尔瓦雷斯' }, { id: 'mei', label: '林梅' }, { id: 'unknown', label: '早已过世的无名女子' },
  ], answer: 'rose', points: 10, bonus: 1000 },
]

export const TRUTH: { title: string; text: string }[] = [
  {
    title: '一、2000 年 · 第一次大选之夜',
    text: `林梅发现俱乐部的医生哈兰·普莱斯给女郎注射"维生素"后侵犯她们，她录了音，约好 11 月 8 日上午见记者乔安。

11 月 8 日凌晨约 2:20，普莱斯约她到灯塔上"谈钱"，把她推了下去（她血液里的羟考酮是他事先下的）。那晚电视刚宣布佛州归小布什，吉迪恩就被电话缠在书房里——三十年里唯一一次没有上塔。约 2:25 安保主管弗兰克·科尔看见一个帽檐压低、拎医生皮包、袖口带血、手背有抓痕的人出塔（林梅挣扎时抓伤了他）；约 2:30 罗丝在备餐间看见普莱斯洗袖口上的血。

普莱斯当晚向吉迪恩坦白。吉迪恩为了保住俱乐部，也因为普莱斯握着他的把柄——林梅给他生了一个女儿——替他掩盖：警方以"醉酒失足"结案，弗兰克收下五万块，签字认了"塔门未锁"的失职。`,
  },
  {
    title: '二、2016 年 · 赎罪的计划',
    text: `林梅的女儿林曼化名曼迪来到庄园，想查清母亲之死；弗兰克的儿子伊森改姓布雷迪，经生母罗丝推荐当上了吉迪恩的保镖。罗丝认出了曼迪，九月告诉了吉迪恩；吉迪恩偷偷做了亲子鉴定——曼迪是他的女儿。

吉迪恩决定赎罪：迎娶罗丝；立新遗嘱，遗产一半给女儿林曼，一半给弗兰克的儿子伊森；凌晨三点把忏悔信交给乔安。11 月 6 日，他在高尔夫球场对普莱斯摊了牌："大选一过，我就全说出来。"

普莱斯决定让知道真相的两个人——吉迪恩和罗丝——在天亮前死掉，而且不用自己动手。`,
  },
  {
    title: '三、借刀 · 两只手',
    text: `**第一只手：曼迪。**普莱斯告诉她"是吉迪恩害死了你母亲"，给她一瓶"缓效安眠药"（其实是他药箱里 10ml 的高浓度地高辛溶液，批号 L16-0921），嘱咐她"放进**你右手边**那杯，他总拿那杯"。曼迪面对新人递托盘——她的右手边，正是吉迪恩的左手边。吉迪恩 2009 年中风后只用右手拿自己右边那杯。毒酒注定落进罗丝手里。罗丝一口饮尽，零点二十五开始看什么都发黄，01:58 给儿子留下最后一条语音，约两点钟死在床上。

**第二只手：伊森。**普莱斯 11 月 7 日 22:14 在 5 号客房打印了一封匿名信，塞进伊森的储物柜："是吉迪恩让你父亲背了锅……大选结果一出来，万斯会一个人上灯塔。"02:37 伊森用安保通用码进塔；02:40——Fox 宣布特朗普当选的那一刻——他把正要对他说"我知道你是谁"的吉迪恩推下了栏杆。

**第三步：替罪羊。**普莱斯给了曼迪一个错误的保险箱密码 1107，让她在两点半去书房——正对灯塔的窗口。这样，两个人都在案发现场附近，都有说不清的嫌疑。而普莱斯自己，从 02:20 起一直站在记者乔安身边。`,
  },
  {
    title: '四、你们',
    text: `曼迪以为自己只是给仇人下了安眠药。她毒死的，是这世上最疼她的罗丝；而她恨了十六年、被别人推下灯塔的那个人，是她的父亲。

伊森以为自己终于替父亲报了仇。他推下去的，是一个正准备向他道歉、把一半家产留给他的老人；而他透过舷窗看见、却选择沉默的那一瓶"药"，毒死了他的母亲。

你们杀死的，都是对方生命里的人。而你们的父母，都死于同一个人之手。

这就是摇摆州：每一票都可能改变结局，而你们手里，都沾着血。`,
  },
]

export const SCENARIO: Scenario = {
  id: 'swing-state',
  title: SCENARIO_META.title,
  subtitle: SCENARIO_META.subtitle,
  tagline: SCENARIO_META.tagline,
  intro: SCENARIO_META.intro,
  era: SCENARIO_META.era,
  duration: SCENARIO_META.duration,
  roles: ROLES,
  npcs: NPCS,
  locations: LOCATIONS,
  clues: CLUES,
  flow: FLOW,
  caseFiles: CASE_FILES,
  accuse: ACCUSE,
  endings: [],
  truth: TRUTH,
}
