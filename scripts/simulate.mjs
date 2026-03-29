// =====================
// 弈战 v2.4 - 平衡性仿真 (100局)
// 纯 JS 重写核心引擎，无需 React 环境
// =====================

// ── CONFIG ──────────────────────────────────────────────
// ── v2.6 参数 ──
const CONFIG = {
  baseCompetitiveness: 10,
  atkBaseBonus: 11.0,        // ↑ 原8.0：独家促销变成真威胁
  mktBaseBonus: 3.0,
  qualitySignalBonus: 3.0,   // 新增：QUA立即品质信号加成
  discountPrice: 12,
  normalPrice: 15,
  discountMargin: 0.32,      // ↑ 原0.28：促销利润改善
  normalMargin: 0.40,
  holdReducedMargin: 0.36,
  qualityInvestCost: 80000,
  marketingCost: 100000,
  inertiaOldWeight: 0.55,
  inertiaInstantWeight: 0.38, // ↑ 原0.35：补偿动量权重下降
  inertiaMomentumWeight: 0.07,// ↓ 原0.10：动量对份额贡献降低
  holdPressurePenalty: 1.1,  // 原 1.5
  atkFatiguePenaltyFactor: 1.5,
  momentumGainFromMkt: 1.2,  // ↑ 原1.0：纯MKT仍有意义
  momentumCap: 3.0,
  momentumDecayEachRound: 0.5,
  momentumDecayOnHold: 2.0,  // ↑ 原1.0：HOLD时动量当回合即归零
  qualityBurstBase: 4.0,
  qualityBurstPerCharge: 2.0,
  finalPushBonus: 4.0,
  finalPushProfitMultiplier: 0.8,
  brandMonetizeRevenueBonus: 0.03,
  brandHeatGainFromMkt: 20,
  brandHeatDecayOther: 5,
  brandHeatCap: 80,           // 新增：防止品牌热度无限滚雪球
  brandHeatThresholdForMonetize: 70,
  minCompetitiveness: 6.0,
}

const INITIAL_GLOBAL = {
  roundNumber: 1,
  maxRounds: 5,
  totalCustomers: 100000,
  priceSensitivity: 0.6,
  qualityWeight: 0.4,
}

const DEMO_EVENTS = [
  { type: 'CUSTOMER_INFLUX',     effectRound: 3 },
  { type: 'PRICE_WAR_EXTERNAL',  effectRound: 4 },
]

function makePlayer(id, name) {
  return { id, name, cash: 1000000, marketShare: 0.25, qualityScore: 70,
    brandHeat: 30, cumulativeProfit: 0, marketMomentum: 0, fatigueIndex: 0,
    qualityCharge: 0, lastAction: null, consecutiveHoldCount: 0 }
}

// ── HELPERS ──────────────────────────────────────────────
function normalizeShares(shares) {
  const total = Object.values(shares).reduce((s, v) => s + v, 0)
  if (total === 0) {
    const ids = Object.keys(shares)
    return Object.fromEntries(ids.map(id => [id, 1 / ids.length]))
  }
  return Object.fromEntries(Object.entries(shares).map(([id, v]) => [id, v / total]))
}

function calcQualityBonus(qualityScore, qualityWeight) {
  return (qualityScore - 70) * qualityWeight * 0.8  // 调整后：原 0.5
}

function calcAtkBonus(priceSensitivity, atkCount, fatigueIndex, lastAction) {
  const raw = CONFIG.atkBaseBonus * (priceSensitivity / 0.6) / Math.max(1, atkCount)
  const fatiguePenalty = lastAction === 'ATK' ? CONFIG.atkFatiguePenaltyFactor * fatigueIndex : 0
  return raw - fatiguePenalty
}

function calcMktBonus(mktCount, brandHeat) {
  return CONFIG.mktBaseBonus / Math.max(1, mktCount) + Math.max(0, brandHeat - 50) * 0.1
}

