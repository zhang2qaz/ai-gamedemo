// =====================
// 弈战 - WebSocket 客户端
// =====================

import type { ClientMessage, ServerMessage } from './protocol'

type MessageHandler = (msg: ServerMessage) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers: MessageHandler[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string = ''
  private _connected = false

  get connected() { return this._connected }

  connect(host: string, port: number): Promise<void> {
    // 自动选择 ws/wss：HTTPS 页面必须用 wss
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const proto = isHttps ? 'wss' : 'ws'
    // HTTPS 默认 443、HTTP 默认 80 — 都不需要写在 URL 里
    const portStr = (isHttps && port === 443) || (!isHttps && port === 80) ? '' : `:${port}`
    this.url = `${proto}://${host}${portStr}/ws`
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this._connected = true
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as ServerMessage
            for (const h of this.handlers) h(msg)
          } catch { /* 忽略解析错误 */ }
        }

        this.ws.onclose = () => {
          this._connected = false
          this.scheduleReconnect()
        }

        this.ws.onerror = () => {
          this._connected = false
          reject(new Error('连接失败'))
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this._connected = false
    this.handlers = []
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this._connected && this.url) {
        const u = new URL(this.url)
        const isWss = u.protocol === 'wss:'
        const port = u.port ? parseInt(u.port) : (isWss ? 443 : 80)
        this.connect(u.hostname, port).catch(() => { /* 静默重试 */ })
      }
    }, 3000)
  }
}

// 单例
export const wsClient = new WsClient()
