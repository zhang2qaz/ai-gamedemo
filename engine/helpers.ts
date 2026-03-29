// =====================
// 弈战 v2.4 - 辅助函数
// =====================

import type { PlayerState, BaseAction, FinalShift } from './types'
import { CONFIG } from './constants'

/**
 * 归一化：保证所有玩家 marketShare 之和严格为 1
 */
export function normalizeShares(shares: Record<string, number>): Record<string, number> {
  const total = Object.values(shares).reduce((s, v) => s + v, 0)
  if (total === 0) {
    // 均分
    const ids = Object.keys(shares)
    return Object.fromEntries(ids.map(id => [id, 1 / ids.length]))
  }
  return Object.fromEntries(Object.entries(shares).map(([id, v]) => [id, v / total]))
}

/**
 * 计算 HOLD 惩罚
 * holdPenalty = holdPressurePenalty * aggressionPressure
 * 若使用 DEFENSIVE_LOCK，惩罚减半
 */
export function calcHoldPenalty(aggressionPressure: number, defensiveLock: boolean): number {
  const raw = CONFIG.holdPressurePenalty * aggressionPressure
  return defensiveLock ? raw * 0.5 : raw
}

/**
 * 计算品质基础加成
 * qualityBonus = (qualityScore - 70) * qualityWeight * 0.5
 */
export function calcQualityBonus(qualityScore: number, qualityWeight: number): number {
  return (qualityScore - 70) * qualityWeight * 0.8  // 原 0.5 → 品质竞争力加成增强
}

/**
 * 计算 ATK 动作加成
 */
export function calcAtkBonus(
  priceSensitivity: number,
  atkCount: number,
  fatigueIndex: number,
  lastAction: BaseAction | null
): number {
  const raw = CONFIG.atkBaseBonus * (priceSensitivity / 0.6) / Math.max(1, atkCount)
  const fatiguePenalty = lastAction === 'ATK' ? CONFIG.atkFatiguePenaltyFactor * fatigueIndex : 0
  return raw - fatiguePenalty
}

/**
 * 计算 MKT 动作加成
 */
export function calcMktBonus(mktCount: number, brandHeat: number): number {
  const mktActionBonus = CONFIG.mktBaseBonus / Math.max(1, mktCount)
  const brandBonus = Math.max(0, brandHeat - 50) * 0.1
  return mktActionBonus + brandBonus
}

/**
 * 检查 QUALITY_CONVERT 是否满足条件
 */
export function canQualityConvert(player: PlayerState): boolean {
  return player.qualityCharge >= 1
}

/**
 * 检查 DEFENSIVE_LOCK 是否满足条件
 */
export function canDefensiveLock(action: BaseAction): boolean {
  return action === 'HOLD'
}

/**
 * 检查 BRAND_MONETIZE 是否满足条件
 */
export function canBrandMonetize(player: PlayerState): boolean {
  return player.brandHeat >= CONFIG.brandHeatThresholdForMonetize
}

/**
 * 获取利润率
 */
export function getMargin(
  action: BaseAction,
  finalShift: FinalShift,
  consecutiveHoldCount: number
): number {
  if (action === 'ATK') {
    return CONFIG.discountMargin
  }
  // 连续 HOLD >= 2 且未使用 DEFENSIVE_LOCK
  if (action === 'HOLD' && consecutiveHoldCount >= 2 && finalShift !== 'DEFENSIVE_LOCK') {
    return CONFIG.holdReducedMargin
  }
  return CONFIG.normalMargin
}

/**
 * 获取单价
 */
export function getUnitPrice(action: BaseAction): number {
  return action === 'ATK' ? CONFIG.discountPrice : CONFIG.normalPrice
}

/**
 * 获取行动成本
 */
export function getActionCost(action: BaseAction): number {
  if (action === 'QUA') return CONFIG.qualityInvestCost
  if (action === 'MKT') return CONFIG.marketingCost
  return 0
}
