// 剧本杀引擎 - 日志工具（引擎与剧本模块共用）
import type { GameState, LogEntry } from './types'

/** 聊天和 DM/剧情分开计上限：刷聊天不能把剧情正文、私信挤掉 */
export const MAX_CHAT_LOG = 300
export const MAX_EVENT_LOG = 600

export function appendLog(state: GameState, now: number, from: LogEntry['from'], to: LogEntry['to'], text: string, kind: LogEntry['kind']) {
  state.logSeq += 1
  // DM 文本里的 Markdown 粗体在记录面板中不渲染，去掉标记
  const clean = kind === 'chat' ? text : text.replace(/\*\*/g, '')
  state.log.push({ id: state.logSeq, ts: now, from, to, text: clean, kind })
  const isChat = kind === 'chat'
  const cap = isChat ? MAX_CHAT_LOG : MAX_EVENT_LOG
  let count = 0
  for (const e of state.log) if ((e.kind === 'chat') === isChat) count++
  if (count <= cap) return
  // 删掉同类里最早的一条
  const idx = state.log.findIndex(e => (e.kind === 'chat') === isChat)
  if (idx >= 0) state.log.splice(idx, 1)
}
