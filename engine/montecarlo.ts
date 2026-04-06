// =====================
// 弈战 - 蒙特卡洛公平性验证
// 10000 局模拟，验证 2-8 人公平性
// =====================

import { createInitialPlayerStates, INITIAL_GLOBAL_STATE, CONFIG } from './constants'
import { resolveRound } from './resolveRound'
import type { BaseAction, FinalShift, RoundInput, PlayerId, PlayerState, GlobalState } from './types'

const ACTIONS: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
const FINAL_SHIFTS: FinalShift[] = ['NONE', 'FINAL_PUSH', 'QUALITY_CONVERT', 'DEFENSIVE_LOCK', 'BRAND_MONETIZE']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 随机策略：每回合随机选一个动作
 */
function randomAction(): BaseAction {
  return pick(ACTIONS)
}

/**
 * 随机终盘转向
 */
function randomFinalShift(player: PlayerState, action: BaseAction): FinalShift {
  const eligible: FinalShift[] = ['NONE', 'FINAL_PUSH']
  if (player.qualityCharge >= 1) eligible.push('QUALITY_CONVERT')
  if (action === 'HOLD') eligible.push('DEFENSIVE_LOCK')
  if (player.brandHeat >= 70) eligible.push('BRAND_MONETIZE')
  return pick(eligible)
}

/**
 * 模拟一局完整游戏
 */
function simulateGame(playerCount: number): PlayerState[] {
  let global: GlobalState = { ...INITIAL_GLOBAL_STATE, eventQueue: [] }
  let players: PlayerState[] = createInitialPlayerStates(playerCount)
  const maxRounds = global.maxRounds

  for (let round = 1; round <= maxRounds; round++) {
    const isFinal = round === maxRounds
    const inputs: RoundInput[] = players.map(p => {
      const action = randomAction()
      const finalShift = isFinal ? randomFinalShift(p, action) : 'NONE'
      return { playerId: p.id, action, finalShift }
    })

    const result = resolveRound(global, players, inputs)
    global = result.newGlobal
    players = result.newPlayers
  }

  return players
}

/**
 * 运行蒙特卡洛模拟
 */
function runMonteCarlo(playerCount: number, simCount: number) {
  const ids = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).slice(0, playerCount)

  // 统计
  const winCount: Record<string, number> = {}
  const totalProfit: Record<string, number> = {}
  const totalShare: Record<string, number> = {}
  const profitStd: Record<string, number[]> = {}
  const top2Count: Record<string, number> = {}

  for (const id of ids) {
    winCount[id] = 0
    totalProfit[id] = 0
    totalShare[id] = 0
    profitStd[id] = []
    top2Count[id] = 0
  }

  for (let i = 0; i < simCount; i++) {
    const players = simulateGame(playerCount)
    const sorted = [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)

    // 记录胜者
    winCount[sorted[0].id]++
    if (sorted.length >= 2) {
      top2Count[sorted[0].id]++
      top2Count[sorted[1].id]++
    }

    // 累计利润和份额
    for (const p of players) {
      totalProfit[p.id] += p.cumulativeProfit
      totalShare[p.id] += p.marketShare
      profitStd[p.id].push(p.cumulativeProfit)
    }
  }

  // 计算标准差
  function stdDev(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    const variance = arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length
    return Math.sqrt(variance)
  }

  // 输出结果
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  弈战 蒙特卡洛公平性验证 — ${playerCount} 人模式`)
  console.log(`  模拟局数: ${simCount.toLocaleString()}`)
  console.log(`${'═'.repeat(60)}`)

  const expectedWinRate = (1 / playerCount * 100).toFixed(1)
  const expectedShare = (1 / playerCount * 100).toFixed(1)

  console.log(`\n  理论期望: 胜率=${expectedWinRate}%  份额=${expectedShare}%\n`)

  console.log(`  ${'玩家'.padEnd(6)} ${'胜率%'.padStart(8)} ${'偏差'.padStart(8)} ${'平均利润'.padStart(12)} ${'利润标准差'.padStart(12)} ${'平均份额%'.padStart(10)} ${'前二率%'.padStart(8)}`)
  console.log(`  ${'─'.repeat(66)}`)

  let maxWinDeviation = 0
  let maxShareDeviation = 0

  for (const id of ids) {
    const winRate = (winCount[id] / simCount * 100)
    const winDeviation = Math.abs(winRate - (100 / playerCount))
    maxWinDeviation = Math.max(maxWinDeviation, winDeviation)

    const avgProfit = totalProfit[id] / simCount
    const profitSD = stdDev(profitStd[id])
    const avgShare = (totalShare[id] / simCount * 100)
    const shareDeviation = Math.abs(avgShare - (100 / playerCount))
    maxShareDeviation = Math.max(maxShareDeviation, shareDeviation)
    const top2Rate = (top2Count[id] / simCount * 100)

    console.log(
      `  ${id.padEnd(6)} ${winRate.toFixed(1).padStart(8)} ${(winDeviation > 2 ? '⚠️ ' : '✅ ').padStart(4)}${winDeviation.toFixed(1).padStart(4)} ${('¥' + Math.round(avgProfit).toLocaleString()).padStart(12)} ${('¥' + Math.round(profitSD).toLocaleString()).padStart(12)} ${avgShare.toFixed(2).padStart(10)} ${top2Rate.toFixed(1).padStart(8)}`
    )
  }

  // 公平性判定
  console.log(`\n  ${'─'.repeat(66)}`)

  const fair = maxWinDeviation < 3.0 && maxShareDeviation < 1.0
  const verdict = fair ? '✅ 公平' : '⚠️ 需要调优'

  console.log(`  最大胜率偏差: ${maxWinDeviation.toFixed(2)}%  ${maxWinDeviation < 3 ? '✅' : '⚠️'}`)
  console.log(`  最大份额偏差: ${maxShareDeviation.toFixed(2)}%  ${maxShareDeviation < 1 ? '✅' : '⚠️'}`)
  console.log(`  综合判定: ${verdict}`)
  console.log(`${'═'.repeat(60)}\n`)

  return { fair, maxWinDeviation, maxShareDeviation }
}

// ── 运行所有人数 ──
console.log('\n🎮 弈战公平性验证 — 10000 局蒙特卡洛模拟\n')
console.log('每个座位号的玩家使用完全随机策略')
console.log('公平 = 任何座位号的胜率不应系统性偏离理论值\n')

const SIM_COUNT = 10000
const results: { count: number; fair: boolean; winDev: number; shareDev: number }[] = []

for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  const r = runMonteCarlo(n, SIM_COUNT)
  results.push({ count: n, fair: r.fair, winDev: r.maxWinDeviation, shareDev: r.maxShareDeviation })
}

// 汇总
console.log('\n' + '═'.repeat(50))
console.log('  汇总')
console.log('═'.repeat(50))
console.log(`  ${'人数'.padEnd(6)} ${'胜率偏差'.padStart(10)} ${'份额偏差'.padStart(10)} ${'判定'.padStart(6)}`)
console.log(`  ${'─'.repeat(38)}`)
for (const r of results) {
  console.log(`  ${String(r.count).padEnd(6)} ${r.winDev.toFixed(2).padStart(10)}% ${r.shareDev.toFixed(2).padStart(9)}% ${(r.fair ? '✅ 公平' : '⚠️ 偏差').padStart(8)}`)
}
console.log('═'.repeat(50) + '\n')
