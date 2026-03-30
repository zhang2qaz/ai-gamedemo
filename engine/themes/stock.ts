// =====================
// 弈战 - 股市风云主题
// =====================

import type { IntelSource, RoundIntel, IntelCard, CompanyProfile, ThemeConfig } from './types'
import type { BaseAction } from '../types'

const companies: CompanyProfile[] = [
  { id: 'A', name: '猎鹰资本', slogan: '精准出击，一击必中', style: '价值投资派', colorClass: 'amber' },
  { id: 'B', name: '锐锋投资', slogan: '速度就是利润', style: '短线进攻派', colorClass: 'sky' },
  { id: 'C', name: '星辰基金', slogan: '顺势而为，乘风破浪', style: '趋势投资派', colorClass: 'emerald' },
  { id: 'D', name: '恒盈私募', slogan: '稳中求胜，时间的朋友', style: '防御稳健派', colorClass: 'purple' },
]

export const STOCK_THEME: ThemeConfig = {
  id: 'stock',
  title: '股市风云',
  subtitle: '2024年·A股四大私募争锋',
  description: '四家私募基金在A股科技板块展开激烈角逐，通过做多、研究、造势和持仓四种策略争夺投资者资金池，五个季度后累计收益最高者胜出。',
  icon: '📈',
  accentClass: 'sky',

  scenario: {
    title: '2024年·A股科技板块四大私募争锋',
    background:
      '2024年，A股科技板块迎来历史性机遇。人工智能、半导体、新能源三大赛道同步爆发，' +
      '万亿级增量资金涌入市场。四家顶级私募基金——猎鹰资本、锐锋投资、星辰基金、恒盈私募——' +
      '齐聚科技板块，展开一场为期五个季度的殊死较量。它们争夺的是同一个投资者资金池：' +
      '散户、机构、北向资金汇聚而成的庞大洪流。激进做多者抢占先机但推高成本，' +
      '深度研究者蓄势待发等待价值回归，造势宣传者搅动市场情绪博取关注，' +
      '稳健持仓者静待风暴过后收割确定性收益。五个季度结束时，累计收益最高的基金将登顶A股之巅。',
    marketName: 'A股科技板块投资者资金池',
  },

  companies,

  actionNarrative: {
    ATK: {
      title: '激进做多',
      desc: '低价大量买入抢筹码，短期内快速扩大持仓占比。',
      risk: '多方同时做多效果互相摊薄，连续追高投资者信心会下降。',
    },
    QUA: {
      title: '深度研究',
      desc: '投入¥8万做行业深度研究，提升选股眼光，下季度研究成果落地后实力大增。',
      risk: '本季花钱多、见效慢，需要等下一季研究成果出来才能看到全部回报。',
    },
    MKT: {
      title: '造势宣传',
      desc: '投入¥10万做财经媒体曝光、路演宣传，提升基金在市场上的关注度。',
      risk: '多家同时造势效果互相摊薄；停止宣传后关注度会自然衰减。',
    },
    HOLD: {
      title: '稳健持仓',
      desc: '不折腾、维持现有仓位正常交易，收益最稳。',
      risk: '对手激进做多或造势时你会被压制，连续守仓太久收益率会下降。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '🚀',
      cost: '低价大量抢筹，薄利多销扩大持仓',
    },
    QUA: {
      emoji: '🔍',
      cost: '投入¥8万深度研究，下季度出研究成果',
    },
    MKT: {
      emoji: '📢',
      cost: '投入¥10万路演造势，提升基金知名度',
    },
    HOLD: {
      emoji: '🛡',
      cost: '正常价格交易，收益最稳但不主动抢筹',
    },
  },

  finalShiftNarrative: {
    NONE: { title: '不附加', desc: '最后一季正常比赛，不做额外操作' },
    FINAL_PUSH: { title: '全仓冲刺', desc: '加杠杆满仓押注，不惜代价抢筹码（收益打八折）' },
    QUALITY_CONVERT: { title: '研究总爆发', desc: '一次性发布所有研究成果，用深度报告碾压对手' },
    DEFENSIVE_LOCK: { title: '锁仓护盘', desc: '锁定持仓不动，对手做多对你的冲击减半' },
    BRAND_MONETIZE: { title: '接受财经专访', desc: '关注度够高时，上财经节目接受专访变现影响力' },
  },

  terms: {
    unit: '手',
    customers: '资金池',
    marketShare: '持仓占比',
    profit: '收益',
    cumulativeProfit: '累计收益',
    brandHeat: '市场关注',
    qualityScore: '研究深度',
    newProductReserve: '研究储备',
    freshness: '投资者信心',
    competitiveness: '竞争力',

    brandHeatUnlock: '终局可套利',
    brandHeatBuilding: '关注度有加成',
    brandHeatLow: '继续造势积累',
    qualityHigh: '研究积累中',
    qualityNormal: '基准水平',
    reserveHas: '终局可一键爆发',
    reserveNone: '研究可积累',
    freshNormal: '做多满效',
    freshWarn: '再激进会受罚',
    freshDanger: '追高效果大减',
    holdPenalty: '收益率已下降',
    momentum: '额外持仓加成',
  },

  styleMap: {
    ATK: '激进做多型',
    QUA: '价值研究型',
    MKT: '市场操盘型',
    HOLD: '稳健持仓型',
  },

  narration: {
    atkMultiple: '同时激进做多，多方资金争抢导致成本上升，收益互相摊薄。',
    atkSingle: '独家激进做多，抢占低价筹码优势。',
    quaDesc: '投入深度研究，蓄势下回合兑现。',
    mktDesc: '加大造势宣传，市场关注度持续攀升。',
  },

  events: [
    {
      type: 'CUSTOMER_INFLUX',
      signalRound: 2,
      effectRound: 3,
      signalText: '【市场情报】有传闻称外资正在大规模布局科技板块，市场资金池可能大幅扩容。',
      effectText: '【事件生效】北向资金涌入！市场资金池扩大 30%。',
    },
    {
      type: 'PRICE_WAR_EXTERNAL',
      signalRound: 3,
      effectRound: 4,
      signalText: '【市场情报】监管层释放信号，未来可能加强投机交易限制，市场风格将从炒作转向价值。',
      effectText: '【事件生效】监管收紧！投机敏感度下降，研究深度权重提升。',
    },
  ],

  playerNames: {
    A: '猎鹰资本',
    B: '锐锋投资',
    C: '星辰基金',
    D: '恒盈私募',
  },

  generateIntel: (): RoundIntel[] => {
    function pick<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]
    }
    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    type Variant = { source: IntelSource; text: string; tag?: string }
    function slot(impliedAction: BaseAction, truePool: Variant[], falsePool: Variant[]): IntelCard {
      const isTrue = Math.random() < 0.5
      return { ...pick(isTrue ? truePool : falsePool), isTrue, impliedAction }
    }

    // ── R1: 开局布局 — 价格敏感度60%，激进做多最有效 ──
    const r1Atk_T: Variant[] = [
      { source: '分析师预测', text: '当前价格敏感度高达60%，激进做多可获得显著的竞争优势，是开局抢筹的最佳窗口。', tag: '量化模型' },
      { source: '行业报告', text: '低价抢筹虽然利润率较低，但在高价格敏感度下份额增量远超利润率损失。', tag: '策略研判' },
    ]
    const r1Atk_F: Variant[] = [
      { source: '内部消息', text: '激进做多的竞争力加成极高，开局全仓做多几乎可以锁定第一名。', tag: '小道消息' },
      { source: '竞品情报', text: '多家基金同时做多时加成不会摊薄，越多人做多收益越大。', tag: '市场传闻' },
    ]

    const r1Qua_T: Variant[] = [
      { source: '行业报告', text: '深度研究投入¥8万，即时提升竞争力，下季度大幅提升研究深度，适合中长线布局。', tag: '投研策略' },
      { source: '分析师预测', text: '当前品质权重仅40%，研究投入的即时回报有限，但积累的研究储备在终局可一次性释放。', tag: '量化分析' },
    ]
    const r1Qua_F: Variant[] = [
      { source: '内部消息', text: '第一季度做研究毫无意义，品质权重极低，纯属浪费资金。', tag: '市场传闻' },
      { source: '行业报告', text: '深度研究需要投入¥15万，成本过高，不建议前期使用。', tag: '错误报告' },
    ]

    const r1Mkt_T: Variant[] = [
      { source: '消费者调研', text: '造势宣传花费¥10万，可稳步提升市场关注度，但需持续积累才能在终局触发套利变现。', tag: '市场调研' },
      { source: '分析师预测', text: '市场关注度每季自然衰减，需要持续投入才能维持高关注水平。', tag: '趋势预测' },
    ]
    const r1Mkt_F: Variant[] = [
      { source: '竞品情报', text: '造势宣传每季可大幅提升关注度，两季即可达到套利门槛。', tag: '竞品分析' },
      { source: '内部消息', text: '市场关注度可以无上限增长，越高收益加成越大。', tag: '小道消息' },
    ]

    const r1Hold_T: Variant[] = [
      { source: '行业报告', text: '稳健持仓利润率高于做多，但在价格敏感度60%的市场中份额增长乏力。', tag: '基本面' },
      { source: '分析师预测', text: '连续持仓超过两季后利润率将明显下滑，且市场动量会逐渐衰减，不宜长期固守。', tag: '风险提示' },
    ]
    const r1Hold_F: Variant[] = [
      { source: '内部消息', text: '稳健持仓是开局最优策略，丰厚收益且完全不受对手行为影响。', tag: '市场传闻' },
      { source: '竞品情报', text: '连续持仓三季以上利润率反而会回升，长线持仓稳赚不赔。', tag: '错误情报' },
    ]

    // ── R2: 资金涌入预警 — 下回合资金池+30% ──
    const r2Atk_T: Variant[] = [
      { source: '分析师预测', text: '北向资金传闻属实的话，下季资金池将扩大30%，现在做多抢占份额，下季可享受放大后的资金池红利。', tag: '策略建议' },
      { source: '行业报告', text: '独家做多时可获得显著的竞争优势，但如果多方同时做多，加成会被均分摊薄。', tag: '博弈分析' },
    ]
    const r2Atk_F: Variant[] = [
      { source: '内部消息', text: '北向资金下季度会撤出而非流入，现在做多会被套在高位。', tag: '小道消息' },
      { source: '竞品情报', text: '做多后份额锁定三个季度不变，不需要每季重复操作。', tag: '市场传闻' },
    ]

    const r2Qua_T: Variant[] = [
      { source: '行业报告', text: '融资融券数据显示杠杆资金集中在短线，深度研究型基金在资金涌入后更具吸引力。', tag: '数据分析' },
      { source: '分析师预测', text: '本季投入¥8万做研究，下季大幅提升研究深度，叠加资金池扩容，中期回报率最优。', tag: '估值模型' },
    ]
    const r2Qua_F: Variant[] = [
      { source: '内部消息', text: '量化交易占市场60%以上，基本面研究已完全失效，不建议投入研究。', tag: '小道消息' },
      { source: '竞品情报', text: '研究深度提升后可极大提升竞争优势而非仅提升竞争力，效果远超做多。', tag: '错误情报' },
    ]

    const r2Mkt_T: Variant[] = [
      { source: '消费者调研', text: '资金涌入前提升关注度是明智之举，关注度有上限，需合理规划造势节奏、避免浪费。', tag: '市场洞察' },
      { source: '分析师预测', text: '券商评级报告显示高关注度基金在增量资金分配中更受青睐，造势宣传有隐性份额加成。', tag: '行业研报' },
    ]
    const r2Mkt_F: Variant[] = [
      { source: '竞品情报', text: '造势宣传的效果会在资金涌入后翻倍，每点关注度价值大幅提升。', tag: '市场传闻' },
      { source: '内部消息', text: '关注度没有上限，投入越多收益越高，应全力造势。', tag: '小道消息' },
    ]

    const r2Hold_T: Variant[] = [
      { source: '行业报告', text: '技术指标显示市场处于蓄力期，稳健持仓保留资金等待下季放量是合理策略。', tag: 'K线分析' },
      { source: '分析师预测', text: '持仓利润率虽然稳定，但连续两季后利润率将明显下滑，需搭配其他动作轮换。', tag: '策略建议' },
    ]
    const r2Hold_F: Variant[] = [
      { source: '内部消息', text: '资金涌入后持仓者会优先分配增量资金，稳健持仓是最大赢家。', tag: '市场传闻' },
      { source: '竞品情报', text: '连续持仓的利润率惩罚已被取消，持仓越久越有利。', tag: '错误情报' },
    ]

    // ── R3: 资金已到 — 13万资金池，最大化收益 ──
    const r3Atk_T: Variant[] = [
      { source: '分析师预测', text: '资金池已大幅扩容，做多者份额的绝对值大幅提升，即使利润率低也能通过规模取胜。', tag: '量化模型' },
      { source: '行业报告', text: 'PE/PB估值数据显示当前板块处于合理区间，低价抢筹的风险回报比较优。', tag: '估值分析' },
    ]
    const r3Atk_F: Variant[] = [
      { source: '内部消息', text: '做多的竞争力加成在资金扩容后自动翻倍，是无脑抢筹的最佳时机。', tag: '小道消息' },
      { source: '竞品情报', text: '资金涌入后价格敏感度大幅下降，做多效果大打折扣。', tag: '市场传闻' },
    ]

    const r3Qua_T: Variant[] = [
      { source: '行业报告', text: '行业研报显示下季监管可能收紧，品质权重将大幅提升，本季积累研究深度可提前布局。', tag: '政策面' },
      { source: '分析师预测', text: '每季积累的研究成果都能转化为竞争力，多季持续投研的基金在终局拥有巨大爆发潜力。', tag: '策略模型' },
    ]
    const r3Qua_F: Variant[] = [
      { source: '内部消息', text: '研究储备在第四季度会被监管清零，现在积累完全没有意义。', tag: '小道消息' },
      { source: '竞品情报', text: '研究爆发时每点储备回报极低，不值得投入。', tag: '错误情报' },
    ]

    const r3Mkt_T: Variant[] = [
      { source: '消费者调研', text: '资金池扩大后投资者选择更分散，关注度达标后可触发套利变现，带来可观的额外收益。', tag: '投资者行为' },
      { source: '分析师预测', text: '造势可稳步提升市场关注度，但每季会自然衰减，需连续造势才能突破套利门槛。', tag: '数据跟踪' },
    ]
    const r3Mkt_F: Variant[] = [
      { source: '竞品情报', text: '关注度套利的收益加成极高，是最强终局技能。', tag: '市场传闻' },
      { source: '内部消息', text: '只需一季造势即可达到套利门槛，无需连续投入。', tag: '小道消息' },
    ]

    const r3Hold_T: Variant[] = [
      { source: '行业报告', text: '资金流向数据显示增量资金偏好稳健型，但历史份额仍是份额计算的主要因素，急进者仍有份额优势。', tag: '资金流向' },
      { source: '分析师预测', text: '持仓虽然安全，但市场动量会逐渐衰减，连续持仓将完全丧失动量加成。', tag: '动量分析' },
    ]
    const r3Hold_F: Variant[] = [
      { source: '内部消息', text: '资金涌入后持仓者自动获得额外动量加成，是躺赢的最佳时机。', tag: '市场传闻' },
      { source: '竞品情报', text: '持仓的动量衰减极小，几乎可以忽略不计。', tag: '错误情报' },
    ]

    // ── R4: 风格切换 — 品质权重升至55%，价值投资占优 ──
    const r4Atk_T: Variant[] = [
      { source: '分析师预测', text: '监管收紧后品质权重升至55%，价格敏感度降至45%，做多的竞争力加成效果被削弱但仍有份额价值。', tag: '政策解读' },
      { source: '行业报告', text: '连续追高的疲劳惩罚不可忽视，边际收益递减明显，应审慎评估是否持续做多。', tag: '风控模型' },
    ]
    const r4Atk_F: Variant[] = [
      { source: '内部消息', text: '监管收紧只是表面文章，实际价格敏感度仍然是60%，做多依旧是最优策略。', tag: '小道消息' },
      { source: '竞品情报', text: '做多的追高疲劳在监管收紧后被重置为零，可以放心连续做多。', tag: '市场传闻' },
    ]

    const r4Qua_T: Variant[] = [
      { source: '行业报告', text: '品质权重提升至55%，研究深度对竞争力的贡献几乎翻倍，之前积累研究的基金将大幅受益。', tag: '价值回归' },
      { source: '分析师预测', text: '研究储备在终局释放时可带来可观的基础竞争力，且每季积累的研究成果都能进一步放大爆发效果，高储备基金终局优势巨大。', tag: '终局模型' },
    ]
    const r4Qua_F: Variant[] = [
      { source: '竞品情报', text: '品质权重只提升到42%，变化微乎其微，研究投入依然不如做多划算。', tag: '错误分析' },
      { source: '内部消息', text: '研究储备在释放时只影响品质得分，不影响竞争力，实际效果有限。', tag: '误导信息' },
    ]

    const r4Mkt_T: Variant[] = [
      { source: '消费者调研', text: '监管收紧后市场风格转向价值，但造势带来的动量加成在份额计算中仍占有一定权重，不可完全忽视。', tag: '资金面' },
      { source: '分析师预测', text: '关注度存在上限，如果已接近上限则造势的边际效益递减，应考虑转向其他策略。', tag: '边际分析' },
    ]
    const r4Mkt_F: Variant[] = [
      { source: '内部消息', text: '监管收紧后造势宣传被限制，关注度增长大幅缩水。', tag: '小道消息' },
      { source: '竞品情报', text: '造势宣传在品质权重提升后完全无效，应立即停止一切造势投入。', tag: '错误建议' },
    ]

    const r4Hold_T: Variant[] = [
      { source: '行业报告', text: '风格切换期持仓观望是稳妥之选，但需注意第五季是终局，持仓者可能因动量不足丧失冲刺机会。', tag: '策略建议' },
      { source: '分析师预测', text: '持仓期间市场动量会逐渐衰减，动量在份额计算中占有一定权重，连续持仓者将在终局缺乏爆发力。', tag: '风险预警' },
    ]
    const r4Hold_F: Variant[] = [
      { source: '竞品情报', text: '第四季持仓者在终局自动获得防御加成，是进入终局的最安全姿态。', tag: '市场传闻' },
      { source: '内部消息', text: '监管收紧后持仓收益率极高，是全场最高回报率策略。', tag: '小道消息' },
    ]

    // ── R5: 终局决战 — 最后一季，全力冲刺还是稳扎稳打？ ──
    const r5Atk_T: Variant[] = [
      { source: '分析师预测', text: '终局做多与全仓冲刺可以叠加，带来显著的竞争优势，但冲刺后收益打八折，需权衡取舍。', tag: '终局策略' },
      { source: '行业报告', text: '最后一季追高疲劳不再影响后续季度，但疲劳值本身仍会削弱本季竞争力。', tag: '规则解读' },
    ]
    const r5Atk_F: Variant[] = [
      { source: '内部消息', text: '终局做多有隐藏的双倍加成机制，可碾压一切策略。', tag: '小道消息' },
      { source: '竞品情报', text: '终局全仓冲刺不会扣减收益，是纯粹的竞争力增强，没有任何代价。', tag: '错误情报' },
    ]

    const r5Qua_T: Variant[] = [
      { source: '行业报告', text: '研究总爆发可释放全部储备，带来可观的基础竞争力加成，多季积累者此时一次性兑现，爆发效果与储备深度正相关。', tag: '爆发窗口' },
      { source: '分析师预测', text: '品质权重55%环境下，研究爆发的竞争力贡献被进一步放大，是高储备基金的最强终局手段。', tag: '数学验证' },
    ]
    const r5Qua_F: Variant[] = [
      { source: '竞品情报', text: '研究总爆发的竞争力加成微乎其微，无论储备多少都一样。', tag: '错误情报' },
      { source: '内部消息', text: '终局做研究还能继续积累储备到下季——但游戏已经结束了，没有下季。', tag: '逻辑陷阱' },
    ]

    const r5Mkt_T: Variant[] = [
      { source: '消费者调研', text: '关注度达标后可触发套利变现，带来可观的额外收益，适合已达门槛的基金；未达标则不如转向做多或研究爆发。', tag: '变现窗口' },
      { source: '分析师预测', text: '终局造势仅在关注度接近套利门槛时有价值，已达门槛则应转为套利，远未达标则不如做多或研究爆发。', tag: '决策树' },
    ]
    const r5Mkt_F: Variant[] = [
      { source: '内部消息', text: '终局造势的关注度增长大幅翻倍，一季即可从零冲到套利门槛。', tag: '小道消息' },
      { source: '竞品情报', text: '关注度套利的收益加成极为可观，是碾压性的终局技能。', tag: '夸大宣传' },
    ]

    const r5Hold_T: Variant[] = [
      { source: '行业报告', text: '终局持仓适合已领先的基金保住优势，但锁仓护盘可将对手做多冲击减半，比纯持仓更具防御价值。', tag: '防守策略' },
      { source: '分析师预测', text: '终局持仓收益稳定但缺乏爆发力，如果累计收益已落后，必须选择更激进的终局策略。', tag: '形势研判' },
    ]
    const r5Hold_F: Variant[] = [
      { source: '竞品情报', text: '终局持仓有隐藏的极大竞争优势，是最安全且最强的终局策略。', tag: '市场传闻' },
      { source: '内部消息', text: '锁仓护盘可以完全免疫对手的一切攻击，保证不丢任何份额。', tag: '小道消息' },
    ]

    return [
      {
        round: 1,
        headline: '开局布局：科技板块资金博弈启幕',
        cards: shuffle([
          slot('ATK', r1Atk_T, r1Atk_F),
          slot('QUA', r1Qua_T, r1Qua_F),
          slot('MKT', r1Mkt_T, r1Mkt_F),
          slot('HOLD', r1Hold_T, r1Hold_F),
        ]),
      },
      {
        round: 2,
        headline: '资金涌入预警：北向资金异动频繁',
        cards: shuffle([
          slot('ATK', r2Atk_T, r2Atk_F),
          slot('QUA', r2Qua_T, r2Qua_F),
          slot('MKT', r2Mkt_T, r2Mkt_F),
          slot('HOLD', r2Hold_T, r2Hold_F),
        ]),
      },
      {
        round: 3,
        headline: '资金已到：13万手资金池放量行情',
        cards: shuffle([
          slot('ATK', r3Atk_T, r3Atk_F),
          slot('QUA', r3Qua_T, r3Qua_F),
          slot('MKT', r3Mkt_T, r3Mkt_F),
          slot('HOLD', r3Hold_T, r3Hold_F),
        ]),
      },
      {
        round: 4,
        headline: '风格切换：监管收紧价值回归',
        cards: shuffle([
          slot('ATK', r4Atk_T, r4Atk_F),
          slot('QUA', r4Qua_T, r4Qua_F),
          slot('MKT', r4Mkt_T, r4Mkt_F),
          slot('HOLD', r4Hold_T, r4Hold_F),
        ]),
      },
      {
        round: 5,
        headline: '终局决战：最后一季定乾坤',
        cards: shuffle([
          slot('ATK', r5Atk_T, r5Atk_F),
          slot('QUA', r5Qua_T, r5Qua_F),
          slot('MKT', r5Mkt_T, r5Mkt_F),
          slot('HOLD', r5Hold_T, r5Hold_F),
        ]),
      },
    ]
  },
}
