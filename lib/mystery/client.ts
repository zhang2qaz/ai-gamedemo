// =====================
// 剧本杀 - 浏览器端连接（自动重连 + 断线恢复 + 存活检测）
// =====================

import type { ClientMsg, ServerMsg } from './protocol'
import { MYSTERY_WS_PATH } from './protocol'

type Handler = (msg: ServerMsg) => void
type StatusHandler = (online: boolean) => void

const SESSION_KEY = 'mystery:session'
const PING_EVERY_MS = 20_000
/** 这么久没收到任何消息（含 PONG），就认定连接已经"半开"，主动重连 */
const STALE_AFTER_MS = 50_000
/** 切回页面 / 网络恢复时，超过这么久没消息就先探测一下 */
const PROBE_AFTER_MS = 15_000
const PROBE_TIMEOUT_MS = 5_000

/** paused：玩家主动离开了一局进行中的游戏；不自动恢复，但入口页会提供"回到房间" */
export type SavedSession = { code: string; token: string; paused?: boolean }

export function loadSession(): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedSession
    return s && typeof s.code === 'string' && typeof s.token === 'string' ? { code: s.code, token: s.token, paused: !!s.paused } : null
  } catch {
    return null
  }
}

export function saveSession(s: SavedSession | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch { /* 隐私模式等情况下忽略 */ }
}

export class MysteryClient {
  private ws: WebSocket | null = null
  private handlers = new Set<Handler>()
  private statusHandlers = new Set<StatusHandler>()
  /** 只缓存"进房意图"（CREATE / JOIN），且只留最后一条；游戏操作离线时不缓存 */
  private pendingIntent: ClientMsg | null = null
  private retry = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private probeTimer: ReturnType<typeof setTimeout> | null = null
  private lastMessageAt = 0
  private closedByUser = false
  private listening = false
  /** 重连成功后自动发送（恢复身份） */
  resumeWith: SavedSession | null = null

  connect() {
    this.closedByUser = false
    this.listen()
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}${MYSTERY_WS_PATH}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.retry = 0
      this.lastMessageAt = Date.now()
      this.emitStatus(true)
      if (this.resumeWith) this.rawSend({ type: 'RESUME', code: this.resumeWith.code, token: this.resumeWith.token })
      if (this.pendingIntent) {
        this.rawSend(this.pendingIntent)
        this.pendingIntent = null
      }
      if (this.pingTimer) clearInterval(this.pingTimer)
      this.pingTimer = setInterval(() => this.heartbeat(), PING_EVERY_MS)
    }
    ws.onmessage = (ev) => {
      this.lastMessageAt = Date.now()
      let msg: ServerMsg
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      for (const h of this.handlers) h(msg)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.stopTimers()
      this.emitStatus(false)
      if (!this.closedByUser) this.scheduleReconnect()
    }
    ws.onerror = () => { /* onclose 会接着触发 */ }
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * 发送消息。返回 false 表示没有发出（离线时的游戏操作直接丢弃，不排队：
   * 重连后再补发，可能落到已经推进的新阶段上）。
   */
  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.rawSend(msg)
      return true
    }
    if (msg.type === 'CREATE' || msg.type === 'JOIN') {
      this.pendingIntent = msg
      this.connect()
      return true
    }
    if (msg.type === 'RESUME') {
      // 连上后由 onopen 按 resumeWith 自动发送
      this.connect()
      return true
    }
    this.connect()
    return false
  }

  onMessage(h: Handler) {
    this.handlers.add(h)
    return () => { this.handlers.delete(h) }
  }

  onStatus(h: StatusHandler) {
    this.statusHandlers.add(h)
    return () => { this.statusHandlers.delete(h) }
  }

  close() {
    this.closedByUser = true
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.stopTimers()
    this.pendingIntent = null
    this.ws?.close()
    this.ws = null
  }

  private heartbeat() {
    if (Date.now() - this.lastMessageAt > STALE_AFTER_MS) {
      this.forceReconnect()
      return
    }
    this.rawSend({ type: 'PING' })
  }

  /** 切回页面 / 网络恢复：连接若已断就立刻重连；若很久没消息就探测一下 */
  private probe = () => {
    if (this.closedByUser) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.retry = 0
      this.connect()
      return
    }
    if (this.ws.readyState !== WebSocket.OPEN || Date.now() - this.lastMessageAt < PROBE_AFTER_MS) return
    const sentAt = Date.now()
    this.rawSend({ type: 'PING' })
    if (this.probeTimer) clearTimeout(this.probeTimer)
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null
      if (this.lastMessageAt < sentAt) this.forceReconnect()
    }, PROBE_TIMEOUT_MS)
  }

  /** 丢掉疑似半开的连接，立刻重连（RESUME 会恢复身份） */
  private forceReconnect() {
    const old = this.ws
    this.ws = null
    this.stopTimers()
    if (old) {
      old.onclose = null
      old.onmessage = null
      try { old.close() } catch { /* 忽略 */ }
    }
    this.emitStatus(false)
    this.retry = 0
    if (!this.closedByUser) this.connect()
  }

  private listen() {
    if (this.listening || typeof window === 'undefined') return
    this.listening = true
    window.addEventListener('online', this.probe)
    document.addEventListener('visibilitychange', this.probe)
  }

  private stopTimers() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.probeTimer) { clearTimeout(this.probeTimer); this.probeTimer = null }
  }

  private rawSend(msg: ClientMsg) {
    try { this.ws?.send(JSON.stringify(msg)) } catch { /* 忽略 */ }
  }

  private emitStatus(online: boolean) {
    for (const h of this.statusHandlers) h(online)
  }

  private scheduleReconnect() {
    if (this.retryTimer) return
    const delay = Math.min(10_000, 800 * 2 ** this.retry)
    this.retry++
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.connect()
    }, delay)
  }
}
