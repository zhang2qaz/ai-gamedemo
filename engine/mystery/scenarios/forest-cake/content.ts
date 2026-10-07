// 《草莓蛋糕不见了！》· 流程、小测验、找出真相、复盘（服务器端专用：含真相）
// 给小学三年级的孩子：每一步只做一件事；电脑把所有字读出来。
import type { AccuseQuestion, CaseFileDef, ChoiceOption, Scenario, StepDef } from '../../types'
import { KIDS_META } from '../meta'
import { FOX, PANDA, RABBIT, ROLES, SQUIRREL } from './roles'
import { CLUES, LOCATIONS, ROLE_MEMORY, ROLE_START, SECRET_OF } from './clues'
import { NPCS } from './npcs'

const PROLOGUE = `欢迎来玩剧本杀！

**剧本杀是什么？** 就像演一场小小的侦探戏：每个人扮演故事里的一个角色，读一份只给自己看的「小剧本」；然后大家一起找线索、互相问问题、动脑筋，最后猜出到底发生了什么。
每个角色都有一个**小秘密**——你可以先藏着，也可以勇敢地说出来。
今天的主持人叫 **DM**，是电脑。它会带着大家一步一步玩，还会把字读给你听。
大人玩的剧本杀里，"坏人"常常藏在玩家中间；今天大家都是好朋友，一起当小侦探！

**我们的故事：**
今天是熊老师的生日！森林小学三年级二班的小动物们一起攒橡果，买了一个大大的草莓奶油蛋糕，偷偷藏在教室后面的柜子上，想在下午给老师一个惊喜。

吃完午饭，大家回到教室——
蛋糕盒还在，**里面的蛋糕不见了！** 只剩下一张歪歪扭扭的小纸条。

熊老师下午一点半就回来了。小侦探们，快把蛋糕找回来吧！`

const AUCTION_TEXT = `猫头鹰校长扶了扶眼镜："小侦探们，我这儿有四样好东西，用你们的橡果来换吧！"

**怎么玩：** 四样东西一起出价。每样都偷偷写下你愿意出几颗橡果（不想要就写 0），四样加起来不能超过你有的橡果。

- 谁出得最多，谁就买到，只付他自己写的橡果；没买到的人，一颗也不用付。
- **两个人出得一样多：校长说"不许吵架哦"，把东西收回去，谁也拿不到，也都不用付。**所以可以先商量好："你要手电筒，我要放大镜！"
- 剩下的橡果，最后每 2 颗换 1 颗⭐。金色小星星能换 2 颗⭐，就像 4 颗橡果那么多。

想一想：是买道具多找线索，还是留着橡果换星星？`

const TWIST = `叮铃铃——

牛大婶买菜回来了！厨房的门开了。
大家还听说，隔壁三班的皮皮、厨房窗外的小鸟叽叽，现在也可以去问一问了。

先读一读"我想起来了"：每个人都又想起了一件事。`

function courageChoice(roleId: string): { prompt: string; options: ChoiceOption[] } {
  const secret = SECRET_OF[roleId]
  return {
    prompt: '勇气时刻：要不要把你的小秘密告诉大家？\n\n💬 说出来：得 2 颗⭐（勇气星）。你的小秘密卡会给大家看——说出来，大家就不会再怀疑你啦。\n\n🤐 先不说：这次不得星星。没关系，等你准备好了再说也可以。\n\n🎂 **如果所有一起玩的小朋友都说出来了**（电脑演的不算）：每人再多得 1 颗⭐！\n\n大家是同时偷偷选的，选好就不能改了。可以先在聊天里和大家商量。',
    options: [
      { id: 'keep', label: '🤐 先不说', desc: '这次不得星星（没关系，等你准备好再说）', effects: [{ setSeatFlag: 'told', value: false }] },
      {
        id: 'tell', label: '💬 勇敢说出来', desc: '得 2 颗⭐；所有小侦探都说出来，每人再多 1 颗⭐',
        effects: [
          { setSeatFlag: 'told', value: true },
          { dm: `💬 ${ROLES.find(r => r.id === roleId)?.name ?? ''}勇敢地说出了自己的小秘密！`, to: 'both' },
          { giveClue: secret, to: 'both' },
        ],
      },
    ],
  }
}

