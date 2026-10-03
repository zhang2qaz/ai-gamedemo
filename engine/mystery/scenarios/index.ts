// 当前上线的剧本（服务器端专用：包含完整剧情与真相，客户端不得引用）
import type { ScenarioRuntime } from '../runtime'
import { swingState } from './swing-state'

export const runtime: ScenarioRuntime = swingState