function calcHoldPenalty(aggressionPressure, defensiveLock) {
  const raw = CONFIG.holdPressurePenalty * aggressionPressure
  return defensiveLock ? raw * 0.5 : raw
}

function getMargin(action, finalShift, consecutiveHoldCount) {
  if (action === 'ATK') return CONFIG.discountMargin
  if (action === 'HOLD' && consecutiveHoldCount >= 2 && finalShift !== 'DEFENSIVE_LOCK')
    return CONFIG.holdReducedMargin
  return CONFIG.normalMargin
}

function getUnitPrice(action) {
  return action === 'ATK' ? CONFIG.discountPrice : CONFIG.normalPrice
}

function getActionCost(action) {
  if (action === 'QUA') return CONFIG.qualityInvestCost
  if (action === 'MKT') return CONFIG.marketingCost
  return 0
}

// ── EVENT ENGINE ──────────────────────────────────────────
function applyEvent(global, roundNumber) {
  const event = DEMO_EVENTS.find(e => e.effectRound === roundNumber)
  if (!event) return global
  const g = { ...global }
  if (event.type === 'CUSTOMER_INFLUX')    g.totalCustomers = Math.round(g.totalCustomers * 1.3)
  if (event.type === 'PRICE_WAR_EXTERNAL') { g.priceSensitivity = 0.45; g.qualityWeight = 0.55 }
  return g
}

