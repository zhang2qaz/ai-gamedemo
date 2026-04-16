// =====================
// 弈战 - 秘密目标系统
// =====================
// 每人一张只有自己知道的目标牌，达成后终局奖励。
// 目的：制造非对称信息（"他在想什么？"），让每个人的策略感不同。

import type { PlayerId, PlayerState, RoundAuditLog, BaseAction, Pledge } from './types'

export type ObjectiveId =
  | 'AGGRESSIVE_WOLF'    // 激进狼
  | 'BLITZ'              // 闪电战
  | 'STEALTH'            // 潜伏者
  | 'TECH_NERD'          // 技术宅
  | 'GRINDER'            // 卷王
  | 'BRAND_GODFATHER'    // 品牌教父
  | 'STABILIZER'         // 稳定器
  | 'DISRUPTOR'          // 破坏王
  | 'OATH_KEEPER'        // 守誓者
  | 'SHAPESHIFTER'       // 变形金刚
  | 'CLOSER'             // 终结者
  | 'DOUBLE_CROWN'       // 双料冠军

export type Objective = {
  id: ObjectiveId
  name: string
  emoji: string
  description: string
  bonus: number          // 达成后额外利润
}

export const OBJECTIVE_POOL: Objective[] = [
  { id: 'AGGRESSIVE_WOLF',  name: '激进狼',   emoji: '🐺', description: '至少 3 回合份额领先第二名 ≥ 10%', bonus: 400000 },
  { id: 'BLITZ',            name: '闪电战',   emoji: '⚡', description: '第 2 回合结束时累计利润排名第 1', bonus: 300000 },
  { id: 'STEALTH',          name: '潜伏者',   emoji: '🥷', description: '从未被独家针对（单独被所有对手 ATK）且最终前三', bonus: 300000 },
  { id: 'TECH_NERD',        name: '技术宅',   emoji: '🤓', description: 'QUA 至少 3 次，终局使用新品总爆发', bonus: 400000 },
  { id: 'GRINDER',          name: '卷王',     emoji: '😤', description: 'ATK 至少 3 次，最终份额 ≥ 25%', bonus: 350000 },
  { id: 'BRAND_GODFATHER',  name: '品牌教父', emoji: '👑', description: 'MKT 至少 3 次，最终品牌热度 ≥ 60', bonus: 350000 },
  { id: 'STABILIZER',       name: '稳定器',   emoji: '🧘', description: 'HOLD 至少 3 次，且从未单回合垫底', bonus: 300000 },
  { id: 'DISRUPTOR',        name: '破坏王',   emoji: '💥', description: '至少 2 回合让某对手单季净利润 < 0', bonus: 350000 },
  { id: 'OATH_KEEPER',      name: '守誓者',   emoji: '⚔',  description: '所有立誓全部守住（未背誓，且至少立誓 2 次）', bonus: 250000 },
  { id: 'SHAPESHIFTER',     name: '变形金刚', emoji: '🔄', description: '四种动作（ATK/QUA/MKT/HOLD）各至少一次', bonus: 250000 },
  { id: 'CLOSER',           name: '终结者',   emoji: '🎯', description: '最后一回合净利润单季第一', bonus: 300000 },
  { id: 'DOUBLE_CROWN',     name: '双料冠军', emoji: '🏆', description: '最终份额和累计利润都第 1', bonus: 500000 },
]

/**
 * 给玩家分配目标 —— 去重、乱序
 */
export function assignObjectives(playerIds: PlayerId[]): Record<PlayerId, Objective> {
  const shuffled = [...OBJECTIVE_POOL]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const result: Partial<Record<PlayerId, Objective>> = {}
  playerIds.forEach((id, i) => {
    result[id] = shuffled[i % shuffled.length]
  })
  return result as Record<PlayerId, Objective>
}

export type ObjectiveResult = {
  objective: Objective
  achieved: boolean
  progress: string   // 描述达成情况，如 "3/3 回合领先 ✓" 或 "2/3 回合领先"
}

/**
 * 在终局评估每位玩家的目标是否达成
 */
