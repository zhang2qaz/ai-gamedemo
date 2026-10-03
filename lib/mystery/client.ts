// =====================
// 剧本杀 - 浏览器端连接（自动重连 + 断线恢复）
// =====================

import type { ClientMsg, ServerMsg } from './protocol'
import { MYSTERY_WS_PATH } from './protocol'

type Handler = (msg: ServerMsg) => void
type StatusHandler = (online: boolean) => void

const SESSION_KEY = 'mystery:session'

export type SavedSession = { code: string; token: string }

export function loadSession(): SavedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedSession
    return s && typeof s.code === 'string' && typeof s.token === 'string' ? s : null
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
  private queue: ClientMsg[] = []
  private retry = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private closedByUser = false
  /** 重连成功后自动发送（恢复身份） */
  resumeWith: SavedSession | null = null

  connect() {
    this.closedByUser = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}${MYSTERY_WS_PATH}`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      this.retry = 0
      this.emitStatus(true)
      if (this.resumeWith) this.rawSend({ type: 'RESUME', ...this.resumeWith })
      const pending = this.queue
      this.queue = []
      for (const m of pending) this.rawSend(m)
      if (this.pingTimer) clearInterval(this.pingTimer)
      this.pingTimer = setInterval(() => this.rawSend({ type: 'PING' }), 25_000)
    }
    ws.onmessage = (ev) => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      for (const h of this.handlers) h(msg)
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
      this.emitStatus(false)
      if (!this.closedByUser) this.scheduleReconnect()
    }
    ws.onerror = () => { /* onclose 会接着触发 */ }
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.rawSend(msg)
    else {
      this.queue.push(msg)
      this.connect()
    }
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
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    this.queue = []
    this.ws?.close()
    this.ws = null
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