// ── ROUND RESOLVER ────────────────────────────────────────
function resolveRound(global, players, inputs) {
  const roundNumber = global.roundNumber
  const isFinalRound = roundNumber === global.maxRounds

  // STEP 1: 事件
  const g = applyEvent(global, roundNumber)

  // STEP 2: 延迟 QUA 效果
  const playersD = players.map(p =>
    p.lastAction === 'QUA'
      ? { ...p, qualityScore: p.qualityScore + 10, qualityCharge: p.qualityCharge + 1 }
      : { ...p }
  )

  // STEP 3: 冲突检测
  const atkCount = inputs.filter(i => i.action === 'ATK').length
  const mktCount = inputs.filter(i => i.action === 'MKT').length
  const aggressionPressure = atkCount + mktCount

  // STEP 4: 竞争力
  const inputMap = new Map(inputs.map(i => [i.playerId, i]))
  const calcList = playersD.map(player => {
    const input = inputMap.get(player.id)
    const action = input.action
    const finalShift = input.finalShift || 'NONE'

    const qualityBonus = calcQualityBonus(player.qualityScore, g.qualityWeight)
    let actionBonus = 0, finalShiftBonus = 0, holdPenalty = 0

    switch (action) {
      case 'ATK': actionBonus = calcAtkBonus(g.priceSensitivity, atkCount, player.fatigueIndex, player.lastAction); break
      case 'MKT': actionBonus = calcMktBonus(mktCount, player.brandHeat); break
      case 'QUA':
        if (isFinalRound) {
          actionBonus = CONFIG.qualityBurstBase + CONFIG.qualityBurstPerCharge * player.qualityCharge
        } else {
          actionBonus = CONFIG.qualitySignalBonus  // 立即品质信号
        }
        break
      case 'HOLD': break
    }

    if (isFinalRound) {
      if (finalShift === 'FINAL_PUSH') finalShiftBonus = CONFIG.finalPushBonus
      if (finalShift === 'QUALITY_CONVERT' && player.qualityCharge >= 1)
        finalShiftBonus = CONFIG.qualityBurstBase + CONFIG.qualityBurstPerCharge * player.qualityCharge
    }

    if (action === 'HOLD') {
      const defensiveLock = isFinalRound && finalShift === 'DEFENSIVE_LOCK'
      holdPenalty = calcHoldPenalty(aggressionPressure, defensiveLock)
    }

    const competitiveness = Math.max(
      CONFIG.minCompetitiveness,
      CONFIG.baseCompetitiveness + actionBonus + qualityBonus + finalShiftBonus - holdPenalty
    )

    return { id: player.id, action, finalShift, oldShare: player.marketShare,
             qualityBonus, actionBonus, finalShiftBonus, holdPenalty, competitiveness,
             instantShare: 0, momentumShare: 0, newShare: 0 }
  })

  // STEP 5: 即时份额
  const totalComp = calcList.reduce((s, c) => s + c.competitiveness, 0)
  calcList.forEach(c => { c.instantShare = c.competitiveness / totalComp })

  // STEP 6: newShare（惯性 + 即时 + 动量）
  const posMomSum = playersD.reduce((s, p) => s + Math.max(0, p.marketMomentum), 0)
  calcList.forEach(c => {
    const p = playersD.find(p => p.id === c.id)
    const momShare = posMomSum > 0 ? Math.max(0, p.marketMomentum) / posMomSum : 0
    c.momentumShare = momShare
    c.newShare = CONFIG.inertiaOldWeight * c.oldShare
      + CONFIG.inertiaInstantWeight * c.instantShare
      + CONFIG.inertiaMomentumWeight * momShare
  })
  const rawShares = Object.fromEntries(calcList.map(c => [c.id, c.newShare]))
  const normShares = normalizeShares(rawShares)
  calcList.forEach(c => { c.newShare = normShares[c.id] })

  // STEP 7: 利润
  calcList.forEach((c, idx) => {
    const player = playersD[idx]
    const action = c.action
    const finalShift = c.finalShift
    const unitPrice = getUnitPrice(action)
    const margin = getMargin(action, isFinalRound ? finalShift : 'NONE', player.consecutiveHoldCount)
    const revenue = g.totalCustomers * c.newShare * unitPrice
    let grossProfit = revenue * margin
    if (isFinalRound && finalShift === 'FINAL_PUSH') grossProfit *= CONFIG.finalPushProfitMultiplier
    let revenueBonus = 0
    if (isFinalRound && finalShift === 'BRAND_MONETIZE' && player.brandHeat >= CONFIG.brandHeatThresholdForMonetize)
      revenueBonus = revenue * CONFIG.brandMonetizeRevenueBonus
    const actionCost = getActionCost(action)
    c.netProfit = grossProfit + revenueBonus - actionCost
    c.cumulativeProfitAfter = player.cumulativeProfit + c.netProfit
    c.cashAfter = player.cash + c.netProfit
    c.unitPrice = unitPrice
    c.margin = margin
    c.revenue = revenue
  })

  // STEP 8: 状态写回
  const newPlayers = playersD.map((player, idx) => {
    const c = calcList[idx]
    const action = c.action
    const finalShift = c.finalShift

    let brandHeat = action === 'MKT'
      ? Math.min(CONFIG.brandHeatCap, player.brandHeat + CONFIG.brandHeatGainFromMkt)
      : Math.max(0, player.brandHeat - CONFIG.brandHeatDecayOther)

    let marketMomentum = player.marketMomentum
    if (action === 'MKT') marketMomentum = Math.min(CONFIG.momentumCap, marketMomentum + CONFIG.momentumGainFromMkt)
    if (action === 'HOLD') marketMomentum = Math.max(0, marketMomentum - CONFIG.momentumDecayOnHold)
    marketMomentum = Math.max(0, marketMomentum - CONFIG.momentumDecayEachRound)

    if (isFinalRound && finalShift === 'QUALITY_CONVERT' && player.qualityCharge >= 1) {
      marketMomentum = Math.max(0, player.marketMomentum + player.qualityCharge - CONFIG.momentumDecayEachRound)
      if (action === 'HOLD') marketMomentum = Math.max(0, marketMomentum - CONFIG.momentumDecayOnHold)
    }

    const fatigueIndex = action === 'ATK' ? player.fatigueIndex + 1 : Math.max(0, player.fatigueIndex - 1)
    const consecutiveHoldCount = action === 'HOLD' ? player.consecutiveHoldCount + 1 : 0

    const qualityCharge =
      (isFinalRound && finalShift === 'QUALITY_CONVERT' && player.qualityCharge >= 1) ? 0
      : (isFinalRound && action === 'QUA') ? 0
      : player.qualityCharge

    return {
      ...player,
      cash: c.cashAfter,
      marketShare: c.newShare,
      cumulativeProfit: c.cumulativeProfitAfter,
      brandHeat, marketMomentum, fatigueIndex, qualityCharge,
      consecutiveHoldCount, lastAction: action,
    }
  })

  return {
    newGlobal: { ...g, roundNumber: roundNumber + 1 },
    newPlayers,
    calcList,
  }
}

