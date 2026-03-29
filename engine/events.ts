// =====================
// 弈战 v2.4 - 事件定义
// =====================

import type { GameEvent, GlobalState } from './types'

// Demo 内置事件
export const DEMO_EVENTS: GameEvent[] = [
  {
    type: 'CUSTOMER_INFLUX',
    effectRound: 3,
    signalRound: 2,
    signalText: '【市场情报】有传闻称商圈周边将迎来新的大型客流入口，市场总量可能扩大。',
    effectText: '【事件生效】客流涌入！总顾客数扩大 30%。',
  },
  {
    type: 'PRICE_WAR_EXTERNAL',
    effectRound: 4,
    signalRound: 3,
    signalText: '【市场情报】市场上开始出现外部低价竞争，消费者开始重新比较品质与体验。',
    effectText: '【事件生效】外部价格战！价格敏感度下降，品质权重提升。',
  },
]

/**
 * 应用事件到全局状态（纯函数，返回新状态）
 * 事件只改环境变量，不改动作公式
 */
export function applyEvent(global: GlobalState, roundNumber: number): { newGlobal: GlobalState; eventApplied: string | null } {
  const event = global.eventQueue.find(e => e.effectRound === roundNumber)
  if (!event) {
    return { newGlobal: global, eventApplied: null }
  }

  let newGlobal = { ...global }
  let eventApplied: string | null = event.effectText

  switch (event.type) {
    case 'CUSTOMER_INFLUX':
      newGlobal.totalCustomers = Math.round(global.totalCustomers * 1.3)
      break
    case 'PRICE_WAR_EXTERNAL':
      newGlobal.priceSensitivity = 0.45
      newGlobal.qualityWeight = 0.55
      break
    case 'QUALITY_DEMAND_RISE':
      newGlobal.qualityWeight = Math.min(1.0, global.qualityWeight + 0.15)
      newGlobal.priceSensitivity = Math.max(0, 1 - newGlobal.qualityWeight)
      break
    case 'COST_SPIKE':
      // 预留扩展
      break
    default:
      eventApplied = null
  }

  return { newGlobal, eventApplied }
}

/**
 * 获取当前回合的信号文案（给玩家看的预告）
 */
export function getSignalForRound(events: GameEvent[], roundNumber: number): string | null {
  const event = events.find(e => e.signalRound === roundNumber)
  return event ? event.signalText : null
}