export const FLOW: StepDef[] = [
  { id: 'prologue', kind: 'story', title: '开场 · 蛋糕不见了！', text: PROLOGUE, seconds: 180, onEnter: [{ giveClue: 'box' }, { giveClue: 'note' }] },
  {
    id: 'read1', kind: 'read', title: '我的小剧本', chapter: 'act1', seconds: 240,
    text: '读一读你自己的小剧本（点「🔊 读给我听」，电脑会念给你听）。小剧本只有你能看见，不要直接念给别人听哦。',
    onEnter: Object.entries(ROLE_START).flatMap(([role, ids]) => ids.map(id => ({ giveClue: id, role }))),
  },
  {
    id: 'intro', kind: 'discuss', title: '自我介绍', seconds: 240,
    text: '轮流向大家介绍自己：你叫什么名字？你是什么小动物？中午你在做什么？\n不想说的部分，可以说"这是我的小秘密"——但不要编假话哦。',
  },
  {
    id: 'auction', kind: 'auction', title: '橡果拍卖会', text: AUCTION_TEXT, seconds: 180,
    tie: { log: '出得一样多！猫头鹰校长说："不许吵架哦，这件先放在我这儿。"', label: '一样多 · 校长收走了' },
    lots: [
      { id: 'lot_flashlight', title: '手电筒', desc: '能照亮教室里黑黑的柜子底下，多一个地方可以找线索。', item: 'item_flashlight', min: 1 },
      { id: 'lot_magnifier', title: '放大镜', desc: '能把蛋糕盒上的毛看得清清楚楚，多一个地方可以找线索。', item: 'item_magnifier', min: 1 },
      { id: 'lot_bread', title: '香喷喷的面包', desc: '小鸟最爱吃面包。有了它，也许能听到一个大秘密。', item: 'item_bread', min: 1 },
      { id: 'lot_star', title: '金色小星星', desc: '最后算星星的时候，直接多得 2 颗⭐。', item: 'item_star', min: 1 },
    ],
  },
  {
    id: 'search1', kind: 'search', title: '找线索（第一次）', ap: 5, seconds: 480,
    text: '每人有 5 点⚡体力。去一个地方找线索、问一个人问题，都要用掉体力。\n你找到的线索只有你看得见：你可以「公开」给大家，也可以「交给」某一个人。',
  },
  {
    id: 'talk1', kind: 'discuss', title: '说一说', seconds: 300,
    text: '说说你找到了什么。你觉得谁最可疑？为什么？\n「小测验」已经开放：答对了，能得到橡果！\n马上就是「勇气时刻」，想一想要不要说出你的小秘密。',
  },
  {
    id: 'courage', kind: 'choice', title: '勇气时刻', seconds: 240,
    text: '每个人都有一个小秘密。说出来，大家就不会再怀疑你了。现在，要不要勇敢地说出来？大家同时偷偷选。',
    choice: Object.fromEntries([RABBIT, FOX, PANDA, SQUIRREL].map(r => [r, courageChoice(r)])),
  },
  {
    id: 'read2', kind: 'read', title: '我想起来了', chapter: 'act2', text: TWIST, seconds: 120,
    onEnter: Object.entries(ROLE_MEMORY).map(([role, id]) => ({ giveClue: id, role })),
  },
  {
    id: 'search2', kind: 'search', title: '找线索（第二次）', ap: 4, seconds: 360,
    text: '每人有 4 点⚡体力。厨房可以进去了！牛大婶、小鸟叽叽、三班的皮皮也可以问了。',
  },
  {
    id: 'talk2', kind: 'discuss', title: '最后再说一说', seconds: 240,
    text: '最后再说一说：蛋糕到底是谁拿走的？现在在哪里？为什么？最大的草莓又是谁吃掉的？',
  },
  {
    id: 'accuse', kind: 'accuse', title: '找出真相！', seconds: 300,
    text: '每个人自己选答案（别人看不到你选了什么）。每答对一题，就能得到星星⭐，还有橡果奖励！',
  },
  { id: 'ending', kind: 'ending', title: '真相大白' },
]

