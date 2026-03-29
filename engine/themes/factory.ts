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
    const trues = pick(slot.trueCards, 2).map((c) => ({
      ...c,
      isTrue: true as const,
      impliedAction: slot.action,
    }))
    const falses = pick(slot.falseCards, 2).map((c) => ({
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
        { source: SRC.ANALYST, text: '行业分析师指出，首季订单分配主要看报价竞争力，¥12/台的低价策略可获得最大单量优势。' },
        { source: SRC.SURVEY, text: '客户采购调研显示，本季度各厂商产品差异不大，采购方最看重的就是价格，低价抢单效果最佳。' },
        { source: SRC.INSIDER, text: '供应链消息称原材料价格本季稳定，低价报价的利润虽薄但可控，适合激进抢单。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '据悉多家竞争对手均准备首季低价抢单，价格战可能导致集体亏损，不建议跟进。' },
        { source: SRC.REPORT, text: '行业报告称低价抢单会严重损害品牌形象，首季低价的厂商后续3个季度口碑恢复极慢。' },
        { source: SRC.ANALYST, text: '分析师警告称首季低价策略在制造业已过时，客户更看重交付能力和产品质量。' },
        { source: SRC.POLICY, text: '有消息称行业协会将在首季出台反低价倾销政策，低价报价可能面临处罚风险。' },
      ],
    },
    {
      action: 'QUA',
      trueCards: [
        { source: SRC.REPORT, text: '技术升级投入¥8万，虽然本季成本偏高，但能获得+3即时竞争力和下季+10技术实力的长线回报。' },
        { source: SRC.INSIDER, text: '内部评估显示，首季投入技术升级可在第二季形成明显技术壁垒，良品率提升带来的成本节约可观。' },
        { source: SRC.ANALYST, text: '分析师认为提前布局技术升级是稳健策略，后期行业标准提升时技术领先者将获得巨大优势。' },
        { source: SRC.SURVEY, text: '下游厂商反馈，愿意为通过ISO高级认证的供应商支付5%-8%溢价，技术投入中长期回报确定。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '竞品情报显示其他厂商均在首季大力投入技术升级，技术赛道已过度拥挤，建议另辟蹊径。' },
        { source: SRC.REPORT, text: '行业报告指出制造业技术升级周期长达3-4个季度才能见效，¥8万的投入首季几乎没有回报。' },
        { source: SRC.ANALYST, text: '分析师称当前自动化改造成本正在快速下降，建议等到第3季再投入技术升级，性价比更高。' },
        { source: SRC.INSIDER, text: '供应链消息称关键设备供应紧张，首季进行技术升级可能面临设备交付延迟，影响正常生产。' },
      ],
    },
    {
      action: 'MKT',
      trueCards: [
        { source: SRC.REPORT, text: '品牌推广投入¥10万可获得+20行业口碑，虽然短期ROI不高，但口碑累积到门槛后可实现溢价变现。' },
        { source: SRC.SURVEY, text: '客户调研表明，在产品同质化严重的制造业，品牌认知度对长期订单稳定性有决定性影响。' },
        { source: SRC.ANALYST, text: '行业展会季即将到来，首季投入品牌推广能在展会期间获得更多曝光，为后续季度订单打基础。' },
        { source: SRC.INSIDER, text: '内部市场部评估，本季参加3场行业展会+线上推广的组合方案性价比最高，建议加大品牌投入。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '竞品情报显示头部厂商已垄断行业展会资源，中小厂商品牌推广效果将大打折扣。' },
        { source: SRC.REPORT, text: '行业报告指出制造业客户决策链长，品牌推广对短期订单几乎没有影响，首季不建议投入。' },
        { source: SRC.ANALYST, text: '分析师称当前行业口碑主要靠产品说话，花钱做品牌推广不如直接降价抢单来得实在。' },
        { source: SRC.POLICY, text: '有传闻称行业广告投放监管趋严，品牌推广费用可能无法正常支出，建议观望。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '稳定生产以¥15/台正常报价，40%利润率在首季提供了健康的现金流，为后续操作保留资金弹性。' },
        { source: SRC.ANALYST, text: '分析师建议首季保持稳定生产观察市场动态，避免盲目投入，等信息更充分后再做决策。' },
        { source: SRC.INSIDER, text: '产能利用率评估显示，首季维持正常生产节奏可优化供应链效率，降低库存成本。' },
        { source: SRC.SURVEY, text: '客户满意度调查表明，稳定的交付周期和品质一致性是大客户选择供应商的首要标准。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '竞品情报称多数厂商首季都会选择稳定生产，市场格局不会有大变化，稳产是最安全的选择。' },
        { source: SRC.REPORT, text: '行业报告指出连续稳定生产的厂商往往在行业洗牌中存活率最高，激进策略风险极大。' },
        { source: SRC.ANALYST, text: '分析师称首季稳定生产不会有任何惩罚，可以无限期保持稳产而不影响利润率。' },
        { source: SRC.INSIDER, text: '内部消息称其他三家厂商全部准备低价抢单，此时稳产反而能坐收渔翁之利。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手已发现需求扩张信号，全部准备低价抢单，价格战将异常激烈，不建议跟进。' },
        { source: SRC.REPORT, text: '行业报告警告称需求扩张可能是假信号，实际订单量不会有明显变化，低价抢单将白白损失利润。' },
        { source: SRC.ANALYST, text: '分析师认为在需求扩张预期下，客户更看重供应能力而非价格，低价策略已经失效。' },
        { source: SRC.POLICY, text: '监管部门正在调查制造业低价竞争行为，本季低价报价可能触发反倾销审查。' },
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
        { source: SRC.RIVAL, text: '竞品情报显示对手已完成技术升级，本季再投入已经落后，不如转向其他策略。' },
        { source: SRC.REPORT, text: '行业分析称技术升级在需求扩张期效果打折，客户更看重现有产能而非未来技术。' },
        { source: SRC.ANALYST, text: '分析师警告技术升级会占用大量资金，在需求扩张前夕应保留现金流应对不确定性。' },
        { source: SRC.INSIDER, text: '设备供应商透露核心零部件涨价30%，本季技术升级成本将远超预期。' },
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
        { source: SRC.RIVAL, text: '竞品情报称头部厂商品牌预算加倍，中小厂商品牌推广将被淹没，不建议投入。' },
        { source: SRC.REPORT, text: '行业报告指出需求扩张期客户只看产能和价格，品牌知名度对订单分配影响微乎其微。' },
        { source: SRC.ANALYST, text: '分析师称品牌推广在制造业B2B领域效果有限，不如把钱花在降价或技术升级上。' },
        { source: SRC.POLICY, text: '行业展会因政策原因可能延期，本季品牌推广的线下渠道将受到严重影响。' },
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
        { source: SRC.RIVAL, text: '竞品情报称所有对手都在观望稳产，本季市场竞争强度低，稳产是绝对安全的选择。' },
        { source: SRC.REPORT, text: '行业报告指出需求扩张前稳产的厂商总能在爆发期自动获得更多订单，无需主动出击。' },
        { source: SRC.ANALYST, text: '分析师称连续稳产不会导致任何负面效果，利润率始终保持40%不变。' },
        { source: SRC.INSIDER, text: '内部消息称下季需求扩张幅度可能远超30%，现在任何投入都不如存钱等风口。' },
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
        { source: SRC.SURVEY, text: '客户调研显示新增订单以中小客户为主，他们对价格极度敏感，¥12/台报价吸引力巨大。' },
        { source: SRC.INSIDER, text: '销售部反馈，多个大客户正在比价阶段，低价报价可一举拿下几个关键长期合同。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '竞品情报称三家对手全部准备低价抢单，价格战将导致集体亏损，独善其身才是上策。' },
        { source: SRC.REPORT, text: '行业报告警告订单涌入期低价竞争最为惨烈，多家低价时客户疲劳效应会让所有人亏损。' },
        { source: SRC.ANALYST, text: '分析师认为订单激增时客户更看重产能保障而非价格，低价策略在本季效果反而不如平时。' },
        { source: SRC.POLICY, text: '行业协会正在约谈低价竞标企业，本季低价报价可能面临罚款和行业通报批评。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手技术实力已远超行业平均，继续投入技术升级已无法追赶，不如放弃。' },
        { source: SRC.REPORT, text: '行业报告指出订单爆发期应全力生产抢订单，技术升级占用的资金和产能会导致错失黄金窗口。' },
        { source: SRC.ANALYST, text: '分析师称当前技术投入的边际收益已经递减，同样的资金用于降价可获得更多订单。' },
        { source: SRC.INSIDER, text: '技术团队反馈，产线正在满负荷运转，此时进行技术改造会严重影响交付进度。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手已占据主要推广渠道，本季品牌投入将被对手广告淹没，效果极差。' },
        { source: SRC.REPORT, text: '行业报告指出订单爆发期客户决策速度加快，根本没时间关注品牌宣传，推广费用打水漂。' },
        { source: SRC.ANALYST, text: '分析师称订单已经涌入市场，此时做品牌推广为时已晚，不如直接降价抢单更实际。' },
        { source: SRC.POLICY, text: '有传闻行业推广费用即将被纳入成本审计范围，大额品牌投入可能影响财务报表。' },
      ],
    },
    {
      action: 'HOLD',
      trueCards: [
        { source: SRC.REPORT, text: '订单涌入期稳定生产可确保交付质量，40%利润率在13万台大盘下也能获得可观利润。' },
        { source: SRC.ANALYST, text: '分析师建议在订单高峰期保持正常报价和产能，避免过度扩张带来的质量和交付风险。' },
        { source: SRC.INSIDER, text: '生产部门评估显示，稳定生产可确保100%准时交付，大客户对交付可靠性的重视度在上升。' },
        { source: SRC.SURVEY, text: '行业调查显示，订单爆发期盲目扩张的厂商70%会出现质量事故，稳产是风险最低的选择。' },
      ],
      falseCards: [
        { source: SRC.RIVAL, text: '竞品情报称其他厂商都在疯狂抢单，稳产将导致市场份额快速流失，不可能靠守赢得比赛。' },
        { source: SRC.REPORT, text: '行业报告称订单激增期是千载难逢的机会，稳产等于放弃增长，会被市场淘汰。' },
        { source: SRC.ANALYST, text: '分析师称连续3季稳产的利润率不会有任何变化，稳产永远是最稳妥的策略。' },
        { source: SRC.INSIDER, text: '内部消息称客户完全不关心你是否主动出击，稳定供货就能获得全部订单忠诚度。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手已全部放弃低价策略转向技术竞争，此时低价抢单可轻松独占价格敏感客户。' },
        { source: SRC.REPORT, text: '行业报告指出新标准下低价策略完全失效，客户100%看质量不看价格，低价就是浪费。' },
        { source: SRC.ANALYST, text: '分析师称质量标准升级后低价报价将被视为低质量信号，反而会失去客户信任。' },
        { source: SRC.POLICY, text: '监管部门将对低于成本报价的企业进行处罚，¥12/台已低于监管红线。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手技术实力已断层领先，追加投入也追不上，不如接受差距专注价格竞争。' },
        { source: SRC.REPORT, text: '行业报告指出新标准只是过渡性政策，下季很可能回调，技术投入的长期价值存疑。' },
        { source: SRC.ANALYST, text: '分析师称新标准的技术权重被市场高估，实际影响远没有宣传的那么大。' },
        { source: SRC.INSIDER, text: '技术团队反馈设备折旧加速，继续投入技术升级的净收益已经为负。' },
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
        { source: SRC.RIVAL, text: '竞品情报称行业媒体已被对手广告垄断，品牌推广渠道受限，投入产出比极低。' },
        { source: SRC.REPORT, text: '行业报告指出新标准下客户只看硬指标（良品率、认证），品牌口碑对采购决策影响归零。' },
        { source: SRC.ANALYST, text: '分析师称倒数第二季做品牌推广已无意义，口碑积累需要至少3个季度才能见效。' },
        { source: SRC.POLICY, text: '有传闻行业协会将限制企业对外宣称通过新标准认证，品牌推广内容将受到严格审查。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手全部在调整策略应对新标准，稳产意味着不作为，份额将加速流失。' },
        { source: SRC.REPORT, text: '行业报告称新标准是最后的洗牌窗口，选择稳产就是选择出局，必须主动出击。' },
        { source: SRC.ANALYST, text: '分析师称第四季稳产不会有任何负面效果，利润率和市场份额都能保持不变。' },
        { source: SRC.INSIDER, text: '内部消息称新标准对稳产厂商有额外政策补贴，不做任何改变反而能获得最大利益。' },
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
        { source: SRC.RIVAL, text: '竞品情报称所有对手最后一季都会低价冲量，价格战将导致全员亏损，不如稳产保利润。' },
        { source: SRC.REPORT, text: '行业报告称终局低价无法改变累计排名，利润率的损失会让你最终总产值下降。' },
        { source: SRC.ANALYST, text: '分析师称最后一季客户已完成年度采购计划，低价报价不会带来额外订单。' },
        { source: SRC.POLICY, text: '年底监管部门对低价竞争查得更严，最后一季低价报价将面临额外罚款。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手技术储备远超你，即使选择"技术总爆发"也打不过，不如放弃技术路线。' },
        { source: SRC.REPORT, text: '行业报告指出最后一季技术投入毫无意义，下季没有了无法兑现回报。' },
        { source: SRC.ANALYST, text: '分析师称"技术总爆发"的实际效果被严重高估，不如选择其他终盘转向策略。' },
        { source: SRC.INSIDER, text: '内部消息称技术升级在最后一季的即时竞争力加成被取消，只有储备效果但无法兑现。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手口碑分数远高于你，你做品牌推广也达不到变现门槛，纯属浪费。' },
        { source: SRC.REPORT, text: '行业报告指出最后一季品牌推广对订单分配零影响，钱完全打水漂。' },
        { source: SRC.ANALYST, text: '分析师称"口碑溢价"的实际收益微乎其微，远不如低价抢单的直接订单量增长。' },
        { source: SRC.INSIDER, text: '市场部私下承认，品牌推广的实际效果被严重夸大，大部分预算都被中间商吃了。' },
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
        { source: SRC.RIVAL, text: '竞品情报称对手全部准备最后一季冲刺，稳产将导致排名大幅下滑，必须主动出击。' },
        { source: SRC.REPORT, text: '行业报告称最后一季是逆转排名的唯一机会，稳产意味着放弃翻盘可能，必须孤注一掷。' },
        { source: SRC.ANALYST, text: '分析师称"长约锁客"终盘转向的防御效果被高估，实际上对手低价照样能抢走你的客户。' },
        { source: SRC.INSIDER, text: '内部消息称最后一季稳产可自动获得额外利润加成，系统会奖励保守策略。' },
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
  ],

  actionNarrative: {
    ATK: {
      title: '低价抢单',
      desc: '以¥12/台报价抢单，利润率仅32%但订单量大增。独家低价时竞争力最强。',
      risk: '多家同时低价时加成互相摊薄，且客户会产生低价疲劳。',
    },
    QUA: {
      title: '技术升级',
      desc: '投入¥8万做技术升级，即时+3竞争力，下季技术实力+10。',
      risk: '本季成本高，收益延迟兑现。',
    },
    MKT: {
      title: '品牌推广',
      desc: '花¥10万做行业推广，提升口碑+20。',
      risk: '口碑需累积到门槛才能变现，短期ROI偏低。',
    },
    HOLD: {
      title: '稳定生产',
      desc: '维持正常生产，¥15/台正常报价，利润率40%。',
      risk: '连续稳产≥2季利润率降至36%，错失扩张机会。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '⚔',
      cost: `报价降至¥${CONFIG.discountPrice}/台（正常¥${CONFIG.normalPrice}）· 利润率仅${Math.round(CONFIG.discountMargin * 100)}%`,
    },
    QUA: {
      emoji: '🔧',
      cost: `投入¥${(CONFIG.qualityInvestCost / 10000).toFixed(0)}万升级 · 即时+${CONFIG.qualitySignalBonus}竞争力 · 下季技术+10`,
    },
    MKT: {
      emoji: '📣',
      cost: `投入¥${(CONFIG.marketingCost / 10000).toFixed(0)}万推广 · 行业口碑+${CONFIG.brandHeatGainFromMkt}`,
    },
    HOLD: {
      emoji: '🛡',
      cost: `报价¥${CONFIG.normalPrice}/台 · 利润率${Math.round(CONFIG.normalMargin * 100)}%（连续≥2季降至${Math.round(CONFIG.holdReducedMargin * 100)}%）`,
    },
  },

  finalShiftNarrative: {
    NONE: { title: '不附加', desc: '按正常流程结算' },
    FINAL_PUSH: { title: '全力冲产', desc: '竞争力+4，但产值只拿80%' },
    QUALITY_CONVERT: { title: '技术总爆发', desc: '释放全部技术储备，一次性兑现' },
    DEFENSIVE_LOCK: { title: '长约锁客', desc: '对手低价对你的冲击减半' },
    BRAND_MONETIZE: { title: '口碑溢价', desc: '行业口碑变现，营业额+3%' },
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
  },

  generateIntel,
}
