// =====================
// 弈战 - 主题配置类型
// =====================
// 引擎（resolveRound, CONFIG）完全不变，主题只改叙事文本。

import type { PlayerId, BaseAction, FinalShift, GameEvent } from '../types'

// ── 情报系统类型 ──
export type IntelSource =
  | '行业报告'
  | '竞品情报'
  | '消费者调研'
  | '内部消息'
  | '分析师预测'
  | '监管动态'

export type IntelCard = {
  source: IntelSource
  text: string
  isTrue: boolean
  impliedAction: BaseAction
  tag?: string
}

export type RoundIntel = {
  round: number
  headline: string
  cards: IntelCard[]
}

export type CompanyProfile = {
  id: PlayerId
  name: string
  slogan: string
  style: string
  colorClass: string
}

// ── 主题配置 ──
export interface ThemeConfig {
  id: string
  title: string           // e.g., "茶饮争霸"
  subtitle: string        // e.g., "2024年·茶饮赛道四强争霸"
  description: string     // 选择页描述
  icon: string            // emoji
  accentClass: string     // TailwindCSS accent class (e.g., 'amber', 'sky')

  // 场景设定
  scenario: {
    title: string
    background: string
    marketName: string
  }

  // 四家公司
  companies: CompanyProfile[]

  // 动作叙事
  actionNarrative: Record<BaseAction, {
    title: string
    desc: string
    risk: string
  }>

  // 动作卡片显示（PlayerCard用）
  actionCards: Record<BaseAction, {
    emoji: string
    cost: string         // 引用 CONFIG 数值的描述文本
  }>

  // 终盘转向叙事
  finalShiftNarrative: Record<FinalShift, {
    title: string
    desc: string
  }>

  // 领域术语（UI 标签）
  terms: {
    unit: string              // 杯 / 手 / 台 / 名
    customers: string         // 客流 / 资金池 / 订单量 / 生源
    marketShare: string       // 市场份额 / 持仓占比 / 产能份额 / 生源占比
    profit: string            // 利润 / 收益 / 产值 / 综合积分
    cumulativeProfit: string  // 累计利润 / 累计收益 / 累计产值 / 累计积分
    brandHeat: string         // 品牌热度 / 市场关注 / 口碑 / 学校声望
    qualityScore: string      // 产品实力 / 研究深度 / 产品质量 / 教学质量
    newProductReserve: string // 新品储备 / 研究储备 / 技术储备 / 教研储备
    freshness: string         // 顾客新鲜感 / 投资者信心 / 客户耐心 / 家长期望
    competitiveness: string   // 竞争力

    // 状态指标描述
    brandHeatUnlock: string
    brandHeatBuilding: string
    brandHeatLow: string
    qualityHigh: string
    qualityNormal: string
    reserveHas: string
    reserveNone: string
    freshNormal: string
    freshWarn: string
    freshDanger: string
    holdPenalty: string
    momentum: string
  }

  // 叙事风格标签（resolveGame 用）
  styleMap: Record<BaseAction, string>

  // 解说模板（resolveGame 用）
  narration: {
    atkMultiple: string   // "{names} 同时搞促销..."
    atkSingle: string     // "{name} 独家搞促销..."
    quaDesc: string       // "{names} 投入研发新品..."
    mktDesc: string       // "{names} 加大推广投入..."
  }

  // 事件队列
  events: GameEvent[]

  // 情报生成器（每局调用一次）
  generateIntel: () => RoundIntel[]

  // 初始玩家名称（覆盖 constants.ts 的默认名称）
  playerNames: Partial<Record<PlayerId, string>>

  // 主题独有机制规则（覆盖 CONFIG 默认值）
  configOverrides?: Partial<{
    baseCompetitiveness: number
    atkBaseBonus: number
    mktBaseBonus: number
    qualitySignalBonus: number
    discountPrice: number
    normalPrice: number
    discountMargin: number
    normalMargin: number
    holdReducedMargin: number
    qualityInvestCost: number
    marketingCost: number
    inertiaOldWeight: number
    inertiaInstantWeight: number
    inertiaMomentumWeight: number
    holdPressurePenalty: number
    holdMarginBoostPerRound: number
    holdDefenseBarrier: number
    atkCooldownFactor: number
    atkSoloInflux: number
    atkFatiguePenaltyFactor: number
    mktConsecutiveFatigue: number
    momentumGainFromMkt: number
    momentumCap: number
    momentumDecayEachRound: number
    momentumDecayOnHold: number
    qualityBurstBase: number
    qualityBurstPerCharge: number
    finalPushBonus: number
    finalPushProfitMultiplier: number
    brandMonetizeRevenueBonus: number
    brandHeatGainFromMkt: number
    brandHeatDecayOther: number
    brandHeatCap: number
    brandHeatThresholdForMonetize: number
    minCompetitiveness: number
    roundStakesMultiplier: readonly number[]
  }>

  // 主题特色机制描述（显示在UI上让玩家知道规则差异）
  mechanicsDescription?: string
}
