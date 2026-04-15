// =====================
// 弈战 - 名校之争主题
// =====================

import type { IntelSource, RoundIntel, IntelCard, CompanyProfile, ThemeConfig, MarketForecast } from './types'
import { CONFIG } from '../constants'
import type { BaseAction } from '../types'

// ── 辅助函数 ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function slot(
  action: BaseAction,
  trueTexts: string[],
  falseTexts: string[],
  sources: IntelSource[],
  trueCount = 2,
  falseCount = 2,
): IntelCard[] {
  const trues = pick(trueTexts, trueCount).map((text): IntelCard => ({
    source: sources[Math.floor(Math.random() * sources.length)],
    text,
    isTrue: true,
    impliedAction: action,
  }))
  const falses = pick(falseTexts, falseCount).map((text): IntelCard => ({
    source: sources[Math.floor(Math.random() * sources.length)],
    text,
    isTrue: false,
    impliedAction: action,
  }))
  return [...trues, ...falses]
}

// ── 学校档案 ──

const COMPANIES: CompanyProfile[] = [
  { id: 'A', name: '育才中学', slogan: '因材施教，人人成才', style: '全面发展派', colorClass: 'amber' },
  { id: 'B', name: '启航实验', slogan: '大胆创新，敢为人先', style: '创新进取派', colorClass: 'sky' },
  { id: 'C', name: '博雅学府', slogan: '博学雅正，知行合一', style: '学术深耕派', colorClass: 'emerald' },
  { id: 'D', name: '明德书院', slogan: '厚德载物，宁静致远', style: '传统稳健派', colorClass: 'purple' },
  { id: 'E', name: '红枫附中', slogan: '激情教育，点燃梦想', style: '素质教育派', colorClass: 'rose' },
  { id: 'F', name: '蓝湾国际', slogan: '国际视野，本土根基', style: '国际教育派', colorClass: 'cyan' },
  { id: 'G', name: '翠园实验', slogan: '科学育人，自然成长', style: '科学教育派', colorClass: 'lime' },
  { id: 'H', name: '朝晖学堂', slogan: '晨光熹微，学无止境', style: '勤学苦练派', colorClass: 'orange' },
]

// ── 情报生成器 ──