// ── 策略定义 ──────────────────────────────────────────────
const ACTIONS = ['ATK', 'QUA', 'MKT', 'HOLD']

// 预定义策略（5 回合的行动序列）
const STRATEGIES = {
  '全促销':     ['ATK','ATK','ATK','ATK','ATK'],
  '全研发':     ['QUA','QUA','QUA','QUA','QUA'],
  '全推广':     ['MKT','MKT','MKT','MKT','MKT'],
  '全精细':     ['HOLD','HOLD','HOLD','HOLD','HOLD'],
  '先促销转研':  ['ATK','ATK','QUA','QUA','QUA'],
  '先研发后爆发':['QUA','QUA','QUA','QUA','QUA'],  // R5 用 QUA burst
  '推广+促销':  ['MKT','MKT','ATK','ATK','ATK'],
  '前推广后精细':['MKT','MKT','MKT','HOLD','HOLD'],
  '促销+研发':  ['ATK','QUA','ATK','QUA','ATK'],
  '混合均衡':   ['ATK','MKT','QUA','HOLD','ATK'],
}

// R5 终盘转向选择（按动作自动匹配最优）
function chooseFinalShift(action, player) {
  if (action === 'QUA') return 'NONE'         // QUA burst 已自动处理
  if (action === 'ATK') return 'FINAL_PUSH'   // 搭配促销的终盘加推
  if (action === 'HOLD') {
    if (player.qualityCharge >= 1) return 'QUALITY_CONVERT'
    return 'DEFENSIVE_LOCK'
  }
  if (action === 'MKT') {
    if (player.brandHeat >= CONFIG.brandHeatThresholdForMonetize) return 'BRAND_MONETIZE'
    return 'NONE'
  }
  return 'NONE'
}

// ── 工具：并列时随机打破平局，消除位置偏差 ────────────────────
function pickWinner(results) {
  const maxProfit = Math.max(...results.map(r => r.profit))
  const tied = results.filter(r => r.profit >= maxProfit - 1)  // 1元以内视为并列
  return tied[Math.floor(Math.random() * tied.length)]
}

// ── 单局模拟 ──────────────────────────────────────────────
function simulateGame(strategyNames) {
  const players = [
    makePlayer('A', strategyNames[0]),
    makePlayer('B', strategyNames[1]),
    makePlayer('C', strategyNames[2]),
    makePlayer('D', strategyNames[3]),
  ]
  const strategies = strategyNames.map(n => STRATEGIES[n])
  let global = { ...INITIAL_GLOBAL, eventQueue: [] }

  for (let round = 1; round <= 5; round++) {
    const isFinalRound = round === 5
    const inputs = players.map((p, i) => {
      const action = strategies[i][round - 1]
      const finalShift = isFinalRound ? chooseFinalShift(action, p) : 'NONE'
      return { playerId: p.id, action, finalShift }
    })
    const { newGlobal, newPlayers } = resolveRound(global, players, inputs)
    global = newGlobal
    players.splice(0, 4, ...newPlayers)
  }

  return players.map(p => ({ id: p.id, name: p.name, profit: p.cumulativeProfit, share: p.marketShare }))
}

