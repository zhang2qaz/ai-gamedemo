// =====================
// 弈战 v2.4 - 辅助函数
// =====================

import type { PlayerState, BaseAction, FinalShift } from './types'
import { CONFIG } from './constants'

type CfgLike = typeof CONFIG

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
export function calcHoldPenalty(aggressionPressure: number, defensiveLock: boolean, cfg: CfgLike = CONFIG): number {
  const raw = cfg.holdPressurePenalty * aggressionPressure
  return defensiveLock ? raw * 0.5 : raw
}

/**
 * 计算品质基础加成
 * qualityBonus = (qualityScore - 70) * qualityWeight * 0.8
 */
export function calcQualityBonus(qualityScore: number, qualityWeight: number): number {
  return (qualityScore - 70) * qualityWeight * 0.8
}

/**
 * 计算 ATK 动作加成
 */
export function calcAtkBonus(
  priceSensitivity: number,
  atkCount: number,
  fatigueIndex: number,
  lastAction: BaseAction | null,
  cfg: CfgLike = CONFIG
): number {
  const raw = cfg.atkBaseBonus * (priceSensitivity / 0.6) / Math.max(1, atkCount)
  const fatiguePenalty = lastAction === 'ATK' ? cfg.atkFatiguePenaltyFactor * fatigueIndex : 0
  return raw - fatiguePenalty
}

/**
 * 计算 MKT 动作加成
 */
export function calcMktBonus(mktCount: number, brandHeat: number, cfg: CfgLike = CONFIG): number {
  const mktActionBonus = cfg.mktBaseBonus / Math.max(1, mktCount)
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
export function canBrandMonetize(player: PlayerState, cfg: CfgLike = CONFIG): boolean {
  return player.brandHeat >= cfg.brandHeatThresholdForMonetize
}

/**
 * 获取利润率
 */
export function getMargin(
  action: BaseAction,
  finalShift: FinalShift,
  consecutiveHoldCount: number,
  cfg: CfgLike = CONFIG
): number {
  if (action === 'ATK') {
    return cfg.discountMargin
  }
  // 连续 HOLD >= 2 且未使用 DEFENSIVE_LOCK
  if (action === 'HOLD' && consecutiveHoldCount >= 2 && finalShift !== 'DEFENSIVE_LOCK') {
    return cfg.holdReducedMargin
  }
  return cfg.normalMargin
}

/**
 * 获取单价
 */
export function getUnitPrice(action: BaseAction, cfg: CfgLike = CONFIG): number {
  return action === 'ATK' ? cfg.discountPrice : cfg.normalPrice
}

/**
 * 获取行动成本
 */
export function getActionCost(action: BaseAction, cfg: CfgLike = CONFIG): number {
  if (action === 'QUA') return cfg.qualityInvestCost
  if (action === 'MKT') return cfg.marketingCost
  return 0
}
