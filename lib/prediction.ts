// =====================
// 弈战 - 决策时收益预测
// =====================
// 给玩家一个"大致靠谱"的收益区间，提升胜任感（我知道自己在做什么）。
// 不追求精确，追求"让玩家看到选择的后果"。

import { resolveRound } from '@/engine/resolveRound'
import type {
  GlobalState, PlayerState, PlayerId, BaseAction, FinalShift,
  WildCardType, RoundInput, MarketForecast, Pledge,
} from '@/engine/types'

export type PredictionResult = {
  profitMin: number
  profitMax: number
  profitMedian: number
  shareDeltaMin: number
  shareDeltaMax: number
  competitivenessMin: number
  competitivenessMax: number
  warnings: string[]
  scenariosRun: number
}

const ACTIONS: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
const OPPOSITE: Record<BaseAction, BaseAction> = {
  ATK: 'HOLD', QUA: 'ATK', MKT: 'HOLD', HOLD: 'ATK',
}

/**
 * 基于多种对手剧本运行 resolveRound，得到"最好/最坏/中位"区间。
 * 不考虑对手的 finalShift / 暗牌 / 立誓（简化）。
 */
export function predictOutcome(params: {
  global: GlobalState
  players: PlayerState[]
  myId: PlayerId
  myAction: BaseAction
  myFinalShift?: FinalShift
  myWildCard?: WildCardType | null
  forecast?: MarketForecast | null
  pledges?: Pledge[]
  configOverrides?: Record<string, unknown>
}): PredictionResult {
  const {
    global, players, myId,
    myAction, myFinalShift = 'NONE', myWildCard = null,
    forecast, pledges, configOverrides,
  } = params

  const me = players.find(p => p.id === myId)
  if (!me) {
    return emptyResult()
  }
  const opponents = players.filter(p => p.id !== myId).map(p => p.id)

  // ── 构造对手动作的多个剧本 ──
  const scenarios: BaseAction[][] = []

  // 1. 全员稳守（最乐观）
  scenarios.push(opponents.map(() => 'HOLD' as BaseAction))
  // 2. 全员复制我（正面冲突 / 最悲观）
  scenarios.push(opponents.map(() => myAction))
  // 3. 全员进攻（残酷市场）
  scenarios.push(opponents.map(() => 'ATK' as BaseAction))
  // 4. 全员推广（营销战）
  scenarios.push(opponents.map(() => 'MKT' as BaseAction))
  // 5. 对手沿用上一回合（惯性）
  scenarios.push(opponents.map(id => {
    const p = players.find(pp => pp.id === id)
    return (p?.lastAction as BaseAction | null) ?? 'HOLD'
  }))
  // 6. 对手混合随机
  scenarios.push(opponents.map(() => ACTIONS[Math.floor(Math.random() * 4)]))
  // 7. 对手全选反制我
  scenarios.push(opponents.map(() => OPPOSITE[myAction]))

  const profits: number[] = []
  const shareDeltas: number[] = []
  const competitivenesses: number[] = []

  const forecastParam = forecast
    ? { signal: forecast.signal, isTrue: forecast.isTrue }
    : null

  for (const scenario of scenarios) {
    const inputs: RoundInput[] = [
      { playerId: myId, action: myAction, finalShift: myFinalShift, wildCard: myWildCard },
      ...opponents.map((id, i) => ({
        playerId: id,
        action: scenario[i],
        finalShift: 'NONE' as FinalShift,
        wildCard: null,
      })),
    ]

    try {
      const result = resolveRound(
        global, players, inputs,
        undefined, // roundIntelCards
        configOverrides as Parameters<typeof resolveRound>[4],
        forecastParam,
        pledges,
      )
      const myAudit = result.auditLog.players.find(p => p.id === myId)
      if (myAudit) {
        profits.push(myAudit.netProfit)
        shareDeltas.push(myAudit.newShare - myAudit.oldShare)
        competitivenesses.push(myAudit.competitiveness)
      }
    } catch {
      // 仿真失败跳过
    }
  }

  if (profits.length === 0) return emptyResult()

  const sortedProfits = [...profits].sort((a, b) => a - b)

  return {
    profitMin: Math.min(...profits),
    profitMax: Math.max(...profits),
    profitMedian: sortedProfits[Math.floor(sortedProfits.length / 2)],
    shareDeltaMin: Math.min(...shareDeltas),
    shareDeltaMax: Math.max(...shareDeltas),
    competitivenessMin: Math.min(...competitivenesses),
    competitivenessMax: Math.max(...competitivenesses),
    warnings: buildWarnings(params, players),
    scenariosRun: profits.length,
  }
}

function buildWarnings(
  params: Parameters<typeof predictOutcome>[0],
  players: PlayerState[],
): string[] {
  const { myId, myAction, myFinalShift, global } = params
  const me = players.find(p => p.id === myId)
  if (!me) return []
  const warnings: string[] = []

  // 促销疲劳
  if (myAction === 'ATK' && me.fatigueIndex >= 2) {
    warnings.push('促销疲劳已高，连续打折效果会明显减弱')
  }
  // 终局研发来不及
  if (myAction === 'QUA' && global.roundNumber === global.maxRounds) {
    warnings.push('终局研发来不及兑现，产品力加成本轮用不到')
  }
  // 新品爆发无储备
  if (myFinalShift === 'QUALITY_CONVERT' && me.qualityCharge === 0) {
    warnings.push('你还没有研发储备，新品总爆发无法触发')
  }
  // 守势连太久
  if (myAction === 'HOLD' && me.consecutiveHoldCount >= 2) {
    warnings.push('连续守势 2 回合，利润率已开始下滑')
  }
  // 敌方激进
  const atkCount = players.filter(p => p.id !== myId && p.lastAction === 'ATK').length
  if (myAction === 'HOLD' && atkCount >= 2) {
    warnings.push(`上回合有 ${atkCount} 人进攻，守势承压明显`)
  }
  // 本身份额低还守
  if (myAction === 'HOLD' && me.marketShare < 0.15) {
    warnings.push('份额已低于 15%，守势难以翻盘')
  }

  return warnings
}

function emptyResult(): PredictionResult {
  return {
    profitMin: 0, profitMax: 0, profitMedian: 0,
    shareDeltaMin: 0, shareDeltaMax: 0,
    competitivenessMin: 0, competitivenessMax: 0,
    warnings: [],
    scenariosRun: 0,
  }
}
