// 上线的剧本（服务器端专用：包含完整剧情与真相，客户端不得引用）
import type { ScenarioRuntime } from '../runtime'
import { swingState } from './swing-state'
import { forestCake } from './forest-cake'

export const RUNTIMES: Record<string, ScenarioRuntime> = {
  [swingState.scenario.id]: swingState,
  [forestCake.scenario.id]: forestCake,
}

/** 老房间、没指定剧本时用的剧本 */
export const DEFAULT_SCENARIO_ID = swingState.scenario.id
