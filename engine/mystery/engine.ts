// =====================
// 剧本杀引擎 - 服务器端入口（绑定当前剧本）
// 注意：本文件会引入完整剧本（含真相），只能在服务器端使用。
// =====================

import { makeEngine } from './core'
import { runtime } from './scenarios'

const engine = makeEngine(runtime)

export const createGame = engine.createGame
export const joinSeat = engine.joinSeat
export const setPresence = engine.setPresence
export const vacateSeat = engine.vacateSeat
export const abandonSeat = engine.abandonSeat
export const reduce = engine.reduce
export const tick = engine.tick
export const nextDeadline = engine.nextDeadline
export const viewFor = engine.viewFor
export const scenario = engine.scenario
