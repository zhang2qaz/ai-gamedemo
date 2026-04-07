// =====================
// 弈战 v2.4 - 核心结算引擎（纯函数）
// =====================
// 结算顺序严格按规格书 Section 9：
// STEP 1  事件结算
// STEP 2  延迟效果结转
// STEP 3  行动冲突检测
// STEP 4  计算各玩家竞争力
// STEP 5  计算即时份额 instantShare
// STEP 6  计算 newShare（惯性 + 即时 + 动量）
// STEP 7  计算利润
// STEP 8  状态写回
// STEP 9  生成审计日志

import type {
  GlobalState,
  PlayerState,
  RoundInput,
  RoundAuditLog,
  PlayerRoundCalc,
  PlayerId,
  BaseAction,
} from './types'
import { CONFIG } from './constants'
import { applyEvent } from './events'
import {
  normalizeShares,
  calcHoldPenalty,
  calcQualityBonus,
  calcAtkBonus,
  calcMktBonus,
  getMargin,
  getUnitPrice,
  getActionCost,
  canQualityConvert,
  canDefensiveLock,
  canBrandMonetize,
} from './helpers'

export type ResolveRoundResult = {
  newGlobal: GlobalState
  newPlayers: PlayerState[]
  auditLog: RoundAuditLog
}

/**
 * 主结算函数（纯函数）
 * 同样输入永远给出同样输出
 */
