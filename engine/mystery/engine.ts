// =====================
// 剧本杀引擎 - 服务器端入口（每个剧本一个引擎）
// 注意：本文件会引入完整剧本（含真相），只能在服务器端使用。
// =====================

import { makeEngine } from './core'
import { DEFAULT_SCENARIO_ID, RUNTIMES } from './scenarios'

export type Engine = ReturnType<typeof makeEngine>

const engines = new Map<string, Engine>(Object.entries(RUNTIMES).map(([id, rt]) => [id, makeEngine(rt)]))

export function hasScenario(id: unknown): id is string {
  return typeof id === 'string' && engines.has(id)
}

/** 这一局的引擎（老房间没记剧本时用默认剧本） */
export function engineFor(scenarioId: string | undefined): Engine {
  return engines.get(scenarioId ?? DEFAULT_SCENARIO_ID) ?? engines.get(DEFAULT_SCENARIO_ID)!
}

export { DEFAULT_SCENARIO_ID }
