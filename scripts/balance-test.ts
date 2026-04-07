// Balance verification script — runs 500 games with random strategies
import { resolveRound } from '../engine/resolveRound'
import { createInitialPlayerStates, CONFIG, INITIAL_GLOBAL_STATE } from '../engine/constants'
import type { BaseAction, GlobalState, PlayerState, RoundInput, FinalShift } from '../engine/types'

const ACTIONS: BaseAction[] = ['ATK', 'MKT', 'QUA', 'HOLD']
const GAMES = 2000
const PLAYER_COUNT = 4

function randomAction(): BaseAction {
  return ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
}

function biasedAction(primary: BaseAction): BaseAction {
  return Math.random() < 0.6 ? primary : randomAction()
}

function runGame(strategies: Array<(p: PlayerState, round: number) => BaseAction>, configOverrides?: Partial<typeof CONFIG>) {
  let players = createInitialPlayerStates(PLAYER_COUNT) as PlayerState[]
  let global: GlobalState = { ...INITIAL_GLOBAL_STATE }

  for (let round = 1; round <= 5; round++) {
    global = { ...global, roundNumber: round }
    const inputs: RoundInput[] = players.map((p, i) => ({
      playerId: p.id as any,
      action: strategies[i](p, round),
      finalShift: 'NONE' as FinalShift,
    }))
    const result = resolveRound(global, players, inputs, undefined, configOverrides)
    players = result.newPlayers
    global = result.newGlobal
  }
  return players
}

// Test 1: Biased random play
console.log('=== Test 1: Biased Random (500 games) ===')
const winsByAction: Record<string, number> = { ATK: 0, MKT: 0, QUA: 0, HOLD: 0 }
const profitsByAction: Record<string, number[]> = { ATK: [], MKT: [], QUA: [], HOLD: [] }

for (let g = 0; g < GAMES; g++) {
  const primaryActions = ACTIONS.map((_, i) => ACTIONS[i % 4])
  const strategies = primaryActions.map(a => (_p: PlayerState, _r: number) => biasedAction(a))

  const finalPlayers = runGame(strategies)
  const sorted = [...finalPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const winner = sorted[0]
  const winnerIdx = finalPlayers.indexOf(winner)
  winsByAction[primaryActions[winnerIdx]]++

  primaryActions.forEach((a, i) => {
    profitsByAction[a].push(finalPlayers[i].cumulativeProfit)
  })
}

for (const action of ACTIONS) {
  const winRate = (winsByAction[action] / GAMES * 100).toFixed(1)
  const avg = Math.round(profitsByAction[action].reduce((s, v) => s + v, 0) / profitsByAction[action].length)
  console.log(`  ${action}: Win ${winRate}% | Avg Profit: ${avg.toLocaleString()}`)
}

// Test 2: Pure strategy
console.log('\n=== Test 2: Pure Strategy (ATK vs MKT vs QUA vs HOLD) ===')
const pureWins: Record<string, number> = { ATK: 0, MKT: 0, QUA: 0, HOLD: 0 }
const pureProfits: Record<string, number[]> = { ATK: [], MKT: [], QUA: [], HOLD: [] }

for (let g = 0; g < GAMES; g++) {
  const strategies = ACTIONS.map(a => () => a)
  const finalPlayers = runGame(strategies)
  const sorted = [...finalPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const winner = sorted[0]
  const winnerIdx = finalPlayers.indexOf(winner)
  pureWins[ACTIONS[winnerIdx]]++

  ACTIONS.forEach((a, i) => {
    pureProfits[a].push(finalPlayers[i].cumulativeProfit)
  })
}

for (const action of ACTIONS) {
  const winRate = (pureWins[action] / GAMES * 100).toFixed(1)
  const avg = Math.round(pureProfits[action].reduce((s, v) => s + v, 0) / pureProfits[action].length)
  console.log(`  ${action}: Win ${winRate}% | Avg Profit: ${avg.toLocaleString()}`)
}

// Test 3: R5 decisiveness
console.log('\n=== Test 3: R5 Decisiveness ===')
let totalR5Share = 0
let validGames = 0
for (let g = 0; g < 200; g++) {
  let players = createInitialPlayerStates(PLAYER_COUNT) as PlayerState[]
  let global: GlobalState = { ...INITIAL_GLOBAL_STATE }
  const roundProfits: number[] = []

  for (let round = 1; round <= 5; round++) {
    global = { ...global, roundNumber: round }
    const inputs: RoundInput[] = players.map(p => ({
      playerId: p.id as any,
      action: randomAction(),
      finalShift: 'NONE' as FinalShift,
    }))
    const profitsBefore = players.reduce((s, p) => s + p.cumulativeProfit, 0)
    const result = resolveRound(global, players, inputs)
    players = result.newPlayers
    global = result.newGlobal
    const profitsAfter = players.reduce((s, p) => s + p.cumulativeProfit, 0)
    roundProfits.push(Math.abs(profitsAfter - profitsBefore))
  }

  const totalProfit = roundProfits.reduce((s, v) => s + v, 0)
  if (totalProfit > 0) {
    totalR5Share += roundProfits[4] / totalProfit
    validGames++
  }
}
console.log(`  R5 share of total profit: ${(totalR5Share / validGames * 100).toFixed(1)}%`)
console.log(`  Target: < 35%`)

console.log('\n✅ Balance test complete')
