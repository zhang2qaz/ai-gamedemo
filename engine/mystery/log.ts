// 剧本杀引擎 - 日志工具（引擎与剧本模块共用）
import type { GameState, LogEntry, Seat } from './types'
import { SEATS } from './types'

/**
 * 按"受众"分桶计上限：聊天、公共记录、给每个座位的私信各自一个桶，新记录只挤掉同一个桶里最旧的。
 * - 刷聊天不能把剧情正文、私信挤掉；
 * - 对方收到私信，永远不会改变你能看到的记录（否则你的视图会"无故变一次"，暴露对方做了私密操作）。
 */
export const MAX_CHAT_LOG = 300
export const MAX_EVENT_LOG = 600
export const MAX_PRIVATE_LOG = 300

function bucketOf(e: Pick<LogEntry, 'kind' | 'to'>): string {
  return e.kind === 'chat' ? 'chat' : e.to
}

export function appendLog(state: GameState, now: number, from: LogEntry['from'], to: LogEntry['to'], text: string, kind: LogEntry['kind']) {
  state.logSeq += 1
  // 每个可见座位各自连续编号：视图只下发自己的序号，对方收到私信时你这边不会出现缺号
  const by = (state.logSeqBy ??= { P1: 0, P2: 0, P3: 0, P4: 0 })
  const seq: Partial<Record<Seat, number>> = {}
  for (const s of to === 'all' ? SEATS : [to]) seq[s] = (by[s] = (by[s] ?? 0) + 1)
  // DM 文本里的 Markdown 粗体在记录面板中不渲染，去掉标记
  const clean = kind === 'chat' ? text : text.replace(/\*\*/g, '')
  state.log.push({ id: state.logSeq, ts: now, from, to, text: clean, kind, seq })
  const bucket = bucketOf({ kind, to })
  const cap = bucket === 'chat' ? MAX_CHAT_LOG : bucket === 'all' ? MAX_EVENT_LOG : MAX_PRIVATE_LOG
  let count = 0
  for (const e of state.log) if (bucketOf(e) === bucket) count++
  if (count <= cap) return
  // 删掉同一个桶里最早的一条
  const idx = state.log.findIndex(e => bucketOf(e) === bucket)
  if (idx >= 0) state.log.splice(idx, 1)
}