// ── 实验 1: 策略 vs 策略 对战矩阵 ──────────────────────────
function runStrategyMatrix() {
  const names = Object.keys(STRATEGIES)
  const wins = {}
  const profits = {}
  names.forEach(n => { wins[n] = 0; profits[n] = [] })

  // 每个策略轮流担当 A，其余三个随机填充常见策略
  const OPPONENTS = ['全促销', '全推广', '混合均衡']

  for (const focal of names) {
    for (let run = 0; run < 100; run++) {
      // 4 个位置轮转
      const results4 = simulateGame([focal, OPPONENTS[0], OPPONENTS[1], OPPONENTS[2]])
      const me = results4.find(r => r.name === focal)
      profits[focal].push(me.profit)
      const winner = pickWinner(results4)
      if (winner.name === focal) wins[focal]++
    }
  }

  return { wins, profits }
}

// ── 实验 2: 纯策略 4人对战（每局4人各用同一策略，排列组合）──
function runPureStrategyBattles() {
  const names = Object.keys(STRATEGIES)
  const records = []  // { strategies[4], profits[4], winner }

  // 取最有代表性的10种4人组合
  const combos = [
    ['全促销',  '全促销',  '全促销',  '全促销'],
    ['全研发',  '全研发',  '全研发',  '全研发'],
    ['全推广',  '全推广',  '全推广',  '全推广'],
    ['全精细',  '全精细',  '全精细',  '全精细'],
    ['全促销',  '全研发',  '全推广',  '全精细'],
    ['先研发后爆发', '全促销', '全推广', '混合均衡'],
    ['推广+促销','前推广后精细','促销+研发','混合均衡'],
    ['先促销转研','推广+促销','全研发','全精细'],
    ['混合均衡','混合均衡','混合均衡','混合均衡'],
    ['全促销',  '全促销',  '全精细',  '全精细'],
  ]

  for (const combo of combos) {
    const results = simulateGame(combo)
    const winner = pickWinner(results)
    records.push({ combo, results, winner: winner.name })
  }

  return records
}

// ── 实验 3: 随机策略 100 局 ──────────────────────────────────
function runRandom100() {
  const names = Object.keys(STRATEGIES)
  const actionWins   = { ATK: 0, QUA: 0, MKT: 0, HOLD: 0 }
  const actionTotal  = { ATK: 0, QUA: 0, MKT: 0, HOLD: 0 }
  const actionProfit = { ATK: [], QUA: [], MKT: [], HOLD: [] }
  const stratWins    = {}
  names.forEach(n => { stratWins[n] = 0 })

  const positionWins = { A: 0, B: 0, C: 0, D: 0 }  // 检查位置偏差

  for (let game = 0; game < 10000; game++) {
    // 随机给4位玩家分配策略
    const picked = [0,1,2,3].map(() => names[Math.floor(Math.random() * names.length)])
    const results = simulateGame(picked)
    const winner = pickWinner(results)

    positionWins[winner.id]++

    const winnerStrat = picked[['A','B','C','D'].indexOf(winner.id)]
    stratWins[winnerStrat] = (stratWins[winnerStrat] || 0) + 1

    // 统计策略对应的主要动作
    results.forEach((r, i) => {
      const strat = picked[i]
      const actions = STRATEGIES[strat]
      const dominant = actions.reduce((acc, a) => {
        acc[a] = (acc[a] || 0) + 1; return acc
      }, {})
      const mainAction = Object.entries(dominant).sort((a, b) => b[1] - a[1])[0][0]
      actionTotal[mainAction]++
      actionProfit[mainAction].push(r.profit)
      if (r.id === winner.id) actionWins[mainAction]++
    })
  }

  return { actionWins, actionTotal, actionProfit, stratWins, positionWins }
}

