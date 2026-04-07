// =====================
// 弈战 - 工厂风云主题
// =====================

import type { IntelSource, RoundIntel, IntelCard, CompanyProfile, ThemeConfig } from './types'
import { CONFIG } from '../constants'
import type { BaseAction } from '../types'

// ── 情报生成辅助 ──

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

type Slot = {
  action: BaseAction
  trueCards: Omit<IntelCard, 'isTrue' | 'impliedAction'>[]
  falseCards: Omit<IntelCard, 'isTrue' | 'impliedAction'>[]
}

function buildRoundIntel(
  round: number,
  headline: string,
  slots: Slot[],
): RoundIntel {
  const cards: IntelCard[] = []
  for (const slot of slots) {
    const trues = pick(slot.trueCards, 1).map((c) => ({
      ...c,
      isTrue: true as const,
      impliedAction: slot.action,
    }))
    const falses = pick(slot.falseCards, 1).map((c) => ({
      ...c,
      isTrue: false as const,
      impliedAction: slot.action,
    }))
    cards.push(...trues, ...falses)
  }
  return { round, headline, cards: shuffle(cards) }
}

// ── 情报源 ──

const SRC: Record<string, IntelSource> = {
  REPORT: '行业报告',
  RIVAL: '竞品情报',
  SURVEY: '消费者调研',
  INSIDER: '内部消息',
  ANALYST: '分析师预测',
  POLICY: '监管动态',
}

// ── 情报生成器 ──