function generateIntel(): RoundIntel[] {
  const sources: IntelSource[] = ['行业报告', '竞品情报', '消费者调研', '内部消息', '分析师预测', '监管动态']

  // ═══════════════════════════════════════
  // R1：开学季 — 家长价格敏感度 60%，奖学金最有效
  // ═══════════════════════════════════════
  const r1Atk: IntelCard[] = slot('ATK', [
    '教育局调研显示，本区60%家长将学费作为择校首要考量因素，奖学金政策对招生有显著拉动作用。',
    '某教育咨询机构数据表明，开学季发放奖学金的学校平均多招收15%-20%的优质生源。',
  ], [
    '教育局调研显示奖学金效果不会因多校同时发放而减弱，反而能带动整个学区的择校热度。',
    '内部数据表明连续发放奖学金不会产生家长疲劳效应，每学期效果一样好。',
  ], sources, 1, 1)

  const r1Qua: IntelCard[] = slot('QUA', [
    '区教研室新学期工作计划透露，教学质量将成为年终学校评估的核心指标，提前投入教研有战略意义。',
    '近年中考数据分析表明，教研投入持续领先的学校在3-5个学期后升学率平均提升8个百分点。',
  ], [
    '教研投入本学期即时竞争力极大提升，是所有策略中即时效果最强的，远超奖学金抢生。',
    '据内部消息教研升级成本本学期有优惠补贴仅需一半费用，且教学质量大幅提升，一步到位建立壁垒。',
  ], sources, 1, 1)

  const r1Mkt: IntelCard[] = slot('MKT', [
    '本区学区房交易数据显示，学校声望每提升10分，对口学区房均价上涨约3%，家长关注度同步上升。',
    '教育自媒体监测数据表明，开学季是家长信息搜索高峰期，此时口碑宣传的触达效率是平时的2倍。',
  ], [
    '口碑宣传每次可声望大幅提升，只需两学期即可突破溢价变现门槛，回报速度极快。',
    '多校同时宣传不会导致效果摊薄，反而因家长关注度提升效果更好，推广越多越有利。',
  ], sources, 1, 1)

  const r1Hold: IntelCard[] = slot('HOLD', [
    '历年招生数据分析表明，开学季保持稳定的学校往往在后续学期表现更有韧性，稳健策略长期胜率达45%。',
    '教育行业观察人士指出，开学季其他学校互相竞争时保持稳健可以坐收渔翁之利，避免无谓消耗。',
  ], [
    '稳健办学可获得丰厚的利润，且完全不受其他学校抢生行为的竞争压制影响。',
    '连续稳健办学可获得教育局额外补贴奖励，利润率逐季递增，是最安全的长线策略。',
  ], sources, 1, 1)

  // ═══════════════════════════════════════
  // R2：新区入住预警 — 下学期生源+30%
  // ═══════════════════════════════════════
  const r2Atk: IntelCard[] = slot('ATK', [
    '房产中介数据显示新区楼盘入住率已达40%，大量适龄学生家庭正在了解各校招生政策，率先出击可抢占先机。',
    '家长择校调研显示，在信息不对称阶段，最先发放奖学金的学校会被视为"有诚意"，获得新居民的优先考虑。',
  ], [
    '内部消息称下学期生源扩大后奖学金效果翻倍，现在抢到的生源占比在下学期自动享受2倍红利。',
    '数据分析显示多校同时发放奖学金时效果不会摊薄，反而因择校热度提升带来更多关注。',
  ], sources, 1, 1)

  const r2Qua: IntelCard[] = slot('QUA', [
    '教育评估专家预测，新区家长普遍受教育程度较高，对教学质量的要求远超老城区，提前布局教研至关重要。',
    '重点高中招生办透露，今年将加大对初中教学质量的考核权重，教研投入强的学校推优名额会更多。',
  ], [
    '教研投入在生源扩张前效果翻倍，下学期教学质量大幅提升，是提前布局的最佳时机。',
    '教研升级成本本学期有政策补贴仅需一半费用，且竞争力大幅提升，性价比极高。',
  ], sources, 1, 1)

  const r2Mkt: IntelCard[] = slot('MKT', [
    '新区住户微信群活跃度极高，择校讨论帖平均阅读量超过5000，是口碑传播的黄金渠道。',
    '教育品牌咨询公司分析，新区家长群体信息获取渠道以社交口碑为主，提前做口碑建设可以抢占心智。',
  ], [
    '生源涌入前口碑宣传效果加倍，声望大幅提升，且衰减速度减半，缓慢衰减。',
    '行业数据显示口碑宣传在生源爆发前的ROI是全年最高的，远超奖学金和教研路线。',
  ], sources, 1, 1)

  const r2Hold: IntelCard[] = slot('HOLD', [
    '教育行业老手建议，生源涌入前保持稳健，等竞争对手消耗资源后再出手，才是最优博弈策略。',
    '本区教育协会数据显示，过去三年保持稳健经营的学校存活率最高，激进扩张的学校有30%出现财务困难。',
  ], [
    '稳健积累的资金在生源爆发时会自动转化为额外竞争优势，是最聪明的等待策略。',
    '连续稳健办学的积分率不会下降，即使持续多学期也始终保持丰厚的利润水平。',
  ], sources, 1, 1)

  // ═══════════════════════════════════════
  // R3：生源已到 — 13万生源，全力争夺
  // ═══════════════════════════════════════
  const r3Atk: IntelCard[] = slot('ATK', [
    '新区入住潮已经到来，本学期适龄生源扩大至13万，此刻发放奖学金抢生可以最大化招生红利。',
    '家长群热度空前高涨，择校焦虑蔓延，能提供实质性学费优惠的学校最受青睐，奖学金是最直接的竞争手段。',
  ], [
    '生源扩大后奖学金的吸引力自动翻倍，是抢夺增量生源的绝对最优策略。',
    '数据显示13万生源中90%是价格敏感型家庭，奖学金效果在本学期达到全局巅峰。',
  ], sources, 1, 1)

  const r3Qua: IntelCard[] = slot('QUA', [
    '前期教研投入已开始产生效果，持续加码可以在教学质量上形成碾压性优势，中考成绩将是最终说服力。',
    '重点高中招办明确表示今年扩大自主招生比例，教学质量过硬的初中将获得更多推优名额。',
  ], [
    '教研投入在生源激增时效果加倍，即时获得极大的竞争优势，下学期教学质量大幅提升，是爆发期最强策略。',
    '前期教研储备在本学期可自动释放额外加成，累积越多爆发力越强，无需等到终局。',
  ], sources, 1, 1)

  const r3Mkt: IntelCard[] = slot('MKT', [
    '学校声望排行榜发布在即，声望得分领先的学校将获得教育局的"示范校"认定，对招生有巨大加成。',
    '新区家长社群已形成规模效应，此时的口碑投入可以借助社群网络实现病毒式传播，事半功倍。',
  ], [
    '生源高峰期口碑宣传的触达效率是平时的5倍，¥10万投入等效于平时的¥50万效果。',
    '声望积累到40即可开始变现加成，不需要等到70的门槛，本学期宣传即刻见效。',
  ], sources, 1, 1)

  const r3Hold: IntelCard[] = slot('HOLD', [
    '多校同时激进竞争导致市场混乱，选择稳健可以避免被卷入价格战泥潭，保持利润率优势。',
    '财务分析显示激进策略的学校现金流普遍紧张，稳健经营可以在对手弹尽粮绝时发起反击。',
  ], [
    '生源涌入期稳健学校自动获得额外竞争优势，系统奖励稳定办学的学校。',
    '13万大市场中稳健办学的积分率持续提升，市场越大稳健越赚。',
  ], sources, 1, 1)

  // ═══════════════════════════════════════
  // R4：政策改革 — 教学质量权重提升至55%
  // ═══════════════════════════════════════
  const r4Atk: IntelCard[] = slot('ATK', [
    '尽管政策改革提升了教学质量权重，但仍有45%的家长把学费作为重要考量，奖学金策略仍有空间。',
    '政策改革导致部分学校慌忙转型投教研，竞争对手减少奖学金投入，此时独家抢生效果反而更好。',
  ], [
    '政策改革后奖学金策略效果不降反升，因为家长预算紧缩更需要学费优惠方案。',
    '内部数据显示家长价格敏感度实际并未下降，仍维持60%水平，奖学金依然是最强策略。',
  ], sources, 1, 1)

  const r4Qua: IntelCard[] = slot('QUA', [
    '新评估标准正式实施，教学质量权重提升至55%，前期教研积累的学校迎来黄金兑现期。',
    '重点高中招生办公布新标准：教学质量评分占自主招生考核的60%，教研强校的推优通道大幅拓宽。',
  ], [
    '新标准下教研投入的加成翻倍，即时小幅提升竞争力，下学期教学质量大幅提升，教研路线碾压一切。',
    '教学质量权重实际已升至70%，远超官方公布的55%，教研领先即绝对领先。',
  ], sources, 1, 1)

  const r4Mkt: IntelCard[] = slot('MKT', [
    '政策改革后家长对学校信息的需求激增，积极做口碑建设可以抢占"权威信息源"的定位，声望快速提升。',
    '教育自媒体关注度暴增，此时加大口碑宣传可以借政策热点获得10倍以上的免费传播效果。',
  ], [
    '新标准期间宣传效果加倍，声望大幅提升，且"通过新评估标准"的宣传可带来额外声望加成。',
    '声望在新标准期间的变现门槛降低至50，此前积累的声望即刻可以套利变现。',
  ], sources, 1, 1)

  const r4Hold: IntelCard[] = slot('HOLD', [
    '政策改革带来不确定性，稳健经营可以观察市场走向，避免在方向不明时做出错误的大额投入。',
    '本学期各校为应对政策改革纷纷调整策略，混乱期选择稳健可以避免跟风决策的风险。',
  ], [
    '新标准对稳健学校有额外政策补贴，积分率显著提升，是全场最高回报率策略。',
    '稳健办学在标准升级期不受任何抢生压力惩罚，系统保护合规办学的学校。',
  ], sources, 1, 1)

  // ═══════════════════════════════════════
  // R5：终局决战 — 最后一个学期
  // ═══════════════════════════════════════
  const r5Atk: IntelCard[] = slot('ATK', [
    '最后一个学期，独家发放奖学金可以在收官战中实现大逆转，竞争力加成在无人竞争时效果最大化。',
    '终局家长群焦虑达到峰值，此刻提供奖学金优惠可以收割最后一波犹豫不决的家庭。',
  ], [
    '终局奖学金效果不受人数摊薄影响，无论几校同时出手都能获得满额效果。',
    '最后一学期奖学金抢生的生源增长效果是平时的3倍，终局爆发是逆转排名的最佳机会。',
  ], sources, 1, 1)

  const r5Qua: IntelCard[] = slot('QUA', [
    '有教研储备的学校在终局可以一键爆发，将累积的教研成果一次性兑现为竞争力和综合积分。',
    '最后一个学期投入教研虽然无法在下学期兑现，但即时小幅提升竞争力，在终局胶着战中可能是决定性的。',
  ], [
    '教研储备在终局释放时可获得额外竞争优势，充足储备即可获得碾压级优势。',
    '最后一学期教研投入的教学质量大幅提升同样会在终局结算中生效，相当于获得双倍回报。',
  ], sources, 1, 1)

  const r5Mkt: IntelCard[] = slot('MKT', [
    '终局声望变现是声望积累学校的王牌手段，额外的收入加成在大基数下可以带来可观的积分增长。',
    '最后学期的口碑投入可以在终局结算时帮助声望突破变现门槛，一次性释放前期积累的品牌价值。',
  ], [
    '终局声望溢价的收入加成远比表面上看到的大，是最被低估的终盘策略。',
    '声望变现门槛仅需50分，大多数做过宣传的学校都已达到，终局选声望溢价稳赚。',
  ], sources, 1, 1)

  const r5Hold: IntelCard[] = slot('HOLD', [
    '终局选择稳健可以确保丰厚的利润，在对手冒险失败时坐收渔利，稳健结局往往不差。',
    '博弈论分析显示终局所有人都倾向于激进出击，此时反其道选择稳健可以获得意外的竞争优势。',
  ], [
    '终局稳健可获得系统额外奖励，是确保排名不下滑的最安全策略。',
    '"学区锁定"的防御效果可完全免疫对手抢生冲击（100%防御），而非仅减半。',
  ], sources, 1, 1)

  return [
    {
      round: 1,
      headline: '开学季·择校热潮涌动',
      cards: shuffle([...r1Atk, ...r1Qua, ...r1Mkt, ...r1Hold]),
    },
    {
      round: 2,
      headline: '新区入住预警·招生格局将变',
      cards: shuffle([...r2Atk, ...r2Qua, ...r2Mkt, ...r2Hold]),
    },
    {
      round: 3,
      headline: '生源大增·全面争夺战',
      cards: shuffle([...r3Atk, ...r3Qua, ...r3Mkt, ...r3Hold]),
    },
    {
      round: 4,
      headline: '政策改革·教学质量为王',
      cards: shuffle([...r4Atk, ...r4Qua, ...r4Mkt, ...r4Hold]),
    },
    {
      round: 5,
      headline: '终局决战·名校之争见分晓',
      cards: shuffle([...r5Atk, ...r5Qua, ...r5Mkt, ...r5Hold]),
    },
  ]
}