// ── 实验 4: ATK 疲劳效果分析 ──────────────────────────────────
function runAtkFatigueTest() {
  const results = []
  // ATK 连续次数 0-5，观察第 N 回合 ATK bonus
  for (let consecutive = 0; consecutive <= 4; consecutive++) {
    const p = makePlayer('A', 'test')
    p.fatigueIndex = consecutive
    p.lastAction = consecutive > 0 ? 'ATK' : null
    const bonus = calcAtkBonus(0.6, 1, p.fatigueIndex, p.lastAction)
    results.push({ consecutive, fatigueIndex: p.fatigueIndex, atkBonus: bonus.toFixed(2) })
  }
  return results
}

// ── 实验 5: 单回合动作对比（相同对手环境）───────────────────────
function runActionSnapshot() {
  // 1v4 环境：A 尝试每种动作，BCD 固定为混合策略
  const rows = []
  for (const action of ACTIONS) {
    const players = [
      makePlayer('A', action),
      makePlayer('B', 'mix'),
      makePlayer('C', 'mix'),
      makePlayer('D', 'mix'),
    ]
    // BCD 选 HOLD/MKT/ATK 各一
    const inputs = [
      { playerId: 'A', action, finalShift: 'NONE' },
      { playerId: 'B', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'C', action: 'MKT',  finalShift: 'NONE' },
      { playerId: 'D', action: 'ATK',  finalShift: 'NONE' },
    ]
    const { calcList } = resolveRound({ ...INITIAL_GLOBAL, eventQueue: [] }, players, inputs)
    const a = calcList.find(c => c.id === 'A')
    rows.push({
      action,
      comp: a.competitiveness.toFixed(2),
      share: (a.newShare * 100).toFixed(1) + '%',
      netProfit: Math.round(a.netProfit).toLocaleString(),
    })
  }
  return rows
}

// ── 报告输出 ──────────────────────────────────────────────
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function std(arr) {
  if (arr.length < 2) return 0
  const m = avg(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}
function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * p / 100)
  return sorted[Math.min(idx, sorted.length - 1)]
}

console.log('\n╔══════════════════════════════════════════════════════╗')
console.log('║   弈战 v2.7 — 10000局 Monte Carlo 平衡验证              ║')
console.log('║  holdPressurePenalty=1.1  全参数 v2.7 final           ║')
console.log('╚══════════════════════════════════════════════════════╝\n')

// ── 实验 5: 动作快照（先跑，直观）
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【A】单回合动作对比  (对手: B=精细, C=推广, D=促销, R1)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const snap = runActionSnapshot()
console.log(`${'动作'.padEnd(8)}${'竞争力'.padEnd(10)}${'获客份额'.padEnd(12)}净利润`)
snap.forEach(r => {
  console.log(`${r.action.padEnd(8)}${r.comp.padEnd(10)}${r.share.padEnd(12)}¥${r.netProfit}`)
})

// ── 实验 4: ATK 疲劳
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【B】ATK 连续使用疲劳衰减  (独家促销场景)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const fatigue = runAtkFatigueTest()
fatigue.forEach(r => {
  console.log(`  连续 ATK 第${r.consecutive}次: fatigueIndex=${r.fatigueIndex}, ATK加成=${r.atkBonus}`)
})

// ── 实验 2: 策略对战
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【C】代表性策略 4 人对战结果')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const battles = runPureStrategyBattles()
battles.forEach(b => {
  const line = b.results.map(r =>
    `${r.name.slice(0,5)}:¥${Math.round(r.profit/1000)}K`
  ).join('  ')
  console.log(`  [${b.winner}胜] ${line}`)
})

// ── 实验 1: 策略矩阵
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【D】各策略 vs 固定对手胜率 & 平均利润 (各100局)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const matrix = runStrategyMatrix()
const sortedStrats = Object.entries(matrix.wins)
  .sort((a, b) => b[1] - a[1])
sortedStrats.forEach(([name, w]) => {
  const avgP = avg(matrix.profits[name])
  const bar = '█'.repeat(w) + '░'.repeat(100 - w)
  console.log(`  ${name.padEnd(12)} 胜${w.toString().padStart(3)}/100  均利¥${Math.round(avgP/1000)}K  ${bar}`)
})