function generateIntel(): RoundIntel[] {
  // ── R1: 开局竞争 ──
  const r1: Slot[] = [
    {
      action: 'ATK',
      trueCards: [
        { source: SRC.REPORT, text: '当前市场价格敏感度高达60%，低价报价能显著提升订单量，是开局抢占份额的最佳窗口。' },
        { source: SRC.ANALYST, text: '行业分析师指出，首季订单分配主要看报价竞争力，大幅降价可获得最大单量优势。' },
        { source: SRC.SURVEY, text: '客户采购调研显示，本季度各厂商产品差异不大，采购方最看重的就是价格，低价抢单效果最佳。' },
        { source: SRC.INSIDER, text: '供应链消息称原材料价格本季稳定，低价报价的利润虽薄但可控，适合激进抢单。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '内部消息称本季只有你一家计划低价抢单，独家低价可获得极大的竞争优势，轻松碾压对手。' },
        { source: SRC.ANALYST, text: '供应链数据显示低价抢单不会累积客户疲劳指数，可连续多季使用且效果不减。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '技术升级投入¥8万，虽然本季成本偏高，但能小幅提升产品实力，下季技术成果落地后大幅提升的长线回报。' },
        { source: SRC.INSIDER, text: '内部评估显示，首季投入技术升级可在第二季形成明显技术壁垒，良品率提升带来的成本节约可观。' },
        { source: SRC.ANALYST, text: '分析师认为提前布局技术升级是稳健策略，后期行业标准提升时技术领先者将获得巨大优势。' },
        { source: SRC.SURVEY, text: '下游厂商反馈，愿意为通过ISO高级认证的供应商支付5%-8%溢价，技术投入中长期回报确定。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '技术升级本季即时技术大幅提升，远超其他策略，且本季有政策补贴成本仅¥3万。' },
        { source: SRC.INSIDER, text: '内部评估显示首季技术升级后技术实力大幅提升，一次投入即可建立碾压级技术壁垒。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '品牌推广投入¥10万可大幅提升行业口碑，虽然短期ROI不高，但口碑累积到门槛后可实现溢价变现。' },
        { source: SRC.SURVEY, text: '客户调研表明，在产品同质化严重的制造业，品牌认知度对长期订单稳定性有决定性影响。' },
        { source: SRC.ANALYST, text: '行业展会季即将到来，首季投入品牌推广能在展会期间获得更多曝光，为后续季度订单打基础。' },
        { source: SRC.INSIDER, text: '内部市场部评估，本季参加3场行业展会+线上推广的组合方案性价比最高，建议加大品牌投入。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '品牌推广每次口碑大幅提升，只需两季即可突破溢价变现门槛，回报速度极快。' },
        { source: SRC.REPORT, text: '多家同时推广效果叠加而非摊薄，推广越多行业整体关注度越高，所有推广方都受益。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '稳定生产以正常报价出货，首季可提供健康的现金流，为后续操作保留资金弹性。' },
        { source: SRC.ANALYST, text: '分析师建议首季保持稳定生产观察市场动态，避免盲目投入，等信息更充分后再做决策。' },
        { source: SRC.INSIDER, text: '产能利用率评估显示，首季维持正常生产节奏可优化供应链效率，降低库存成本。' },
        { source: SRC.SURVEY, text: '客户满意度调查表明，稳定的交付周期和品质一致性是大客户选择供应商的首要标准。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '稳定生产利润丰厚，远超其他策略，且完全不受对手进攻行为的竞争压制影响。' },
        { source: SRC.INSIDER, text: '连续稳产可触发系统额外产能奖励，利润率逐季递增，是最安全的长线策略。' },
      ],
    },
  ]

  // ── R2: 需求扩张预警 ──
  const r2: Slot[] = [
    {
      action: 'ATK',
      trueCards: [
        { source: SRC.INSIDER, text: '下游厂商正在集中扩产的消息已经传开，下季订单池可能扩大30%，现在低价抢单可提前锁定客户关系。' },
        { source: SRC.ANALYST, text: '分析师预测下季订单激增，建议本季用低价策略扩大客户基础，为下季大订单做准备。' },
        { source: SRC.REPORT, text: '市场情报显示客户采购预算正在上调，但本季仍以价格为主要决策因素，低价策略依然有效。' },
        { source: SRC.SURVEY, text: '采购经理调研反馈，面对即将到来的扩产需求，他们倾向于选择报价最有竞争力的供应商建立合作。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '内部消息称下季订单扩大后低价效果翻倍，现在抢到的份额在下季自动享受2倍红利。' },
        { source: SRC.ANALYST, text: '数据分析显示多方同时低价时加成不会摊薄，反而因价格竞争刺激市场整体增长。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '下季订单激增意味着客户对产能和质量的要求会更高，提前投入技术升级可在需求高峰时占据优势。' },
        { source: SRC.INSIDER, text: '产线改造消息：自动化设备本季交付顺利，投入技术升级可在下季实现产能和良品率双提升。' },
        { source: SRC.ANALYST, text: '分析师指出，需求爆发期技术领先的厂商通常能获得更高附加值订单，建议加速技术储备。' },
        { source: SRC.SURVEY, text: '客户反馈显示，扩产阶段更重视供应商的质量管理体系，通过ISO认证的厂商订单优先级更高。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '技术升级在需求扩张前投入效果翻倍，下季技术实力大幅提升，是布局的最佳时机。' },
        { source: SRC.INSIDER, text: '技术升级成本本季有政策补贴仅需¥4万，且即时获得极大的竞争优势。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '需求即将爆发，提前做品牌推广可在下季订单分配时获得品牌溢价优势，口碑积累效果显著。' },
        { source: SRC.SURVEY, text: '采购决策调研显示，下游厂商扩产时倾向于选择行业口碑好的供应商，品牌投入正当其时。' },
        { source: SRC.ANALYST, text: '分析师建议在需求扩张前加大品牌建设，抢占客户心智，为后续季度的大单做铺垫。' },
        { source: SRC.INSIDER, text: '市场部反馈，本季行业期刊广告位价格优惠，品牌推广的性价比是全年最高的。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '需求扩张前品牌推广效果加倍，口碑大幅提升，且衰减速度减半，缓慢衰减。' },
        { source: SRC.REPORT, text: '行业数据显示品牌推广在需求爆发前的ROI是全年最高的，远超低价和技术路线。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '稳定生产积累资金，为下季需求爆发时的扩产做好准备，现金流充裕是应对市场变化的关键。' },
        { source: SRC.ANALYST, text: '分析师建议本季稳产观望，等下季订单真正到来时再决定是低价抢还是溢价出，保留最大灵活性。' },
        { source: SRC.INSIDER, text: '生产部门评估显示，本季维持稳定生产可优化产线效率，为下季可能的满负荷生产做好产能准备。' },
        { source: SRC.SURVEY, text: '老客户反馈，稳定供货的厂商在扩产期会优先获得订单，急于低价的反而被质疑产品质量。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '稳产积累的资金在需求爆发时会自动转化为获得额外竞争优势，是最聪明的等待策略。' },
        { source: SRC.REPORT, text: '连续稳产的利润率不会下降，即使持续多季也始终保持丰厚的利润。' },
      ],
    },
  ]

  // ── R3: 订单已到 ──
  const r3: Slot[] = [
    {
      action: 'ATK',
      trueCards: [
        { source: SRC.REPORT, text: '订单池已扩大至13万台，低价抢单可在放大的市场中获取更多订单量，薄利多销效果显著。' },
        { source: SRC.ANALYST, text: '分析师指出13万台订单中有大量价格敏感型客户，低价策略在本季的收益上限大幅提高。' },
        { source: SRC.SURVEY, text: '客户调研显示新增订单以中小客户为主，他们对价格极度敏感，大幅降价吸引力巨大。' },
        { source: SRC.INSIDER, text: '销售部反馈，多个大客户正在比价阶段，低价报价可一举拿下几个关键长期合同。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '订单池扩大后低价竞争力加成自动翻倍，是抢夺增量市场的绝对最优策略。' },
        { source: SRC.ANALYST, text: '客户数据显示13万台订单中90%是价格敏感型，低价效果在本季达到全局巅峰。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '前期技术投入开始兑现，本季继续投入可形成技术壁垒，高良品率在大订单量下优势倍增。' },
        { source: SRC.INSIDER, text: '质量管理部报告显示，智能制造升级后产线效率提升15%，技术投入的复利效应开始显现。' },
        { source: SRC.ANALYST, text: '分析师指出技术领先的厂商在订单激增期能获得更多高价值订单，技术投入的回报正在加速。' },
        { source: SRC.SURVEY, text: '大客户反馈，订单量大时更看重供应商的生产稳定性和良品率，技术实力成为关键筛选标准。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '技术投入在订单激增时效果加倍，即时获得极大的竞争优势，下季技术实力大幅提升，是爆发期最强策略。' },
        { source: SRC.INSIDER, text: '前期技术储备在本季可自动释放额外加成，累积越多爆发力越强，无需等到终局。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '订单涌入期品牌推广可将口碑转化为溢价优势，行业口碑高的厂商能在相同报价下优先获得订单。' },
        { source: SRC.SURVEY, text: '新客户调研显示，在供应商选择上行业口碑是仅次于价格的第二大决策因素，品牌建设值得投入。' },
        { source: SRC.ANALYST, text: '分析师指出订单高峰期正是品牌曝光的最佳时机，客户接触点增多意味着品牌推广ROI更高。' },
        { source: SRC.INSIDER, text: '市场部建议趁订单高峰期加大推广力度，新客户大量涌入时品牌宣传的触达效率翻倍。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '订单高峰期品牌推广的触达效率是平时的5倍，¥10万投入等效于平时的¥50万效果。' },
        { source: SRC.REPORT, text: '口碑积累到40即可开始变现加成，不需要等到70的门槛，本季推广即刻见效。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '订单涌入期稳定生产可确保交付质量，正常报价利润率高，在大盘订单增长下也能获得可观利润。' },
        { source: SRC.ANALYST, text: '分析师建议在订单高峰期保持正常报价和产能，避免过度扩张带来的质量和交付风险。' },
        { source: SRC.INSIDER, text: '生产部门评估显示，稳定生产可确保100%准时交付，大客户对交付可靠性的重视度在上升。' },
        { source: SRC.SURVEY, text: '行业调查显示，订单爆发期盲目扩张的厂商70%会出现质量事故，稳产是风险最低的选择。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '订单涌入期稳产厂商自动获得额外竞争优势，系统奖励稳定供货的供应商。' },
        { source: SRC.ANALYST, text: '13万台大市场中稳产的利润率自动提升，市场越大稳产越赚钱。' },
      ],
    },
  ]

  // ── R4: 质量标准升级 ──
  const r4: Slot[] = [
    {
      action: 'ATK',
      trueCards: [
        { source: SRC.REPORT, text: '新标准实施后价格敏感度下降，但低价抢单仍有一定效果，适合在对手观望时独家出击。' },
        { source: SRC.ANALYST, text: '分析师指出虽然质量权重提升，但价格仍占45%权重，如果技术实力够高，低价+高质量可形成碾压。' },
        { source: SRC.INSIDER, text: '销售部反馈部分中小客户仍然对价格敏感，低价策略对这部分细分市场依然有效。' },
        { source: SRC.SURVEY, text: '采购调研显示约40%的客户仍将价格作为首要决策因素，低价策略并未完全失效。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '新标准实施后低价策略效果不降反升，因为客户预算紧缩更需要性价比方案。' },
        { source: SRC.ANALYST, text: '内部数据显示价格敏感度实际并未下降，仍维持60%水平，低价抢单依然是最强策略。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '新标准下技术实力权重升至55%，前期有技术储备的厂商将获得巨大竞争力加成，技术投入迎来收获期。' },
        { source: SRC.ANALYST, text: '分析师强调新质量标准让技术领先者优势放大，已有技术积累的厂商应继续加码巩固壁垒。' },
        { source: SRC.INSIDER, text: '质量管理部报告：新标准对良品率要求提高，自动化产线的技术优势将转化为显著的成本优势。' },
        { source: SRC.SURVEY, text: '大客户明确表示新标准后将优先选择技术实力排名前两名的供应商，技术投入直接影响订单获取。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '新标准下技术投入的加成翻倍，即时小幅提升竞争力，下季技术实力大幅提升，技术路线碾压一切。' },
        { source: SRC.INSIDER, text: '技术实力权重实际已升至70%，远超官方公布的55%，技术领先即绝对领先。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '新标准下行业洗牌加速，此时品牌推广可强化"质量可靠"的市场认知，口碑积累事半功倍。' },
        { source: SRC.SURVEY, text: '客户调研显示新标准让采购方更重视供应商品牌信誉，行业口碑好的厂商获得更多试单机会。' },
        { source: SRC.ANALYST, text: '分析师建议在行业标准升级节点加大品牌投入，"技术+品牌"双轮驱动能形成最强竞争壁垒。' },
        { source: SRC.INSIDER, text: '市场部反馈，本季推出"通过新标准认证"的品牌宣传可获得行业媒体免费报道，推广效果加倍。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '新标准期间推广效果加倍，口碑大幅提升，且"通过新标准认证"的宣传可额外大幅提升声望。' },
        { source: SRC.INSIDER, text: '口碑在新标准期间的变现门槛降低至50，此前积累的声望即刻可以套利变现。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '新标准过渡期稳定生产可确保产品合规，避免因急于转型导致的质量问题和客户投诉。' },
        { source: SRC.ANALYST, text: '分析师建议在标准升级期保持稳产，消化新标准要求后再做战略调整，贸然行动风险大。' },
        { source: SRC.INSIDER, text: '生产部门评估显示，稳定生产可集中精力确保产品符合新标准，避免因双线作战导致两头失。' },
        { source: SRC.SURVEY, text: '客户反馈新标准期间更看重供应稳定性，频繁调整策略的厂商会被贴上"不稳定"标签。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '新标准对稳产厂商有额外政策补贴，利润率大幅提升，是全场最高回报率策略。' },
        { source: SRC.ANALYST, text: '稳产在标准升级期不受任何进攻压力惩罚，系统保护合规生产的厂商不被抢单。' },
      ],
    },
  ]

  // ── R5: 终局决战 ──
  const r5: Slot[] = [
    {
      action: 'ATK',
      trueCards: [
        { source: SRC.REPORT, text: '最后一季低价抢单可最大化出货量，配合终盘转向"全力冲产"可实现最大订单量的最后一搏。' },
        { source: SRC.ANALYST, text: '分析师指出终局阶段无需考虑长期影响，低价抢单的短期收益最大化是合理选择。' },
        { source: SRC.INSIDER, text: '销售部反馈年底客户集中采购，价格竞争力在最后一季依然是订单分配的核心因素。' },
        { source: SRC.SURVEY, text: '年度采购调研显示，客户年底清预算时更倾向于选择报价最低的供应商，低价效果最佳。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '终局低价竞争力加成不受人数摊薄影响，无论几家同时出手都能获得完整的竞争优势。' },
        { source: SRC.ANALYST, text: '最后一季低价抢单的份额增长效果是平时的3倍，终局爆发是逆转排名的最佳机会。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '最后一季技术投入配合"技术总爆发"终盘转向，可将全部技术储备一次性兑现，实现极高竞争力。' },
        { source: SRC.ANALYST, text: '分析师强调有技术积累的厂商在终局选择"技术总爆发"可获得碾压级竞争力，这是技术路线的终极回报。' },
        { source: SRC.INSIDER, text: '技术团队评估：累积的技术储备通过"技术总爆发"一次性释放，竞争力加成远超其他任何操作。' },
        { source: SRC.SURVEY, text: '客户反馈最后一季更看重供应商的综合技术实力，技术领先者将获得更高价值订单。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '技术储备在终局释放时可转化为碾压级优势，积累越多爆发力越强。' },
        { source: SRC.INSIDER, text: '最后一季技术投入的技术大幅提升同样会在终局结算中生效，相当于获得双倍回报。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '最后一季品牌推广配合"口碑溢价"终盘转向，可将累积口碑变现为营业额+3%的直接收益。' },
        { source: SRC.ANALYST, text: '分析师指出行业口碑达到70以上的厂商选择"口碑溢价"可获得可观的额外收入，品牌路线迎来收获。' },
        { source: SRC.INSIDER, text: '市场部评估显示，年底品牌推广的效果会延续到新一年，即使是最后一季也有长期品牌价值。' },
        { source: SRC.SURVEY, text: '年度客户忠诚度调研显示，行业口碑高的厂商获得的续约率高出30%，品牌资产是真实的壁垒。' },
      ],
      falseCards: [
        { source: SRC.ANALYST, text: '终局口碑溢价的营业额加成实际为+8%而非公布的+3%，是最被低估的终盘策略。' },
        { source: SRC.INSIDER, text: '口碑变现门槛仅需50分，大多数做过推广的厂商都已达到，终局选声望溢价稳赚。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '最后一季稳定生产配合"长约锁客"可减半对手低价冲击，守住既有份额确保累计产值排名。' },
        { source: SRC.ANALYST, text: '分析师建议累计产值领先的厂商在终局选择稳产+防御策略，守住优势比冒险扩张更明智。' },
        { source: SRC.INSIDER, text: '生产部门建议最后一季保持稳定出货，确保产品质量和交付可靠性给客户留下好的年终印象。' },
        { source: SRC.SURVEY, text: '客户反馈年底更看重供应稳定性，最后一季换供应商的意愿极低，稳产可锁定存量客户。' },
      ],
      falseCards: [
        { source: SRC.INSIDER, text: '终局稳产可获得系统额外奖励+5%累计产值，是确保排名不下滑的最安全策略。' },
        { source: SRC.ANALYST, text: '"长约锁客"的防御效果可完全免疫对手低价冲击（100%防御），而非仅减半。' },
      ],
    },
  ]

  return [
    buildRoundIntel(1, '开局竞争：制造四强首次交锋', r1),
    buildRoundIntel(2, '需求预警：下游扩产信号传来', r2),
    buildRoundIntel(3, '订单涌入：13万台争夺战', r3),
    buildRoundIntel(4, '标准升级：技术实力成胜负手', r4),
    buildRoundIntel(5, '终局决战：累计产值定王座', r5),
  ]
}

// ── 主题配置 ──

export const FACTORY_THEME: ThemeConfig = {
  id: 'factory',
  title: '工厂风云',
  subtitle: '2024年·制造业四强争锋',
  description: '四家制造企业在智能制造赛道角逐，通过低价抢单、技术升级、品牌推广和稳定生产四大策略争夺订单，五个季度后累计产值最高者胜出。',
  icon: '🏭',
  accentClass: 'emerald',

  scenario: {
    title: '2024年·智能制造赛道四强争锋',
    background:
      '2024年，智能制造浪潮席卷长三角工业走廊。四家实力相当的制造企业——精工制造、迅达工业、恒力科技、稳固重工——在同一细分赛道短兵相接。区域订单池总量10万台，每家初始占据25%产能份额。低价报价能迅速抢占订单，但利润微薄；技术升级能构筑长期壁垒，却要承受短期阵痛；品牌推广能赢得行业口碑，回报却需要耐心等待；稳定生产看似安全，久守则利润率下滑。五个季度的博弈，订单涌入、标准升级等外部冲击接踵而至——谁能在刀锋上起舞，累计产值登顶，谁就是这个赛道的王者。',
    marketName: '区域制造业订单市场',
  },

  companies: [
    { id: 'A', name: '精工制造', slogan: '精益求精，品质为本', style: '品质制造派', colorClass: 'amber' },
    { id: 'B', name: '迅达工业', slogan: '速度制胜，效率至上', style: '成本进攻派', colorClass: 'sky' },
    { id: 'C', name: '恒力科技', slogan: '科技驱动，创新引领', style: '技术创新派', colorClass: 'emerald' },
    { id: 'D', name: '稳固重工', slogan: '厚积薄发，稳如泰山', style: '稳健生产派', colorClass: 'purple' },
    { id: 'E', name: '赤铁锻造', slogan: '百炼成钢，锻造未来', style: '重工锻造派', colorClass: 'rose' },
    { id: 'F', name: '碧海船工', slogan: '乘风破浪，制造远航', style: '海工装备派', colorClass: 'cyan' },
    { id: 'G', name: '青松电气', slogan: '绿色电力，智慧制造', style: '新能源制造派', colorClass: 'lime' },
    { id: 'H', name: '旭辉机械', slogan: '日新月异，精密制造', style: '精密机械派', colorClass: 'orange' },
  ],

  actionNarrative: {
    ATK: {
      title: '低价抢单',
      desc: '大幅降价薄利多销，短期内快速抢占订单。独家低价时效果最好。',
      risk: '多家同时低价效果互相摊薄，连续低价客户会产生疲劳。',
    },
    QUA: {
      title: '技术升级',
      desc: '投入¥8万做技术研发，提升产品质量，下季度技术成果落地后实力大增。',
      risk: '本季花钱多、见效慢，需要等下一季技术成果出来才能看到全部回报。',
    },
    MKT: {
      title: '品牌推广',
      desc: '投入¥10万参加行业展会、做品牌宣传，提升在行业里的口碑。',
      risk: '多家同时推广效果互相摊薄；停止推广后口碑会自然衰减。',
    },
    HOLD: {
      title: '稳定生产',
      desc: '不折腾、正常报价出货，利润最高。适合对手都不动的时候。',
      risk: '对手低价抢单或推广时你会被压制，连续稳产太久利润率会下降。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '⚔',
      cost: '大幅降价抢单，薄利多销扩大订单量',
    },
    QUA: {
      emoji: '🔧',
      cost: '投入¥8万技术研发，下季推出更强的产品',
    },
    MKT: {
      emoji: '📣',
      cost: '投入¥10万行业展会推广，提升品牌口碑',
    },
    HOLD: {
      emoji: '🛡',
      cost: '正常报价出货，利润最高但不主动抢单',
    },
  },

  finalShiftNarrative: {
    NONE: { title: '不附加', desc: '最后一季正常比赛，不做额外操作' },
    FINAL_PUSH: { title: '全力冲产', desc: '所有产线满负荷运转、加班加点，不惜代价抢订单（产值打八折）' },
    QUALITY_CONVERT: { title: '技术总爆发', desc: '一次性投产所有研发成果，用技术优势碾压对手' },
    DEFENSIVE_LOCK: { title: '长约锁客', desc: '和老客户签长期合约，锁住订单不被对手低价抢走' },
    BRAND_MONETIZE: { title: '行业大奖', desc: '口碑够好时，获评行业大奖提升品牌溢价' },
  },

  terms: {
    unit: '台',
    customers: '订单池',
    marketShare: '产能份额',
    profit: '产值',
    cumulativeProfit: '累计产值',
    brandHeat: '行业口碑',
    qualityScore: '技术实力',
    newProductReserve: '技术储备',
    freshness: '客户耐心',
    competitiveness: '竞争力',

    brandHeatUnlock: '终局可溢价',
    brandHeatBuilding: '口碑有加成',
    brandHeatLow: '继续推广积累',
    qualityHigh: '技术积累中',
    qualityNormal: '基准水平',
    reserveHas: '终局可一键爆发',
    reserveNone: '研发可积累',
    freshNormal: '低价抢单满效',
    freshWarn: '再低价会受罚',
    freshDanger: '低价效果大减',
    holdPenalty: '产值率已下降',
    momentum: '额外订单加成',
  },

  styleMap: {
    ATK: '低价进攻型',
    QUA: '技术研发型',
    MKT: '品牌推广型',
    HOLD: '稳定生产型',
  },

  narration: {
    atkMultiple: '同时低价抢单，价格竞争激烈，双方均受客户疲劳影响。',
    atkSingle: '独家低价抢单，抢占订单优势。',
    quaDesc: '投入技术升级，蓄势下回合兑现。',
    mktDesc: '加大品牌推广，行业口碑持续提升。',
  },

  events: [
    {
      type: 'CUSTOMER_INFLUX',
      signalRound: 2,
      effectRound: 3,
      signalText: '【市场情报】有消息称下游厂商正在集中扩产，订单池可能大幅扩容。',
      effectText: '【事件生效】订单涌入！总订单量扩大 30%。',
    },
    {
      type: 'PRICE_WAR_EXTERNAL',
      signalRound: 3,
      effectRound: 4,
      signalText: '【市场情报】行业协会正在制定更严格的产品质量标准，技术实力可能变得更重要。',
      effectText: '【事件生效】新标准实施！价格敏感度下降，技术实力权重提升。',
    },
  ],

  playerNames: {
    A: '精工制造',
    B: '迅达工业',
    C: '恒力科技',
    D: '稳固重工',
    E: '赤铁锻造',
    F: '碧海船工',
    G: '青松电气',
    H: '旭辉机械',
  },

  // 工厂：重资产 · 研发便宜但慢热 · HOLD稳健有优势 · 品牌难建但持久
  mechanicsDescription: '🏭 重工业模式 · 研发成本低但技术信号弱 · 稳健运营利润率加成高 · 惯性极大难翻盘',
  configOverrides: {
    qualityInvestCost: 50000,       // 工厂研发成本极低（设备摊销）
    qualitySignalBonus: 2.0,        // 但技术信号弱（B2B不像C端那么敏感）
    qualityBurstBase: 6.0,          // 最终量产爆发更强
    qualityBurstPerCharge: 3.0,     // 技术积累回报翻倍
    holdPressurePenalty: 0,         // P0-3: HOLD无惩罚
    holdMarginBoostPerRound: 0.03,  // 工厂稳健运营利润率加成更高
    holdDefenseBarrier: 0.5,        // 工厂防御壁垒中等
    marketingCost: 120000,          // 品牌推广更贵（B2B获客成本高）
    brandHeatGainFromMkt: 10,       // 品牌热度增长更慢（P0-2削弱）
    brandHeatCap: 60,               // 品牌天花板低（B2B品牌效应弱）
    mktConsecutiveFatigue: 0.5,     // B2B连续推广效率更差
    inertiaOldWeight: 0.65,         // 惯性极高→翻盘困难
    inertiaInstantWeight: 0.30,     // 即时竞争力权重低
    inertiaMomentumWeight: 0.05,    // 动量几乎无用
  },

  generateIntel,
}
