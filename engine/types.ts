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

// ── 暗牌（Wild Card）系统 ──
export type WildCardType =
  | 'INSIDER'       // 市场内幕：+5 竞争力
  | 'SHADOW_PRICE'  // 价格暗战：ATK 无视疲劳
  | 'VIRAL_BUZZ'    // 口碑爆发：MKT 品牌热度 ×2
  | 'TECH_LEAP'     // 技术飞跃：QUA 立即+5品质（不延迟）
  | 'IRON_WALL'     // 铁壁防御：HOLD 无惩罚
  | 'STEAL_SHARE'   // 偷天换日：偷取领先者 5% 份额

export type WildCard = {
  type: WildCardType
  name: string
  description: string
  emoji: string
  used: boolean
}

export const WILD_CARD_POOL: Omit<WildCard, 'used'>[] = [
  { type: 'INSIDER', name: '市场内幕', description: '本回合竞争力 +5', emoji: '🕵️' },
  { type: 'SHADOW_PRICE', name: '价格暗战', description: 'ATK 无视疲劳惩罚', emoji: '🗡️' },
  { type: 'VIRAL_BUZZ', name: '口碑爆发', description: 'MKT 品牌热度增长翻倍', emoji: '📣' },
  { type: 'TECH_LEAP', name: '技术飞跃', description: 'QUA 本回合立即生效+5品质', emoji: '🔬' },
  { type: 'IRON_WALL', name: '铁壁防御', description: 'HOLD 无任何惩罚', emoji: '🛡️' },
  { type: 'STEAL_SHARE', name: '偷天换日', description: '偷取领先者 5% 份额', emoji: '🃏' },
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
