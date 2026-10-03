// =====================
// 剧本杀 - 浏览器端连接（自动重连 + 断线恢复 + 存活检测）
// =====================

import type { ClientMsg, ServerMsg } from './protocol'
import { MYSTERY_WS_PATH } from './protocol'

type Handler = (msg: ServerMsg) => void
type StatusHandler = (online: boolean) => void

const SESSION_KEY = 'mystery:session'
const PING_EVERY_MS = 20_000
/**
 * 发出 PING 之后这么久没有任何回包，才认定连接"半开"、主动重连。
 * 只看"上一个 PING 有没有回应"，不看距上一条消息多久：后台标签页的定时器会被浏览器节流到每分钟一次，
 * 按绝对时间判断会把健康的连接误判成断线、反复重连。
 */
const PONG_TIMEOUT_MS = 10_000
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
  /** 收到的消息总数（判断"发出 PING 之后有没有任何回包"，不依赖时钟精度） */
  private received = 0
  /** 最近一次心跳 PING：发出时刻与当时的消息计数（null = 没有在等回应） */
  private pendingPing: { at: number; received: number } | null = null
  private closedByUser = false
  private listening = false
  /** 重连成功后自动发送（恢复身份） */
  resumeWith: SavedSession | null = null
  /** 离线时没能发出的"离开"：连上后先凭令牌恢复身份、再离开，由服务器的 LEFT 决定令牌删不删 */
  private leaveOnReconnect: SavedSession | null = null

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
      this.pendingPing = null
      this.emitStatus(true)
      if (this.leaveOnReconnect) {
        const l = this.leaveOnReconnect
        this.leaveOnReconnect = null
        this.rawSend({ type: 'RESUME', code: l.code, token: l.token })
        this.rawSend({ type: 'LEAVE' })
      }
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
      this.received++
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
    const now = Date.now()
    const p = this.pendingPing
    // 上一个 PING 发出后一直没有任何回包（PONG 或别的消息），而且已经等够了：判定为半开连接
    if (p && this.received === p.received && now - p.at > PONG_TIMEOUT_MS) {
      this.forceReconnect()
      return
    }
    this.pendingPing = { at: now, received: this.received }
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
    const before = this.received
    this.rawSend({ type: 'PING' })
    if (this.probeTimer) clearTimeout(this.probeTimer)
    this.probeTimer = setTimeout(() => {
      this.probeTimer = null
      if (this.received === before) this.forceReconnect()
    }, PROBE_TIMEOUT_MS)
  }

  /**
   * 凭令牌离开一个座位（让服务器真正让出 / 标记暂离）。在线就立刻发，离线就等连上后补发。
   * 用于：离线时点了「离开」、入口页点「放弃这局」。
   */
  leaveSession(s: SavedSession) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.rawSend({ type: 'RESUME', code: s.code, token: s.token })
      this.rawSend({ type: 'LEAVE' })
      return
    }
    this.leaveOnReconnect = { code: s.code, token: s.token }
    this.connect()
  }

  /** 取消尚未发出的建房 / 加入请求（改为恢复旧局时用，避免连上后两个请求先后执行） */
  cancelIntent() {
    this.pendingIntent = null
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
    this.pendingPing = null
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