// ── 主题导出 ──

export const SCHOOL_THEME: ThemeConfig = {
  id: 'school',
  title: '名校之争',
  subtitle: '2024年·本区四大名校争锋',
  description: '四所中学争夺城南教育新区生源，奖学金、教研、口碑三线作战，5个学期决出名校之王。',
  icon: '🏫',
  accentClass: 'purple',

  scenario: {
    title: '2024年·城南教育新区四大名校争锋',
    background:
      '城南教育新区规划落地，四所实力相当的中学被划入同一学区。' +
      '育才中学以全面发展闻名，启航实验以大胆创新著称，博雅学府深耕学术，明德书院坚守传统。' +
      '十万适龄学生的家长正在焦虑地比较各校实力——升学率、师资力量、校园口碑、学费优惠，每一项都可能左右他们的择校决定。' +
      '五个学期的较量即将展开，奖学金战、教研竞赛、口碑之争交织上演。' +
      '最终，累计综合积分最高的学校将被评为"城南名校之冠"，赢得整个新区家长的信赖与认可。',
    marketName: '城南教育新区适龄生源池',
  },

  companies: COMPANIES,

  actionNarrative: {
    ATK: {
      title: '奖学金抢生',
      desc: '发放大额奖学金降低学费门槛，薄利多招快速扩大生源。独家发放时效果最好。',
      risk: '多校同时抢生效果互相摊薄，连续发奖学金家长会产生疲劳。',
    },
    QUA: {
      title: '教研投入',
      desc: '投入¥8万做师资培训和课程升级，下学期教研成果落地后教学质量大增。',
      risk: '本学期花钱多、见效慢，需要等下一学期教研成果出来才能看到全部回报。',
    },
    MKT: {
      title: '口碑宣传',
      desc: '投入¥10万做家长开放日、升学喜报宣传，提升学校在家长圈的声望。',
      risk: '多校同时宣传效果互相摊薄；停止宣传后声望会自然衰减。',
    },
    HOLD: {
      title: '稳健办学',
      desc: '不折腾、正常学费收费，积分最高。适合对手都不动的时候。',
      risk: '对手抢生或宣传时你会被压制，连续稳健办学太久积分率会下降。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '🎓',
      cost: '发放大额奖学金，薄利多招抢优质生源',
    },
    QUA: {
      emoji: '📚',
      cost: '投入¥8万师资培训，下学期推出更强的课程',
    },
    MKT: {
      emoji: '📣',
      cost: '投入¥10万家长开放日宣传，提升学校声望',
    },
    HOLD: {
      emoji: '🛡',
      cost: '正常学费收费，积分最高但不主动抢生',
    },
  },

  finalShiftNarrative: {
    NONE: { title: '不附加', desc: '最后一学期正常比赛，不做额外操作' },
    FINAL_PUSH: { title: '全力招生', desc: '全校动员、加开招生宣讲会，不惜代价抢生源（积分打八折）' },
    QUALITY_CONVERT: { title: '教研总爆发', desc: '一次性推出所有教研成果，用教学质量碾压对手' },
    DEFENSIVE_LOCK: { title: '学区锁定', desc: '和在校学生家长签续读承诺，锁住生源不被对手抢走' },
    BRAND_MONETIZE: { title: '名校长站台', desc: '声望够高时，邀请名校长公开背书提升学校溢价' },
  },

  terms: {
    unit: '名',
    customers: '生源',
    marketShare: '生源占比',
    profit: '综合积分',
    cumulativeProfit: '累计积分',
    brandHeat: '学校声望',
    qualityScore: '教学质量',
    newProductReserve: '教研储备',
    freshness: '家长期望',
    competitiveness: '竞争力',

    brandHeatUnlock: '终局可溢价',
    brandHeatBuilding: '声望有加成',
    brandHeatLow: '继续宣传积累',
    qualityHigh: '教研积累中',
    qualityNormal: '基准水平',
    reserveHas: '终局可一键爆发',
    reserveNone: '教研可积累',
    freshNormal: '奖学金满效',
    freshWarn: '再抢生会受罚',
    freshDanger: '抢生效果大减',
    holdPenalty: '积分率已下降',
    momentum: '额外生源加成',
  },

  styleMap: {
    ATK: '生源进攻型',
    QUA: '教研深耕型',
    MKT: '口碑扩张型',
    HOLD: '稳健办学型',
  },

  narration: {
    atkMultiple: '同时发放奖学金抢生源，生源竞争激烈，双方均受家长疲劳影响。',
    atkSingle: '独家发放奖学金，抢占优质生源优势。',
    quaDesc: '投入教研建设，蓄势下学期兑现。',
    mktDesc: '加大口碑宣传，学校声望持续提升。',
  },

  events: [
    {
      type: 'CUSTOMER_INFLUX',
      signalRound: 2,
      effectRound: 3,
      signalText: '【市场情报】有消息称新区多个大型楼盘即将交付，适龄学生数量可能大幅增加。',
      effectText: '【事件生效】新居民涌入！适龄生源扩大 30%。',
    },
    {
      type: 'PRICE_WAR_EXTERNAL',
      signalRound: 3,
      effectRound: 4,
      signalText: '【市场情报】教育局正在酝酿新的办学评估标准，教学质量可能成为核心考核指标。',
      effectText: '【事件生效】新评估标准实施！家长对学费的敏感度下降，教学质量权重提升。',
    },
  ],

  generateForecast(): MarketForecast[] {
    const actions: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
    const pool: Record<BaseAction, Array<{ headline: string; detail: string }>> = {
      ATK: [
        { headline: '周边学区房价格松动', detail: '家长对学费更敏感，奖学金抢生源效果可能更强' },
        { headline: '竞争对手缩减招生预算', detail: '独家发放奖学金有望大幅抢占优质生源' },
        { headline: '教育局鼓励扩大招生规模', detail: '政策支持下奖学金抢生的阻力更小' },
      ],
      QUA: [
        { headline: '重点高中提高自主招生门槛', detail: '教研投入提升教学质量可能更受家长青睐' },
        { headline: '新课标改革方案即将落地', detail: '提前布局教研有助于率先适配新标准' },
        { headline: '区教研室发布教学质量排名', detail: '教研积累深厚的学校可能获得排名红利' },
      ],
      MKT: [
        { headline: '家长择校季信息搜索量激增', detail: '口碑宣传在信息高峰期传播效率更高' },
        { headline: '本区教育公众号阅读量翻倍', detail: '此时投入口碑推广可能获得更高曝光回报' },
        { headline: '学区房中介加大推荐力度', detail: '借助渠道口碑宣传可以低成本触达目标家长' },
      ],
      HOLD: [
        { headline: '多校竞争导致招生成本飙升', detail: '稳健办学避免消耗战可能是更明智的选择' },
        { headline: '教育政策进入观望期', detail: '稳健经营等待政策明朗再出手风险更低' },
        { headline: '在校生家长满意度调查结果良好', detail: '维持现状稳定办学有助于巩固存量生源' },
      ],
    }
    return Array.from({ length: 5 }, (_, i) => {
      const signal = actions[Math.floor(Math.random() * 4)]
      const options = pool[signal]
      const pick = options[Math.floor(Math.random() * options.length)]
      return {
        round: i + 1,
        signal,
        isTrue: Math.random() < 0.5,
        headline: pick.headline,
        detail: pick.detail,
      }
    })
  },

  generateIntel,

  playerNames: {
    A: '育才中学',
    B: '启航实验',
    C: '博雅学府',
    D: '明德书院',
    E: '红枫附中',
    F: '蓝湾国际',
    G: '翠园实验',
    H: '朝晖学堂',
  },

  // 名校：声望为王 · 品牌效应极强 · 促销（抢生源）效果弱 · 口碑一旦建立难以撼动
  mechanicsDescription: '🎓 声望模式 · 声望天花板极高 · 促销抢生源效果弱 · 品牌粘性强防御壁垒高',
  configOverrides: {
    atkBaseBonus: 7.0,              // 降价抢生源效果弱（家长不完全看价格）
    atkSoloInflux: 1.15,            // 名校独家降价吸引力低
    mktBaseBonus: 5.0,              // 口碑推广效果翻倍
    brandHeatGainFromMkt: 18,       // 声望增长较快（P0-2: 原30→18）
    brandHeatCap: 100,              // 声望天花板极高
    brandHeatThresholdForMonetize: 40, // 更容易解锁品牌变现
    brandMonetizeRevenueBonus: 0.15,// 声望变现回报更高
    momentumGainFromMkt: 1.0,       // 口碑动量（P0-2: 原1.5→1.0）
    mktConsecutiveFatigue: 0.7,     // 连续推广效率降低（口碑审美疲劳）
    holdPressurePenalty: 0,         // P0-3: HOLD无惩罚
    holdMarginBoostPerRound: 0.015, // 名校不作为利润率加成较小
    holdDefenseBarrier: 0.7,        // 名校品牌粘性强，防御壁垒高
    qualityInvestCost: 100000,      // 教研投入更贵（师资培训）
    qualitySignalBonus: 4.0,        // 但教学质量信号更强
  },
}
