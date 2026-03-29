// =====================
// 弈战 v2.4 - 单元测试
// =====================

import { resolveRound } from '../resolveRound'
import type { GlobalState, PlayerState, RoundInput } from '../types'
import { DEMO_EVENTS } from '../events'

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────

function makeGlobal(overrides: Partial<GlobalState> = {}): GlobalState {
  return {
    roundNumber: 1,
    maxRounds: 5,
    totalCustomers: 100000,
    priceSensitivity: 0.6,
    qualityWeight: 0.4,
    eventQueue: DEMO_EVENTS,
    ...overrides,
  }
}

function makePlayer(id: 'A' | 'B' | 'C' | 'D', overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: `玩家 ${id}`,
    cash: 1000000,
    marketShare: 0.25,
    qualityScore: 70,
    brandHeat: 30,
    cumulativeProfit: 0,
    marketMomentum: 0,
    fatigueIndex: 0,
    qualityCharge: 0,
    lastAction: null,
    consecutiveHoldCount: 0,
    ...overrides,
  }
}

function makeInputs(actions: Record<'A' | 'B' | 'C' | 'D', 'ATK' | 'QUA' | 'MKT' | 'HOLD'>): RoundInput[] {
  return (['A', 'B', 'C', 'D'] as const).map(id => ({
    playerId: id,
    action: actions[id],
    finalShift: 'NONE' as const,
  }))
}

// ─────────────────────────────────────────────
// 测试 1：marketShare 之和始终 = 1
// ─────────────────────────────────────────────

describe('市场份额归一化', () => {
  test('任意动作组合后，所有玩家 marketShare 之和 = 1', () => {
    const global = makeGlobal()
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'ATK', B: 'MKT', C: 'QUA', D: 'HOLD' })

    const { newPlayers } = resolveRound(global, players, inputs)
    const total = newPlayers.reduce((s, p) => s + p.marketShare, 0)
    expect(total).toBeCloseTo(1.0, 8)
  })

  test('全员 HOLD 时份额之和 = 1', () => {
    const global = makeGlobal()
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { newPlayers } = resolveRound(global, players, inputs)
    const total = newPlayers.reduce((s, p) => s + p.marketShare, 0)
    expect(total).toBeCloseTo(1.0, 8)
  })
})

// ─────────────────────────────────────────────
// 测试 2：纯函数——同样输入，同样输出
// ─────────────────────────────────────────────

describe('纯函数幂等性', () => {
  test('同样输入两次，结果完全一致', () => {
    const global = makeGlobal()
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'ATK', B: 'MKT', C: 'QUA', D: 'HOLD' })

    const result1 = resolveRound(global, players, inputs)
    const result2 = resolveRound(global, players, inputs)

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
  })
})

// ─────────────────────────────────────────────
// 测试 3：事件只改环境变量，不改动作公式
// ─────────────────────────────────────────────

describe('事件系统', () => {
  test('第 3 回合 CUSTOMER_INFLUX 只改 totalCustomers', () => {
    const globalRound3 = makeGlobal({ roundNumber: 3 })
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { auditLog } = resolveRound(globalRound3, players, inputs)

    // 事件生效：totalCustomers 应增加 30%
    expect(auditLog.global.totalCustomers).toBe(130000)
    expect(auditLog.global.eventApplied).toBeTruthy()
  })

  test('第 4 回合 PRICE_WAR_EXTERNAL 改变 priceSensitivity 和 qualityWeight', () => {
    const globalRound4 = makeGlobal({ roundNumber: 4 })
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { auditLog } = resolveRound(globalRound4, players, inputs)

    expect(auditLog.global.priceSensitivity).toBeCloseTo(0.45)
    expect(auditLog.global.qualityWeight).toBeCloseTo(0.55)
  })

  test('事件不改变任何玩家的竞争力公式基础参数（基础竞争力不变）', () => {
    const globalNormal = makeGlobal({ roundNumber: 1 })
    const globalEvent = makeGlobal({ roundNumber: 3 })
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const resultNormal = resolveRound(globalNormal, players, inputs)
    const resultEvent = resolveRound(globalEvent, players, inputs)

    // 事件只改客流量，不改竞争力结构
    // 竞争力分布应相同（因为 HOLD vs HOLD 不受 priceSensitivity 影响）
    const shareRatioNormal = resultNormal.newPlayers.map(p => p.marketShare)
    const shareRatioEvent = resultEvent.newPlayers.map(p => p.marketShare)
    shareRatioNormal.forEach((share, i) => {
      expect(share).toBeCloseTo(shareRatioEvent[i], 4)
    })
  })
})

// ─────────────────────────────────────────────
// 测试 4：连续 ATK 触发 fatigue 惩罚
// ─────────────────────────────────────────────