export function evaluateObjective(
  playerId: PlayerId,
  objective: Objective,
  finalPlayers: PlayerState[],
  logs: RoundAuditLog[],
  pledgesHistory: Pledge[][],
): ObjectiveResult {
  const myId = playerId
  const me = finalPlayers.find(p => p.id === myId)
  if (!me) return { objective, achieved: false, progress: '数据缺失' }

  switch (objective.id) {
    case 'AGGRESSIVE_WOLF': {
      // 至少 3 回合份额领先第二名 ≥ 10%
      let count = 0
      for (const log of logs) {
        const sorted = [...log.players].sort((a, b) => b.newShare - a.newShare)
        if (sorted[0]?.id === myId && (sorted[0].newShare - (sorted[1]?.newShare ?? 0)) >= 0.10) {
          count++
        }
      }
      return {
        objective,
        achieved: count >= 3,
        progress: `${count}/3 回合领先 10%+`,
      }
    }

    case 'BLITZ': {
      // 第 2 回合结束时累计利润排名第 1
      const r2 = logs.find(l => l.round === 2)
      if (!r2) return { objective, achieved: false, progress: '未到 R2' }
      const ranked = [...r2.players].sort((a, b) => b.cumulativeProfitAfter - a.cumulativeProfitAfter)
      const achieved = ranked[0]?.id === myId
      return {
        objective,
        achieved,
        progress: achieved ? 'R2 利润第 1 ✓' : `R2 利润排第 ${ranked.findIndex(p => p.id === myId) + 1}`,
      }
    }

    case 'STEALTH': {
      // 从未被独家针对且最终前三
      let targeted = 0
      for (const log of logs) {
        // 粗略判定：所有对手都选 ATK 针对我 ≈ 只有我没有选 ATK 且对手全 ATK
        const others = log.players.filter(p => p.id !== myId)
        const me = log.players.find(p => p.id === myId)
        if (me && me.action !== 'ATK' && others.every(p => p.action === 'ATK')) {
          targeted++
        }
      }
      const rank = [...finalPlayers]
        .sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
        .findIndex(p => p.id === myId) + 1
      const achieved = targeted === 0 && rank <= 3
      return {
        objective,
        achieved,
        progress: `被针对 ${targeted} 次 · 最终第 ${rank}`,
      }
    }

    case 'TECH_NERD': {
      let qua = 0, finalBurst = false
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me?.action === 'QUA') qua++
        if (log.round === logs.length && me?.finalShift === 'QUALITY_CONVERT') finalBurst = true
      }
      return {
        objective,
        achieved: qua >= 3 && finalBurst,
        progress: `QUA ${qua}/3 · 终局爆发 ${finalBurst ? '✓' : '✗'}`,
      }
    }

    case 'GRINDER': {
      let atk = 0
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me?.action === 'ATK') atk++
      }
      const share = me.marketShare
      return {
        objective,
        achieved: atk >= 3 && share >= 0.25,
        progress: `ATK ${atk}/3 · 最终份额 ${(share * 100).toFixed(1)}%`,
      }
    }

    case 'BRAND_GODFATHER': {
      let mkt = 0
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me?.action === 'MKT') mkt++
      }
      const heat = me.brandHeat ?? 0
      return {
        objective,
        achieved: mkt >= 3 && heat >= 60,
        progress: `MKT ${mkt}/3 · 品牌热度 ${heat.toFixed(0)}/60`,
      }
    }

    case 'STABILIZER': {
      let hold = 0, bottomCount = 0
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me?.action === 'HOLD') hold++
        const sorted = [...log.players].sort((a, b) => a.netProfit - b.netProfit)
        if (sorted[0]?.id === myId) bottomCount++
      }
      return {
        objective,
        achieved: hold >= 3 && bottomCount === 0,
        progress: `HOLD ${hold}/3 · 垫底 ${bottomCount} 次`,
      }
    }

    case 'DISRUPTOR': {
      let victimsCount = 0
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me?.action !== 'ATK') continue
        for (const p of log.players) {
          if (p.id !== myId && p.netProfit < 0) victimsCount++
        }
      }
      return {
        objective,
        achieved: victimsCount >= 2,
        progress: `让对手单季亏损 ${victimsCount}/2 次`,
      }
    }

    case 'OATH_KEEPER': {
      let pledged = 0, broken = 0
      pledgesHistory.forEach((roundPledges, idx) => {
        const mine = roundPledges.find(p => p.playerId === myId)
        if (mine) {
          pledged++
          const log = logs[idx]
          const me = log?.players.find(p => p.id === myId)
          if (me && me.action !== mine.pledgedAction) broken++
        }
      })
      return {
        objective,
        achieved: pledged >= 2 && broken === 0,
        progress: `立誓 ${pledged} 次 · 背誓 ${broken} 次`,
      }
    }

    case 'SHAPESHIFTER': {
      const used = new Set<BaseAction>()
      for (const log of logs) {
        const me = log.players.find(p => p.id === myId)
        if (me) used.add(me.action)
      }
      return {
        objective,
        achieved: used.size === 4,
        progress: `已用 ${used.size}/4 种动作`,
      }
    }

    case 'CLOSER': {
      const lastLog = logs[logs.length - 1]
      if (!lastLog) return { objective, achieved: false, progress: '无数据' }
      const sorted = [...lastLog.players].sort((a, b) => b.netProfit - a.netProfit)
      const achieved = sorted[0]?.id === myId
      return {
        objective,
        achieved,
        progress: achieved ? '终回合利润第 1 ✓' : `终回合利润第 ${sorted.findIndex(p => p.id === myId) + 1}`,
      }
    }

    case 'DOUBLE_CROWN': {
      const profitRanked = [...finalPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
      const shareRanked = [...finalPlayers].sort((a, b) => b.marketShare - a.marketShare)
      const profitFirst = profitRanked[0]?.id === myId
      const shareFirst = shareRanked[0]?.id === myId
      return {
        objective,
        achieved: profitFirst && shareFirst,
        progress: `利润${profitFirst ? '✓' : '✗'} · 份额${shareFirst ? '✓' : '✗'}`,
      }
    }
  }
}