export function resolveRound(
  global: GlobalState,
  players: PlayerState[],
  inputs: RoundInput[],
  roundIntelCards?: Array<{ impliedAction: BaseAction; isTrue: boolean }>,
  configOverrides?: Partial<typeof CONFIG>
): ResolveRoundResult {
  // Merge base CONFIG with theme-specific overrides
  const C = configOverrides ? { ...CONFIG, ...configOverrides } : CONFIG
  const roundNumber = global.roundNumber
  const isFinalRound = roundNumber === global.maxRounds

  // ─────────────────────────────────────────────
  // STEP 1: 事件结算
  // ─────────────────────────────────────────────
  const { newGlobal: globalAfterEvent, eventApplied } = applyEvent(global, roundNumber)
  let g = globalAfterEvent

  // ─────────────────────────────────────────────
  // STEP 2: 延迟效果结转
  // 若上一回合某玩家选择了 QUA，本回合开始时生效
  // 第 5 回合选 QUA 不生效（无下一回合）
  // ─────────────────────────────────────────────
  const playersAfterDelay = players.map(p => {
    if (p.lastAction === 'QUA') {
      return {
        ...p,
        qualityScore: p.qualityScore + 10,
        qualityCharge: p.qualityCharge + 1,
      }
    }
    return { ...p }
  })

  // ─────────────────────────────────────────────
  // STEP 3: 行动冲突检测
  // ─────────────────────────────────────────────
  const inputMap = new Map(inputs.map(i => [i.playerId, i]))

  const atkCount = inputs.filter(i => i.action === 'ATK').length
  const mktCount = inputs.filter(i => i.action === 'MKT').length
  const aggressionPressure = atkCount + mktCount

  // ─────────────────────────────────────────────
  // STEP 4: 计算各玩家竞争力
  // ─────────────────────────────────────────────
  const calcList: PlayerRoundCalc[] = playersAfterDelay.map(player => {
    const input = inputMap.get(player.id)!
    const { action, finalShift } = input
    const wildCard = input.wildCard ?? null

    // 快照
    const qualityScoreBefore = player.qualityScore
    // qualityDeltaFromLastRound：本回合 STEP 2 已加，这里记录增量
    const qualityDeltaFromLastRound = player.lastAction === 'QUA' ? 10 : 0
    const qualityChargeBefore = player.qualityCharge
    const brandHeatBefore = player.brandHeat
    const marketMomentumBefore = player.marketMomentum
    const fatigueBefore = player.fatigueIndex
    const consecutiveHoldBefore = player.consecutiveHoldCount

    // 品质基础加成
    const qualityBonus = calcQualityBonus(player.qualityScore, g.qualityWeight)

    // 动作加成
    let actionBonus = 0
    let finalShiftBonus = 0
    let holdPenalty = 0
    let tempQualityCharge = player.qualityCharge
    let tempMarketMomentum = player.marketMomentum

    switch (action) {
      case 'ATK':
        actionBonus = calcAtkBonus(g.priceSensitivity, atkCount, player.fatigueIndex, player.lastAction, C)
        break
      case 'MKT':
        actionBonus = calcMktBonus(mktCount, player.brandHeat, C, player.lastAction)
        break
      case 'QUA':
        if (isFinalRound) {
          actionBonus = C.qualityBurstBase + C.qualityBurstPerCharge * player.qualityCharge
          tempQualityCharge = 0
        } else {
          actionBonus = C.qualitySignalBonus
        }
        break
      case 'HOLD':
        actionBonus = 0
        break
    }

    // 终盘转向（仅第 5 回合）
    if (isFinalRound) {
      switch (finalShift) {
        case 'FINAL_PUSH':
          finalShiftBonus = C.finalPushBonus
          break
        case 'QUALITY_CONVERT':
          if (canQualityConvert(player)) {
            // If action is also QUA (which already consumed charges), don't double burst
            if (action === 'QUA') {
              // QUA action already applied burst; shift only adds momentum bonus
              tempMarketMomentum += player.qualityCharge
            } else {
              finalShiftBonus = C.qualityBurstBase + C.qualityBurstPerCharge * player.qualityCharge
              tempMarketMomentum += player.qualityCharge
              tempQualityCharge = 0
            }
          }
          break
        case 'DEFENSIVE_LOCK':
          // 竞争力阶段：holdPenalty 在下面计算，这里不处理
          break
        case 'BRAND_MONETIZE':
          // 不增加竞争力，只在利润阶段生效
          break
        case 'NONE':
        default:
          break
      }
    }

    // HOLD 惩罚
    if (action === 'HOLD') {
      const defensiveLock = isFinalRound && finalShift === 'DEFENSIVE_LOCK'
      holdPenalty = calcHoldPenalty(aggressionPressure, defensiveLock, C)
    }

    // 情报加成
    let intelBonus = 0
    if (roundIntelCards && Array.isArray(roundIntelCards)) {
      for (const card of roundIntelCards) {
        if (card && card.impliedAction === action) {
          intelBonus += card.isTrue ? 1.0 : -1.0
        }
      }
    }

    // P2: 通用暗牌竞争力加成
    let wildCardBonus = 0
    if (wildCard === 'SCOUT') wildCardBonus = 4

    // 最终竞争力
    const competitiveness = Math.max(
      C.minCompetitiveness,
      C.baseCompetitiveness + actionBonus + qualityBonus + finalShiftBonus + intelBonus + wildCardBonus - holdPenalty
    )

    return {
      id: player.id,
      action,
      finalShift: isFinalRound ? finalShift : 'NONE',
      oldShare: player.marketShare,
      qualityScoreBefore,
      qualityDeltaFromLastRound,
      qualityScoreAfter: player.qualityScore, // 在 STEP 2 已经更新
      qualityChargeBefore,
      qualityChargeAfter: tempQualityCharge,
      brandHeatBefore,
      brandHeatAfter: 0, // 占位，后面写回
      marketMomentumBefore,
      marketMomentumAfter: 0, // 占位，后面写回
      fatigueBefore,
      fatigueAfter: 0, // 占位，后面写回
      consecutiveHoldBefore,
      consecutiveHoldAfter: 0, // 占位
      atkCount,
      mktCount,
      aggressionPressure,
      actionBonus,
      qualityBonus,
      finalShiftBonus,
      holdPenalty,
      competitiveness,
      // 以下后续步骤填充
      instantShare: 0,
      momentumShare: 0,
      newShare: 0,
      unitPrice: 0,
      margin: 0,
      revenue: 0,
      grossProfit: 0,
      revenueBonus: 0,
      actionCost: 0,
      netProfit: 0,
      cashAfter: 0,
      cumulativeProfitAfter: 0,
    }
  })

  // ─────────────────────────────────────────────
  // STEP 5: 计算即时份额 instantShare
  // ─────────────────────────────────────────────
  const totalCompetitiveness = calcList.reduce((s, c) => s + c.competitiveness, 0)
  calcList.forEach(c => {
    c.instantShare = c.competitiveness / totalCompetitiveness
  })

  // ─────────────────────────────────────────────
  // STEP 6: 计算 newShare（惯性 + 即时 + 动量）
  // ─────────────────────────────────────────────
  const positiveMomentumSum = calcList.reduce((s, c) => {
    const player = playersAfterDelay.find(p => p.id === c.id)!
    return s + Math.max(0, player.marketMomentum)
  }, 0)

  const holdDefenseBarrier = (C as any).holdDefenseBarrier ?? 0.6

  calcList.forEach(c => {
    const player = playersAfterDelay.find(p => p.id === c.id)!
    const input = inputMap.get(player.id)!
    const momentumShare = positiveMomentumSum > 0
      ? Math.max(0, player.marketMomentum) / positiveMomentumSum
      : 0

    c.momentumShare = momentumShare
    let raw = C.inertiaOldWeight * c.oldShare
      + C.inertiaInstantWeight * c.instantShare
      + C.inertiaMomentumWeight * momentumShare

    // P0-3: HOLD防御壁垒 — 当份额即将下降时，HOLD玩家抵消部分损失
    if (input.action === 'HOLD' && raw < c.oldShare) {
      const loss = c.oldShare - raw
      raw = c.oldShare - loss * holdDefenseBarrier
    }

    // P2: SHIELD 暗牌 — 份额不会下降
    const wc = input.wildCard ?? null
    if (wc === 'SHIELD' && raw < c.oldShare) {
      raw = c.oldShare
    }

    c.newShare = raw
  })

  // 归一化
  const rawShares = Object.fromEntries(calcList.map(c => [c.id, c.newShare]))
  const normalizedShares = normalizeShares(rawShares)
  calcList.forEach(c => {
    c.newShare = normalizedShares[c.id]
  })

  // ─────────────────────────────────────────────
  // STEP 7: 计算利润（含动态赌注倍数）
  // ─────────────────────────────────────────────
  const stakesMultiplier = C.roundStakesMultiplier[roundNumber] ?? 1.0
  const atkSoloInflux = (C as any).atkSoloInflux ?? 1.3

  calcList.forEach((c, idx) => {
    const player = playersAfterDelay[idx]
    const { action, finalShift } = c

    const unitPrice = getUnitPrice(action, C)
    const margin = getMargin(action, isFinalRound ? finalShift : 'NONE', player.consecutiveHoldCount, C)
    // P0-1: 独家促销获客量加成
    const influxBonus = (action === 'ATK' && atkCount === 1) ? atkSoloInflux : 1.0
    const revenue = g.totalCustomers * c.newShare * unitPrice * stakesMultiplier * influxBonus
    let grossProfit = revenue * margin

    // FINAL_PUSH 利润惩罚
    if (isFinalRound && finalShift === 'FINAL_PUSH') {
      grossProfit *= C.finalPushProfitMultiplier
    }

    // BRAND_MONETIZE 加成（需满足 brandHeat 条件）
    let revenueBonus = 0
    if (isFinalRound && finalShift === 'BRAND_MONETIZE' && canBrandMonetize(player, C)) {
      revenueBonus = revenue * C.brandMonetizeRevenueBonus
    }

    // P2: 暗牌利润效果
    const wildCard = inputMap.get(player.id)?.wildCard ?? null
    // DOUBLE_DOWN: 收入 ×1.3
    if (wildCard === 'DOUBLE_DOWN') {
      grossProfit *= 1.3
    }
    // COST_CUT: 行动成本归零
    const actionCost = wildCard === 'COST_CUT' ? 0 : getActionCost(action, C)
    const netProfit = grossProfit + revenueBonus - actionCost

    c.unitPrice = unitPrice
    c.margin = margin
    c.revenue = revenue
    c.grossProfit = grossProfit
    c.revenueBonus = revenueBonus
    c.actionCost = actionCost
    c.netProfit = netProfit
    c.cashAfter = player.cash + netProfit
    c.cumulativeProfitAfter = player.cumulativeProfit + netProfit
  })

  // ─────────────────────────────────────────────
  // STEP 8: 状态写回
  // ─────────────────────────────────────────────
  const newPlayers: PlayerState[] = playersAfterDelay.map((player, idx) => {
    const c = calcList[idx]
    const { action, finalShift } = c
    const wildCard = inputMap.get(player.id)?.wildCard ?? null

    // brandHeat（设上限防止无限累积）
    let brandHeat = action === 'MKT'
      ? Math.min(C.brandHeatCap, player.brandHeat + C.brandHeatGainFromMkt)
      : Math.max(0, player.brandHeat - C.brandHeatDecayOther)

    // marketMomentum
    let marketMomentum = player.marketMomentum
    if (action === 'MKT') {
      marketMomentum = Math.min(C.momentumCap, marketMomentum + C.momentumGainFromMkt)
    }
    if (action === 'HOLD') {
      marketMomentum = Math.max(0, marketMomentum - C.momentumDecayOnHold)
    }
    // 自然衰减
    marketMomentum = Math.max(0, marketMomentum - C.momentumDecayEachRound)

    // QUALITY_CONVERT：已在 STEP 4 处理 tempMarketMomentum，需同步
    if (isFinalRound && finalShift === 'QUALITY_CONVERT' && canQualityConvert(player)) {
      marketMomentum = Math.max(0, marketMomentum - C.momentumDecayEachRound) // 已衰减一次，再加 qualityCharge
      // 实际已在 calcList 中的 marketMomentumAfter 计算，这里重新算以保持一致
      // 注：STEP 4 中 tempMarketMomentum 加了 qualityCharge，但那只是竞争力计算用的临时值
      // 写回时也加上
      marketMomentum = Math.max(0, player.marketMomentum + player.qualityCharge - C.momentumDecayEachRound)
      if (action === 'HOLD') {
        marketMomentum = Math.max(0, marketMomentum - C.momentumDecayOnHold)
      }
    }

    // fatigueIndex
    const fatigueIndex = action === 'ATK'
      ? player.fatigueIndex + 1
      : Math.max(0, player.fatigueIndex - 1)

    // consecutiveHoldCount
    const consecutiveHoldCount = action === 'HOLD'
      ? player.consecutiveHoldCount + 1
      : 0

    // qualityCharge：QUALITY_CONVERT 清零
    const qualityCharge = (isFinalRound && finalShift === 'QUALITY_CONVERT' && canQualityConvert(player))
      ? 0
      : (isFinalRound && action === 'QUA')
      ? 0  // 新品爆发消耗全部储备
      : player.qualityCharge

    // 写回快照到 calcList
    c.brandHeatAfter = brandHeat
    c.marketMomentumAfter = marketMomentum
    c.fatigueAfter = fatigueIndex
    c.consecutiveHoldAfter = consecutiveHoldCount
    c.qualityChargeAfter = qualityCharge

    // P2: MOMENTUM_SURGE 暗牌：立即 +2 动量
    if (wildCard === 'MOMENTUM_SURGE') {
      marketMomentum = Math.min(C.momentumCap, marketMomentum + 2)
    }

    // P2: QUALITY_BOOST 暗牌：立即 +5 品质（任何动作可用）
    const qualityScoreBonus = wildCard === 'QUALITY_BOOST' ? 5 : 0

    return {
      ...player,
      cash: c.cashAfter,
      marketShare: c.newShare,
      qualityScore: player.qualityScore + qualityScoreBonus,
      cumulativeProfit: c.cumulativeProfitAfter,
      brandHeat,
      marketMomentum,
      fatigueIndex,
      qualityCharge,
      consecutiveHoldCount,
      lastAction: action,
    }
  })

  // ─────────────────────────────────────────────
  // STEP 9: 生成审计日志
  // ─────────────────────────────────────────────
  const auditLog: RoundAuditLog = {
    round: roundNumber,
    global: {
      totalCustomers: g.totalCustomers,
      priceSensitivity: g.priceSensitivity,
      qualityWeight: g.qualityWeight,
      eventApplied,
      stakesMultiplier,
    },
    players: calcList,
  }

  // 全局回合数 +1
  const finalGlobal: GlobalState = {
    ...g,
    roundNumber: roundNumber + 1,
  }

  return {
    newGlobal: finalGlobal,
    newPlayers,
    auditLog,
  }
}
