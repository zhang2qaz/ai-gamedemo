// 剧本杀引擎 - 日志工具（引擎与剧本模块共用）
import type { GameState, LogEntry } from './types'

const MAX_LOG = 400

export function appendLog(state: GameState, now: number, from: LogEntry['from'], to: LogEntry['to'], text: string, kind: LogEntry['kind']) {
  state.logSeq += 1
  state.log.push({ id: state.logSeq, ts: now, from, to, text, kind })
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG)
}
