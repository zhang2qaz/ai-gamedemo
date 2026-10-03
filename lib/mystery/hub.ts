// =====================
// 剧本杀 - 多房间联机中枢（服务端）
// 每个房间 2 个座位；服务器上的引擎就是 DM。
// =====================

import type { WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import type { Seat, GameState } from '@/engine/mystery/types'
import { SEATS } from '@/engine/mystery/types'
import { createGame, reduce, tick, nextDeadline, viewFor, joinSeat, setPresence } from '@/engine/mystery/engine'
import type { ClientMsg, ServerMsg } from './protocol'
import { makeRoomCode, normalizeRoomCode, sanitizeName } from './protocol'

type SeatConn = {
  name: string
  token: string
  ws: WebSocket | null
}

type Room = {
  code: string
  state: GameState
  seats: Partial<Record<Seat, SeatConn>>
  timer: ReturnType<typeof setTimeout> | null
  lastActivity: number
}

const ROOM_IDLE_MS = 6 * 60 * 60 * 1000 // 无人在线 6 小时后回收
const MAX_ROOMS = 500
const MSG_BURST = 30 // 每个连接每秒最多处理的消息数

export class MysteryHub {
  private rooms = new Map<string, Room>()
  private wsRoom = new Map<WebSocket, { code: string; seat: Seat }>()
  private rate = new Map<WebSocket, { windowStart: number; count: number; warned: boolean }>()
  private sweeper: ReturnType<typeof setInterval>

  constructor(private now: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweep(), 10 * 60 * 1000)
    // 不阻止进程退出
    if (typeof this.sweeper === 'object' && 'unref' in this.sweeper) this.sweeper.unref()
  }

  get roomCount() { return this.rooms.size }

  handleMessage(ws: WebSocket, raw: string) {
    try {
      this.route(ws, raw)
    } catch (err) {
      // 单条消息出错不能拖垮整个房间
      console.error('[mystery] 处理消息出错', err)
      this.send(ws, { type: 'ERROR', message: '服务器处理出错，请重试' })
    }
  }

  private route(ws: WebSocket, raw: string) {
    if (!this.allow(ws)) return
    let msg: ClientMsg
    try {
      msg = JSON.parse(raw)
    } catch {
      this.send(ws, { type: 'ERROR', message: '无法解析消息' })
      return
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') return

    switch (msg.type) {
      case 'PING':
        this.send(ws, { type: 'PONG' })
        return
      case 'CREATE':
        this.create(ws, msg.name)
        return
      case 'JOIN':
        this.join(ws, msg.code, msg.name)
        return
      case 'RESUME':
        this.resume(ws, msg.code, msg.token)
        return
      case 'LEAVE':
        this.handleDisconnect(ws)
        return
      case 'ACT': {
        const ref = this.wsRoom.get(ws)
        if (!ref) {
          this.send(ws, { type: 'ERROR', message: '尚未加入房间' })
          return
        }
        const room = this.rooms.get(ref.code)
        if (!room) return
        const result = reduce(room.state, ref.seat, msg.action, this.now())
        if (result.error) {
          this.send(ws, { type: 'ERROR', message: result.error })
        }
        if (result.state !== room.state) {
          room.state = result.state
          this.afterChange(room)
        }
        return
      }
    }
  }

  handleDisconnect(ws: WebSocket) {
    this.rate.delete(ws)
    const ref = this.wsRoom.get(ws)
    if (!ref) return
    this.wsRoom.delete(ws)
    const room = this.rooms.get(ref.code)
    if (!room) return
    const conn = room.seats[ref.seat]
    if (conn && conn.ws === ws) {
      conn.ws = null
      room.state = setPresence(room.state, ref.seat, false, this.now())
      this.afterChange(room)
    }
  }

  // ── 建房 ──
  private create(ws: WebSocket, rawName: string) {
    const name = sanitizeName(rawName)
    if (!name) {
      this.send(ws, { type: 'ERROR', message: '请输入昵称' })
      return
    }
    if (this.rooms.size >= MAX_ROOMS) this.sweep(true)
    if (this.rooms.size >= MAX_ROOMS) {
      this.send(ws, { type: 'ERROR', message: '服务器房间已满，请稍后再试' })
      return
    }
    this.detach(ws)
    let code = makeRoomCode()
    for (let i = 0; i < 50 && this.rooms.has(code); i++) code = makeRoomCode()
    if (this.rooms.has(code)) {
      this.send(ws, { type: 'ERROR', message: '生成房间号失败，请重试' })
      return
    }
    const now = this.now()
    const seed = Math.floor(Math.random() * 0x7fffffff)
    const room: Room = {
      code,
      state: createGame(code, seed, now),
      seats: {},
      timer: null,
      lastActivity: now,
    }
    this.rooms.set(code, room)
    this.seat(room, 'P1', name, ws)
  }

  // ── 加入 ──
  private join(ws: WebSocket, rawCode: string, rawName: string) {
    const code = normalizeRoomCode(rawCode)
    const name = sanitizeName(rawName)
    if (!name) {
      this.send(ws, { type: 'ERROR', message: '请输入昵称' })
      return
    }
    const room = this.rooms.get(code)
    if (!room) {
      this.send(ws, { type: 'ERROR', message: '房间不存在，请检查房间号' })
      return
    }
    const free = SEATS.find(s => !room.seats[s])
    if (!free) {
      this.send(ws, { type: 'ERROR', message: '房间已满（本剧本限 2 人）。若你是掉线的玩家，请用原设备重新进入以自动恢复。' })
      return
    }
    this.detach(ws)
    this.seat(room, free, name, ws)
  }

  // ── 断线恢复 ──
  private resume(ws: WebSocket, rawCode: string, token: string) {
    const code = normalizeRoomCode(rawCode)
    const room = this.rooms.get(code)
    if (!room) {
      this.send(ws, { type: 'ERROR', message: '房间已失效', fatal: true })
      return
    }
    const seat = SEATS.find(s => room.seats[s]?.token === token)
    if (!seat) {
      this.send(ws, { type: 'ERROR', message: '身份校验失败，无法恢复', fatal: true })
      return
    }
    this.detach(ws)
    const conn = room.seats[seat]!
    if (conn.ws && conn.ws !== ws) {
      // 同一身份的旧连接被顶替
      const old = conn.ws
      this.wsRoom.delete(old)
      this.send(old, { type: 'ERROR', message: '你已在其它窗口重新连接', fatal: true })
      try { old.close() } catch { /* 忽略 */ }
    }
    conn.ws = ws
    this.wsRoom.set(ws, { code, seat })
    this.send(ws, { type: 'WELCOME', code, seat, token: conn.token })
    room.state = setPresence(room.state, seat, true, this.now())
    this.afterChange(room)
  }

  private seat(room: Room, seat: Seat, name: string, ws: WebSocket) {
    const token = randomUUID()
    room.seats[seat] = { name, token, ws }
    this.wsRoom.set(ws, { code: room.code, seat })
    this.send(ws, { type: 'WELCOME', code: room.code, seat, token })
    room.state = joinSeat(room.state, seat, name, this.now())
    this.afterChange(room)
  }

  // 一个连接同时只属于一个房间
  private detach(ws: WebSocket) {
    if (this.wsRoom.has(ws)) this.handleDisconnect(ws)
  }

  private afterChange(room: Room) {
    room.lastActivity = this.now()
    this.broadcastViews(room)
    this.schedule(room)
  }

  private schedule(room: Room) {
    if (room.timer) {
      clearTimeout(room.timer)
      room.timer = null
    }
    const deadline = nextDeadline(room.state)
    if (deadline === null) return
    const delay = Math.max(0, Math.min(deadline - this.now(), 2 ** 31 - 1))
    room.timer = setTimeout(() => {
      room.timer = null
      const next = tick(room.state, this.now())
      if (next !== room.state) {
        room.state = next
        this.afterChange(room)
      } else {
        this.schedule(room)
      }
    }, delay + 20)
  }

  private broadcastViews(room: Room) {
    const now = this.now()
    for (const seat of SEATS) {
      const conn = room.seats[seat]
      if (conn?.ws) this.send(conn.ws, { type: 'VIEW', view: viewFor(room.state, seat, now) })
    }
  }

  private sweep(force = false) {
    const now = this.now()
    for (const [code, room] of this.rooms) {
      const online = SEATS.some(s => room.seats[s]?.ws)
      const idle = now - room.lastActivity
      if (!online && (idle > ROOM_IDLE_MS || (force && idle > 30 * 60 * 1000))) {
        if (room.timer) clearTimeout(room.timer)
        this.rooms.delete(code)
      }
    }
  }

  private allow(ws: WebSocket): boolean {
    const now = this.now()
    const r = this.rate.get(ws)
    if (!r || now - r.windowStart > 1000) {
      this.rate.set(ws, { windowStart: now, count: 1, warned: false })
      return true
    }
    r.count++
    if (r.count <= MSG_BURST) return true
    // 超限：不静默丢弃，告诉客户端（每个窗口只提示一次）
    if (!r.warned) {
      r.warned = true
      this.send(ws, { type: 'ERROR', message: '操作太频繁，请稍后再试' })
    }
    return false
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)) } catch { /* 忽略发送失败 */ }
  }

  dispose() {
    clearInterval(this.sweeper)
    for (const room of this.rooms.values()) if (room.timer) clearTimeout(room.timer)
    this.rooms.clear()
  }
}
