// =====================
// 剧本杀引擎 - 剧本运行时接口
// 通用流程由引擎驱动；终局大机制与结局判定由各剧本自己实现。
// =====================

import type { GameState, ResultView, Scenario, Seat } from './types'

export type FinaleModule = {
  /** 进入终局步骤时初始化 state.finale */
  init(state: GameState, now: number): void
  /** 处理玩家在终局中的动作（直接修改 state）；返回错误信息表示拒绝 */
  act(state: GameState, seat: Seat, payload: unknown, now: number): string | void
  /** 时间推进（倒计时到期等）；返回 true 表示状态有变化 */
  tick(state: GameState, now: number): boolean
  /** 下一次需要 tick 的时间 */
  deadline(state: GameState): number | null
  /** 有人放弃后重新检查：剩下的人都选好了就往下走（可选） */
  poke?(state: GameState, now: number): void
  /** 终局是否结束（结束后引擎进入下一步骤） */
  isDone(state: GameState): boolean
  /** 给某座位看的终局视图（必须隐藏对方的秘密信息） */
  view(state: GameState, seat: Seat, now: number): unknown
}

export type ScenarioRuntime = {
  scenario: Scenario
  finale: FinaleModule | null
  /** 结局页数据（双方可见完整复盘） */
  result(state: GameState): ResultView
}
