// =====================
// 弈战 v2.4 - 类型定义
// =====================

export type PlayerId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

export const ALL_PLAYER_IDS: PlayerId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export type BaseAction = 'ATK' | 'QUA' | 'MKT' | 'HOLD'

export type FinalShift =
  | 'NONE'
  | 'FINAL_PUSH'
  | 'QUALITY_CONVERT'
  | 'DEFENSIVE_LOCK'
  | 'BRAND_MONETIZE'

export type GameEventType =
  | 'NONE'
  | 'CUSTOMER_INFLUX'
  | 'PRICE_WAR_EXTERNAL'
  | 'QUALITY_DEMAND_RISE'
  | 'COST_SPIKE'

export type GameEvent = {
  type: GameEventType
  effectRound: number   // 生效回合
  signalRound: number   // 信号释放回合
  signalText: string    // 显示给玩家的信号文案
  effectText: string    // 生效时的说明
}

export type GlobalState = {
  roundNumber: number
  maxRounds: number
  totalCustomers: number
  priceSensitivity: number
  qualityWeight: number
  eventQueue: GameEvent[]
}

export type PlayerState = {
  id: PlayerId
  name: string
  cash: number
  marketShare: number
  qualityScore: number
  brandHeat: number
  cumulativeProfit: number
  marketMomentum: number
  fatigueIndex: number
  qualityCharge: number
  lastAction: BaseAction | null
  consecutiveHoldCount: number
}

// ── 暗牌（Wild Card）系统 ── P2 重设计：通用战术牌
export type WildCardType =
  | 'DOUBLE_DOWN'    // 孤注一掷：本轮收入 ×1.3
  | 'COST_CUT'       // 成本削减：本轮行动成本归零
  | 'SHIELD'         // 市场护盾：本轮份额不会下降
  | 'MOMENTUM_SURGE' // 动量涌潮：立即 +2 动量
  | 'QUALITY_BOOST'  // 品质突破：立即 +5 品质
  | 'SCOUT'          // 侦察先机：本轮竞争力 +4

export type WildCard = {
  type: WildCardType
  name: string
  description: string
  emoji: string
  used: boolean
}

export const WILD_CARD_POOL: Omit<WildCard, 'used'>[] = [
  { type: 'DOUBLE_DOWN', name: '孤注一掷', description: '本轮收入 ×1.3', emoji: '🎲' },
  { type: 'COST_CUT', name: '成本削减', description: '本轮行动成本归零', emoji: '✂️' },
  { type: 'SHIELD', name: '市场护盾', description: '本轮份额不会下降', emoji: '🛡️' },
  { type: 'MOMENTUM_SURGE', name: '动量涌潮', description: '立即获得 +2 市场动量', emoji: '🌊' },
  { type: 'QUALITY_BOOST', name: '品质突破', description: '立即 +5 品质分', emoji: '⚡' },
  { type: 'SCOUT', name: '侦察先机', description: '本轮竞争力 +4', emoji: '🔭' },
]

export type RoundInput = {
  playerId: PlayerId
  action: BaseAction
  finalShift: FinalShift
  wildCard?: WildCardType | null
}

// 每回合每玩家中间计算量
export type PlayerRoundCalc = {
  id: PlayerId
  action: BaseAction
  finalShift: FinalShift

  // 状态快照（结算前）
  oldShare: number
  qualityScoreBefore: number
  qualityDeltaFromLastRound: number
  qualityScoreAfter: number
  qualityChargeBefore: number
  qualityChargeAfter: number
  brandHeatBefore: number
  brandHeatAfter: number
  marketMomentumBefore: number
  marketMomentumAfter: number
  fatigueBefore: number
  fatigueAfter: number
  consecutiveHoldBefore: number
  consecutiveHoldAfter: number

  // 冲突统计
  atkCount: number
  mktCount: number
  aggressionPressure: number

  // 竞争力组成
  actionBonus: number
  qualityBonus: number
  finalShiftBonus: number
  holdPenalty: number
  competitiveness: number

  // 份额
  instantShare: number
  momentumShare: number
  newShare: number

  // 利润
  unitPrice: number
  margin: number
  revenue: number
  grossProfit: number
  revenueBonus: number
  actionCost: number
  netProfit: number
  cashAfter: number
  cumulativeProfitAfter: number
}

export type RoundAuditLog = {
  round: number
  global: {
    totalCustomers: number
    priceSensitivity: number
    qualityWeight: number
    eventApplied: string | null
    stakesMultiplier: number
  }
  players: PlayerRoundCalc[]
}

// ── 市场风向 ──
export type MarketForecast = {
  round: number
  signal: BaseAction        // 本轮推荐行动
  isTrue: boolean           // 50% 概率真/假（玩家不知道）
  headline: string          // 主题化叙事标题
  detail: string            // 详细分析说明
}

// ── 立誓 ──
export type Pledge = {
  playerId: PlayerId
  pledgedAction: BaseAction
}

export type GamePhase = 'WAITING' | 'SUBMITTING' | 'RESOLVING' | 'ROUND_RESULT' | 'GAME_OVER'

export type GameState = {
  phase: GamePhase
  global: GlobalState
  players: PlayerState[]
  pendingInputs: Map<PlayerId, RoundInput>
  auditLogs: RoundAuditLog[]
  roundNarrations: string[]   // 每回合一句解说
  gameNarration: string       // 局后总结
}