describe('ATK 疲劳惩罚', () => {
  test('连续 ATK 第 2 回合时竞争力低于第 1 回合', () => {
    const global = makeGlobal()
    const players = [makePlayer('A'), makePlayer('B'), makePlayer('C'), makePlayer('D')]
    const inputs = makeInputs({ A: 'ATK', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    // 第 1 回合
    const round1 = resolveRound(global, players, inputs)
    const compR1 = round1.auditLog.players.find(p => p.id === 'A')!.competitiveness

    // 第 2 回合（A 继续 ATK，lastAction = ATK）
    const global2 = { ...global, roundNumber: 2 }
    const round2 = resolveRound(global2, round1.newPlayers, inputs)
    const compR2 = round2.auditLog.players.find(p => p.id === 'A')!.competitiveness

    // A 连续 ATK，第 2 回合竞争力应低于第 1 回合
    expect(compR2).toBeLessThan(compR1)
  })

  test('疲劳后停止 ATK，下回合 fatigueIndex 下降', () => {
    const players = [
      makePlayer('A', { fatigueIndex: 2, lastAction: 'ATK' }),
      makePlayer('B'),
      makePlayer('C'),
      makePlayer('D'),
    ]
    const global = makeGlobal()
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { newPlayers } = resolveRound(global, players, inputs)
    const newA = newPlayers.find(p => p.id === 'A')!
    expect(newA.fatigueIndex).toBe(1)  // 从 2 降到 1
  })
})

// ─────────────────────────────────────────────
// 测试 5：连续 HOLD 触发利润率下降
// ─────────────────────────────────────────────

describe('连续 HOLD 利润率衰减', () => {
  test('连续 HOLD 2 回合后利润率变为 0.36', () => {
    const players = [
      makePlayer('A', { consecutiveHoldCount: 2 }),
      makePlayer('B'),
      makePlayer('C'),
      makePlayer('D'),
    ]
    const global = makeGlobal()
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { auditLog } = resolveRound(global, players, inputs)
    const playerA = auditLog.players.find(p => p.id === 'A')!

    expect(playerA.margin).toBeCloseTo(0.36)
  })

  test('HOLD 少于 2 回合，利润率为 0.40', () => {
    const players = [
      makePlayer('A', { consecutiveHoldCount: 1 }),
      makePlayer('B'),
      makePlayer('C'),
      makePlayer('D'),
    ]
    const global = makeGlobal()
    const inputs = makeInputs({ A: 'HOLD', B: 'HOLD', C: 'HOLD', D: 'HOLD' })

    const { auditLog } = resolveRound(global, players, inputs)
    const playerA = auditLog.players.find(p => p.id === 'A')!

    expect(playerA.margin).toBeCloseTo(0.40)
  })
})

// ─────────────────────────────────────────────
// 测试 6：QUALITY_CONVERT 清空 charge 并增加 momentum
// ─────────────────────────────────────────────

describe('QUALITY_CONVERT', () => {
  test('QUALITY_CONVERT 消耗 qualityCharge 并增加 momentum', () => {
    const charge = 2
    const players = [
      makePlayer('A', {
        qualityCharge: charge,
        marketMomentum: 1.0,
        lastAction: 'QUA', // 上回合 QUA，本回合延迟生效（但 charge 已在上一轮+1，这里手动设置）
      }),
      makePlayer('B'),
      makePlayer('C'),
      makePlayer('D'),
    ]
    // 第 5 回合才能用 QUALITY_CONVERT
    const global = makeGlobal({ roundNumber: 5 })
    const inputs: RoundInput[] = [
      { playerId: 'A', action: 'HOLD', finalShift: 'QUALITY_CONVERT' },
      { playerId: 'B', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'C', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'D', action: 'HOLD', finalShift: 'NONE' },
    ]

    const { newPlayers, auditLog } = resolveRound(global, players, inputs)
    const newA = newPlayers.find(p => p.id === 'A')!
    const logA = auditLog.players.find(p => p.id === 'A')!

    // qualityCharge 被清零
    expect(newA.qualityCharge).toBe(0)

    // STEP 2: lastAction=QUA 使 qualityCharge 从 2 增到 3
    // finalShiftBonus = qualityBurstBase + qualityBurstPerCharge * 3 = 4 + 2*3 = 10
    expect(logA.finalShiftBonus).toBeCloseTo(10.0)
  })

  test('qualityCharge = 0 时不能使用 QUALITY_CONVERT（无加成）', () => {
    const players = [
      makePlayer('A', { qualityCharge: 0 }),
      makePlayer('B'),
      makePlayer('C'),
      makePlayer('D'),
    ]
    const global = makeGlobal({ roundNumber: 5 })
    const inputs: RoundInput[] = [
      { playerId: 'A', action: 'HOLD', finalShift: 'QUALITY_CONVERT' },
      { playerId: 'B', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'C', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'D', action: 'HOLD', finalShift: 'NONE' },
    ]

    const { auditLog } = resolveRound(global, players, inputs)
    const logA = auditLog.players.find(p => p.id === 'A')!

    // 没有 charge，无加成
    expect(logA.finalShiftBonus).toBeCloseTo(0)
  })
})

// ─────────────────────────────────────────────
// 测试 7：BRAND_MONETIZE 只加利润，不加竞争力
// ─────────────────────────────────────────────

describe('BRAND_MONETIZE', () => {
  test('BRAND_MONETIZE 不增加竞争力', () => {
    const players = [
      makePlayer('A', { brandHeat: 80 }),  // 满足 >= 70
      makePlayer('B', { brandHeat: 80 }),
      makePlayer('C'),
      makePlayer('D'),
    ]
    const global = makeGlobal({ roundNumber: 5 })

    // A 用 BRAND_MONETIZE，B 用 NONE（相同基础动作）
    const inputsA: RoundInput[] = [
      { playerId: 'A', action: 'HOLD', finalShift: 'BRAND_MONETIZE' },
      { playerId: 'B', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'C', action: 'HOLD', finalShift: 'NONE' },
      { playerId: 'D', action: 'HOLD', finalShift: 'NONE' },
    ]

    const { auditLog } = resolveRound(global, players, inputsA)
    const logA = auditLog.players.find(p => p.id === 'A')!
    const logB = auditLog.players.find(p => p.id === 'B')!

    // finalShiftBonus 应为 0（不加竞争力）
    expect(logA.finalShiftBonus).toBeCloseTo(0)

    // 竞争力与 B 相同（相同 brandHeat，相同动作）
    expect(logA.competitiveness).toBeCloseTo(logB.competitiveness, 4)

    // 但 revenueBonus > 0
    expect(logA.revenueBonus).toBeGreaterThan(0)
    expect(logB.revenueBonus).toBe(0)
  })
})