export const CASE_FILES: CaseFileDef[] = [
  {
    id: 'cf_quiz', title: '小侦探测验', desc: '回答两个小问题。全答对，得到 3 颗橡果！答错会扣 1 颗，可以试 2 次。', reward: 3, penalty: 1, maxAttempts: 2,
    opens: 'search1', closes: 'talk2',
    questions: [
      { id: 'prints', prompt: '地上那些像小手一样的湿脚印，是哪种小动物留下的？', options: [
        { id: 'rabbit', label: '🐰 兔子' }, { id: 'fox', label: '🦊 狐狸' }, { id: 'panda', label: '🐼 熊猫' },
        { id: 'squirrel', label: '🐿️ 松鼠' }, { id: 'raccoon', label: '🦝 浣熊' },
      ], answer: 'raccoon' },
      { id: 'when', prompt: '蛋糕是什么时候被拿走的？', options: [
        { id: 'morning', label: '上午 10 点以前' }, { id: 'noon', label: '中午 12:10 到 12:30 之间' }, { id: 'after', label: '下午 1 点以后' },
      ], answer: 'noon' },
    ],
  },
]

export const ACCUSE: AccuseQuestion[] = [
  { id: 'who', prompt: '是谁拿走了蛋糕？', options: [
    { id: 'rabbit', label: '🐰 跳跳' }, { id: 'fox', label: '🦊 橙橙' }, { id: 'panda', label: '🐼 圆圆' }, { id: 'squirrel', label: '🐿️ 果果' },
    { id: 'pippi', label: '🦝 浣熊皮皮' }, { id: 'cow', label: '🐮 牛大婶' }, { id: 'owl', label: '🦉 猫头鹰校长' },
  ], answer: 'pippi', points: 3, bonus: 2 },
  { id: 'where', prompt: '蛋糕现在在哪里？', options: [
    { id: 'eaten', label: '已经被吃光了' }, { id: 'fridge', label: '在厨房的大冰箱里' },
    { id: 'cabinet', label: '藏在柜子底下' }, { id: 'tree', label: '在小鸟的树洞里' },
  ], answer: 'fridge', points: 2, bonus: 1 },
  { id: 'why', prompt: '他为什么要拿走蛋糕？', options: [
    { id: 'eat', label: '想一个人偷偷吃掉' },
    { id: 'melt', label: '怕奶油化掉，想帮忙冰起来' },
    { id: 'surprise', label: '想自己给熊老师过生日' },
    { id: 'wind', label: '蛋糕被风吹跑了，他去追' },
  ], answer: 'melt', points: 2, bonus: 1 },
  { id: 'berry', prompt: '蛋糕上少了什么？是谁吃掉的？', options: [
    { id: 'pippi', label: '最大的那颗草莓——皮皮吃掉的' },
    { id: 'fox', label: '最大的那颗草莓——橙橙吃掉的' },
    { id: 'candle', label: '生日蜡烛——被风吹走了' },
    { id: 'nothing', label: '什么都没少' },
  ], answer: 'pippi', points: 2, bonus: 1 },
]