// ── 实验 3: 随机100局
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【E】随机策略组合 10000 局 — 主动作胜率 & 利润分布')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
const rand = runRandom100()
console.log(`  ${'动作'.padEnd(6)}  ${'胜率'.padEnd(8)}  ${'均利'.padEnd(8)}  ${'标准差'.padEnd(8)}  P10      P90      n`)
ACTIONS.forEach(a => {
  const wins = rand.actionWins[a]
  const total = rand.actionTotal[a]
  const rate = total ? (wins / total * 100).toFixed(1) : '0'
  const profits = rand.actionProfit[a]
  const avgP  = avg(profits)
  const stdP  = std(profits)
  const p10   = percentile(profits, 10)
  const p90   = percentile(profits, 90)
  console.log(`  ${a.padEnd(6)}  ${(rate+'%').padEnd(8)}  ¥${Math.round(avgP/1000).toString().padEnd(6)}K  ±¥${Math.round(stdP/1000).toString().padEnd(5)}K  ¥${Math.round(p10/1000)}K   ¥${Math.round(p90/1000)}K   ${total}`)
})

console.log('\n  策略胜场排名（10000局）:')
const totalGames = 10000
Object.entries(rand.stratWins)
  .sort((a, b) => b[1] - a[1])
  .forEach(([n, w]) => {
    const pct = (w / totalGames * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(w / totalGames * 100))
    console.log(`    ${n.padEnd(14)} ${w.toString().padStart(4)}胜 ${pct.padStart(5)}%  ${bar}`)
  })

console.log(`\n  位置偏差检查 (理想均值=${totalGames/4}):`)
Object.entries(rand.positionWins).forEach(([pos, w]) => {
  const expected = totalGames / 4
  const bias = w - expected
  const pct = (w / totalGames * 100).toFixed(1)
  const flag = Math.abs(bias) > totalGames * 0.05 ? ' ⚠' : ' ✅'
  console.log(`    位置${pos}: ${w}胜 (${pct}%)  偏差${bias > 0 ? '+' : ''}${bias}${flag}`)
})

// ── 综合诊断
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('【F】平衡性问题诊断')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

const actionAvgProfits = {}
ACTIONS.forEach(a => { actionAvgProfits[a] = avg(rand.actionProfit[a]) })
const profitVals = Object.values(actionAvgProfits)
const maxP = Math.max(...profitVals)
const minP = Math.min(...profitVals)
const spread = ((maxP - minP) / minP * 100).toFixed(1)

console.log(`  ▸ 最高均利动作: ${Object.entries(actionAvgProfits).sort((a,b)=>b[1]-a[1])[0][0]}`)
console.log(`  ▸ 最低均利动作: ${Object.entries(actionAvgProfits).sort((a,b)=>a[1]-b[1])[0][0]}`)
console.log(`  ▸ 利润极差: ${spread}%  (>50% 提示显著失衡)`)

const posWins = Object.values(rand.positionWins)
const posMax = Math.max(...posWins), posMin = Math.min(...posWins)
console.log(`  ▸ 位置最大偏差: ${posMax - posMin} 胜  (>15 提示位置偏袒)`)

const atkProfit = actionAvgProfits['ATK']
const holdProfit = actionAvgProfits['HOLD']
console.log(`  ▸ ATK vs HOLD 均利比: ${(atkProfit/holdProfit).toFixed(2)}  (>1.5 促销偏强)`)

const quaProfit = actionAvgProfits['QUA']
console.log(`  ▸ QUA 均利: ¥${Math.round(quaProfit/1000)}K  (投入¥150K，需份额足够高才回本)`)

console.log('\n  【建议阈值参考】')
console.log('  ✅ 理想状态：各动作均利差距 <30%，位置偏差 <10')
console.log('  ⚠  轻度失衡：差距 30-60%，需测试是否有最优单策略')
console.log('  ❌ 严重失衡：某动作碾压其他，博弈深度丧失\n')
