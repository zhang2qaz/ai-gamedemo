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
    this.url = `ws://${host}:${port}/ws`
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
        this.connect(
          new URL(this.url).hostname,
          parseInt(new URL(this.url).port)
        ).catch(() => { /* 静默重试 */ })
      }
    }, 3000)
  }
}

// 单例
export const wsClient = new WsClient()