export const TRUTH: { title: string; text: string }[] = [
  {
    title: '一、蛋糕去哪儿了？',
    text: `**上午 10:00** 课间，橙橙偷偷尝了一口奶油——盒盖里那个干掉的尖尖指印，就是那时候留下的。
**11:50** 下课。值日生果果太饿了，忘了锁门。
**12:10** 跳跳回教室拿发卡，偷看了一眼：蛋糕还在！盒子上的白毛是她的。
**12:20** 圆圆回教室改生日卡上的错字。他听见柜子那边"滴答、滴答"——那是奶油在往下流。
**12:25 刚过**（保安羊伯伯刚走过去）隔壁三班的小浣熊皮皮路过。太阳晒得教室 31℃，奶油都化了！盒子底被奶油泡软了，一拿就要破，他只好把蛋糕连着底下的小纸托端出来。他从作业本上撕下一张纸，写了"蛋糕我惜走了"（把"借"写成了"惜"），放进空盒子里。他先在水池边洗了沾满奶油的手，脚也踩湿了，再抱起蛋糕往厨房跑——湿湿的小脚印一路印到了走廊上。
**12:30** 果果跑回来锁门，看见了一个"戴黑眼罩"、尾巴一圈灰一圈黑的小家伙——正是皮皮。
**12:30–12:40** 牛大婶去倒垃圾。皮皮把蛋糕放进了厨房的大冰箱……然后忍不住吃掉了最上面那颗最大的草莓，在冰箱门上留下了红红的小手印。小鸟叽叽全看见了。橙橙在操场上闻到了草莓味。`,
  },
  {
    title: '二、皮皮是坏孩子吗？',
    text: `不是。皮皮是想**帮忙**：再晒一会儿，蛋糕就要变成奶油汤了。

可是他也做错了两件事：
1. 拿走别人的东西，**没有先问一声**，害得大家着急了一中午；
2. 偷偷吃掉了那颗最大的草莓。

后来，皮皮红着脸向二班的同学说了"对不起"，还用自己的零花钱买了一盒新草莓。熊老师说："知道错了就改，就是好孩子。"`,
  },
  {
    title: '三、每个人的小秘密',
    text: `游戏结束啦！就像魔术表演完要揭秘一样，剧本杀最后会把所有的秘密都摊开来看，这叫"**复盘**"。

- 🐰 **跳跳**：中午回教室拿发卡，偷看过蛋糕——盒子上的白毛是跳跳的。
- 🦊 **橙橙**：上午偷偷尝了一口奶油——盒盖里的干指印是橙橙的。
- 🐼 **圆圆**：把"快乐"写成了"快东"，中午回去改——生日卡上的黑指印是圆圆的。
- 🐿️ **果果**：忘了锁门——所以谁都能走进教室。

你看，每个人都有一点点小错误，所以每个人看起来都有点可疑。可是**可疑不等于做了坏事**。好侦探要看证据，而不是看谁最慌张。`,
  },
  {
    title: '四、小侦探课堂：怎么推理？',
    text: `**1. 找证据**：手印、毛、纸条、温度计……每样东西都会"说话"。
**2. 对一对**：海报上说浣熊的脚印像一只只小手、眼睛像戴眼罩、尾巴一圈灰一圈黑——和手印、果果看到的影子、放大镜下的毛都对上了。纸条上把"借"写成"惜"，和皮皮作业本上的错字一模一样。
**3. 排一排时间**：12:10 蛋糕还在，12:30 果果就看见有人抱着它跑了——所以是 12:10 到 12:30 之间不见的。
**4. 想一想为什么**：教室 31℃、奶油在滴；蛋糕被放进了冰箱，纸条还说会还回来——他不是想吃掉蛋糕，是怕它化掉。

这就是剧本杀：每个人都只知道一点点，把大家知道的拼在一起，真相就出来啦！`,
  },
  {
    title: '五、小小选择课',
    text: `**拍卖的时候**：两个人出得一样多，谁也拿不到。要是先商量好"你要手电筒，我要放大镜"，大家都能拿到想要的东西。

**勇气时刻**：说出小秘密，自己得星星；要是所有人都说出来，每个人还能再多一颗。一个人勇敢很好，大家一起勇敢更好。

像这样"我得到什么，还要看别人怎么选"的游戏，大人有一个专门的词，叫"**博弈**"。会商量、会相信朋友，也是小侦探的本领哦！`,
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
  currency: { unit: '颗橡果', icon: '🌰', step: 1 },
  ap: { short: '⚡', long: '体力' },
  theme: 'kids',
  scoreUnit: '颗⭐',
  rewardWord: '奖励',
}
