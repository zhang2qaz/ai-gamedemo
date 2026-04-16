// =====================
// 弈战 - 双人契约系统
// =====================
// 两个玩家私下约定本回合都做同一动作：
//   - 双方守约：各 +¥80,000
//   - 任一背约：背约者 -¥120,000，受害者 +¥40,000
// 让"承诺"有真金白银的代价。

import type { PlayerId, BaseAction } from './types'

export type PactStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export type Pact = {
  id: string
  round: number
  proposerId: PlayerId
  targetId: PlayerId
  action: BaseAction
  status: PactStatus
  proposedAt: number
}

export const PACT_REWARD = 80_000
export const PACT_BREAK_PENALTY = 120_000
export const PACT_VICTIM_COMPENSATION = 40_000

export type PactResult = {
  pact: Pact
  proposerKept: boolean
  targetKept: boolean
  proposerDelta: number
  targetDelta: number
  summary: string
}

/**
 * 评估一个已接受的契约：根据双方实际动作判断守约情况
 */
export function evaluatePact(
  pact: Pact,
  actualActions: Record<PlayerId, BaseAction>,
): PactResult {
  const proposerAction = actualActions[pact.proposerId]
  const targetAction = actualActions[pact.targetId]

  const proposerKept = proposerAction === pact.action
  const targetKept = targetAction === pact.action

  let proposerDelta = 0
  let targetDelta = 0
  let summary = ''

  if (proposerKept && targetKept) {
    proposerDelta = PACT_REWARD
    targetDelta = PACT_REWARD
    summary = `🤝 守约成功，各 +¥${(PACT_REWARD / 10000).toFixed(0)}万`
  } else if (!proposerKept && !targetKept) {
    proposerDelta = -PACT_BREAK_PENALTY
    targetDelta = -PACT_BREAK_PENALTY
    summary = `🔪 双方互相背约，各 -¥${(PACT_BREAK_PENALTY / 10000).toFixed(0)}万`
  } else if (!proposerKept) {
    proposerDelta = -PACT_BREAK_PENALTY
    targetDelta = PACT_VICTIM_COMPENSATION
    summary = `🔪 提议方背约 · 提议者 -¥${(PACT_BREAK_PENALTY / 10000).toFixed(0)}万，对方 +¥${(PACT_VICTIM_COMPENSATION / 10000).toFixed(0)}万`
  } else {
    proposerDelta = PACT_VICTIM_COMPENSATION
    targetDelta = -PACT_BREAK_PENALTY
    summary = `🔪 接受方背约 · 接受者 -¥${(PACT_BREAK_PENALTY / 10000).toFixed(0)}万，提议者 +¥${(PACT_VICTIM_COMPENSATION / 10000).toFixed(0)}万`
  }

  return { pact, proposerKept, targetKept, proposerDelta, targetDelta, summary }
}

let _id = 0
export function makePactId(): string {
  return `pact-${Date.now()}-${++_id}`
}
