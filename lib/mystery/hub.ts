// =====================
// 剧本杀 - 多房间联机中枢（服务端）
// 每个房间 2 个座位；服务器上的引擎就是 DM。
// =====================

import type { WebSocket } from 'ws'
import { randomUUID } from 'crypto'
import type { Seat, GameState } from '@/engine/mystery/types'
import { SEATS } from '@/engine/mystery/types'
import { createGame, reduce, tick, nextDeadline, viewFor, joinSeat, setPresence, vacateSeat, abandonSeat } from '@/engine/mystery/engine'
import type { ClientMsg, ServerMsg } from './protocol'
import { makeRoomCode, normalizeRoomCode, sanitizeName } from './protocol'

type SeatConn = {
  name: string
  token: string
  ws: WebSocket | null
  /** 掉线时刻（在线时为 null） */
  offlineSince: number | null
  /** 上一次发给这个座位的视图（去掉 serverNow）：没变就不发，否则"多收到一份一样的视图"会暴露对方的私密操作 */
  lastView: string | null
  /** 已彻底放弃（只告诉对方一次） */
  abandoned?: boolean
}

type Room = {
  code: string
  state: GameState
  seats: Partial<Record<Seat, SeatConn>>
  timer: ReturnType<typeof setTimeout> | null
  lastActivity: number
  /** 定时推进连续出错次数（退避重试用） */
  tickFailures: number
}

/** 每个连接的限流状态（只在 socket 真正关闭时清除） */
type ConnRate = {
  windowStart: number
  count: number
  warned: boolean
  creates: number[]
  joinFails: number[]
}

const GAME_IDLE_MS = 6 * 60 * 60 * 1000 // 已开局、无人在线：6 小时后回收（留给断线恢复）
const LOBBY_IDLE_MS = 10 * 60 * 1000 // 还在大厅、无人在线：10 分钟后回收
const FORCE_IDLE_MS = 5 * 60 * 1000 // 房间数到上限时：无人在线超过 5 分钟的一律回收
const LOBBY_RECLAIM_MS = 60 * 1000 // 大厅里掉线超过 1 分钟的座位，新玩家可以补位
const SWEEP_EVERY_MS = 60 * 1000
const MAX_ROOMS = 500
const MSG_BURST = 30 // 每个连接每秒最多处理的消息数
const CREATE_PER_MIN = 5 // 每个连接每分钟最多建房次数
const JOIN_FAILS_PER_MIN = 10 // 每个连接每分钟最多加入失败次数（防止扫房间号）
const TICK_MAX_RETRIES = 5
/** 同一 IP（换连接也算）每分钟的上限：家庭网络多人共用一个出口，所以比单连接宽松 */
const CREATE_PER_IP_MIN = 20
const JOIN_FAILS_PER_IP_MIN = 30
/** 跨阶段都合法的操作：不做阶段号检查 */
const STEP_FREE_ACTIONS = new Set(['chat', 'publish', 'give', 'caseFile'])

export class MysteryHub {
  private rooms = new Map<string, Room>()
  private wsRoom = new Map<WebSocket, { code: string; seat: Seat }>()
  private rate = new Map<WebSocket, ConnRate>()
  private ipOf = new Map<WebSocket, string>()
  private ipEvents = new Map<string, { creates: number[]; joinFails: number[] }>()
  private sweeper: ReturnType<typeof setInterval>

  constructor(private now: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_EVERY_MS)
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

  /** 新连接：记下来源 IP（建房、加入失败按 IP 计数，换连接也绕不过去） */
  attach(ws: WebSocket, ip: string) {
    this.ipOf.set(ws, ip || 'unknown')
  }

  /** socket 真正关闭（close / error）：标记离线并清掉限流记录 */
  handleClose(ws: WebSocket) {
    this.handleDisconnect(ws)
    this.rate.delete(ws)
    this.ipOf.delete(ws)
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
        if (typeof msg.name !== 'string') return this.send(ws, { type: 'ERROR', message: '请输入昵称' })
        this.create(ws, msg.name)
        return
      case 'JOIN':
        if (typeof msg.name !== 'string' || typeof msg.code !== 'string') return this.send(ws, { type: 'ERROR', message: '请输入昵称和房间号' })
        this.join(ws, msg.code, msg.name)
        return
      case 'RESUME':
        this.resume(ws, msg.code, msg.token)
        return
      case 'LEAVE':
        this.leave(ws)
        return
      case 'ABANDON':
        this.abandon(ws, msg.code, msg.token, !!msg.final)
        return
      case 'ACT': {
        const ref = this.wsRoom.get(ws)
        if (!ref) {
          this.send(ws, { type: 'ERROR', message: '尚未加入房间' })
          return
        }
        const room = this.rooms.get(ref.code)
        if (!room) return
        const action = msg.action
        if (!action || typeof action !== 'object') {
          this.send(ws, { type: 'ERROR', message: '无效操作' })
          return
        }
        // 操作发出时的阶段已经过去（双击、网络迟到）：作废，不能落到新阶段上。
        // 聊天、公开、交出、递交案卷跨阶段都合法（引擎自己会校验），不检查
        if (typeof msg.at === 'number' && msg.at !== room.state.stepIndex && !STEP_FREE_ACTIONS.has(String(action.type))) {
          this.send(ws, { type: 'ERROR', message: '阶段已经推进，刚才的操作没有生效', reason: 'stale', action: String(action.type) })
          return
        }
        const result = reduce(room.state, ref.seat, action, this.now())
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

  /** 连接断开（或被别的房间占用）：座位保留，等待用令牌恢复 */
  handleDisconnect(ws: WebSocket) {
    const ref = this.wsRoom.get(ws)
    if (!ref) return
    this.wsRoom.delete(ws)
    const room = this.rooms.get(ref.code)
    if (!room) return
    const conn = room.seats[ref.seat]
    if (conn && conn.ws === ws) {
      conn.ws = null
      conn.offlineSince = this.now()
      room.state = setPresence(room.state, ref.seat, false, this.now())
      this.afterChange(room)
    }
  }

  /**
   * 玩家主动离开：
   * - 大厅里：让出座位（别人可以补位）；房间空了就删除
   * - 开局后：座位保留，原设备凭令牌随时可以回来
   */
  private leave(ws: WebSocket) {
    const ref = this.wsRoom.get(ws)
    if (!ref) return
    this.wsRoom.delete(ws)
    const room = this.rooms.get(ref.code)
    if (!room) return
    const conn = room.seats[ref.seat]
    if (!conn || conn.ws !== ws) return
    const now = this.now()
    // 以服务器的状态为准告诉客户端：座位是让出了，还是保留着（客户端据此决定删不删本地令牌）
    const vacated = room.state.stepIndex === -1
    this.send(ws, { type: 'LEFT', code: room.code, vacated })
    if (vacated) {
      delete room.seats[ref.seat]
      room.state = vacateSeat(room.state, ref.seat, now)
      if (SEATS.every(s => !room.seats[s])) {
        this.dropRoom(room)
        return
      }
    } else {
      conn.ws = null
      conn.offlineSince = now
      room.state = setPresence(room.state, ref.seat, false, now, 'left')
    }
    this.afterChange(room)
  }

  /**
   * 凭令牌放弃一个座位（这个座位不在本连接上）。不绑定连接、不发 WELCOME、不改在线状态，
   * 所以不会顶掉正在用这个座位的另一个标签页；回复与房间是否存在无关（不能拿来探测房间号）。
   */
  private abandon(ws: WebSocket, rawCode: unknown, token: unknown, final: boolean) {
    const code = typeof rawCode === 'string' ? normalizeRoomCode(rawCode) : ''
    const room = code ? this.rooms.get(code) : undefined
    const seat = room && typeof token === 'string' && token ? SEATS.find(s => room.seats[s]?.token === token) : undefined
    if (!room || !seat) {
      // 房间不在了 / 令牌已失效：你已经不持有座位
      this.send(ws, { type: 'LEFT', code, vacated: true })
      return
    }
    const conn = room.seats[seat]!
    if (conn.ws === ws) {
      this.leave(ws)
      return
    }
    if (conn.ws) {
      // 座位正被别的连接（别的标签页）使用：不打扰它
      this.send(ws, { type: 'LEFT', code, vacated: false, busy: true })
      return
    }
    const now = this.now()
    if (room.state.stepIndex === -1) {
      this.send(ws, { type: 'LEFT', code, vacated: true })
      delete room.seats[seat]
      room.state = vacateSeat(room.state, seat, now)
      if (SEATS.every(s => !room.seats[s])) {
        this.dropRoom(room)
        return
      }
      this.afterChange(room)
      return
    }
    this.send(ws, { type: 'LEFT', code, vacated: false })
    if (final && !conn.abandoned) {
      conn.abandoned = true
      room.state = abandonSeat(room.state, seat, now)
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
    const r = this.rateOf(ws)
    const now = this.now()
    r.creates = r.creates.filter(t => now - t < 60_000)
    const ip = this.ipEventsOf(ws)
    ip.creates = ip.creates.filter(t => now - t < 60_000)
    if (r.creates.length >= CREATE_PER_MIN || ip.creates.length >= CREATE_PER_IP_MIN) {
      this.send(ws, { type: 'ERROR', message: '建房太频繁，请稍后再试', reason: 'rate' })
      return
    }
    if (this.rooms.size >= MAX_ROOMS) this.sweep(true)
    if (this.rooms.size >= MAX_ROOMS) {
      this.send(ws, { type: 'ERROR', message: '服务器房间已满，请稍后再试' })
      return
    }
    let code = makeRoomCode()
    for (let i = 0; i < 50 && this.rooms.has(code); i++) code = makeRoomCode()
    if (this.rooms.has(code)) {
      this.send(ws, { type: 'ERROR', message: '生成房间号失败，请重试' })
      return
    }
    r.creates.push(now)
    ip.creates.push(now)
    this.leave(ws)
    const seed = Math.floor(Math.random() * 0x7fffffff)
    const room: Room = {
      code,
      state: createGame(code, seed, now),
      seats: {},
      timer: null,
      lastActivity: now,
      tickFailures: 0,
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
    const r = this.rateOf(ws)
    const now = this.now()
    r.joinFails = r.joinFails.filter(t => now - t < 60_000)
    const ip = this.ipEventsOf(ws)
    ip.joinFails = ip.joinFails.filter(t => now - t < 60_000)
    if (r.joinFails.length >= JOIN_FAILS_PER_MIN || ip.joinFails.length >= JOIN_FAILS_PER_IP_MIN) {
      this.send(ws, { type: 'ERROR', message: '尝试太频繁，请一分钟后再试', reason: 'rate' })
      return
    }
    const fail = () => { r.joinFails.push(now); ip.joinFails.push(now) }
    const room = this.rooms.get(code)
    if (!room) {
      fail()
      this.send(ws, { type: 'ERROR', message: '房间不存在，请检查房间号' })
      return
    }
    const ref = this.wsRoom.get(ws)
    if (ref && ref.code === code) {
      // 已经在这个房间里了：重发一次身份与画面
      this.welcomeAgain(room, ref.seat, ws)
      return
    }
    let seat = SEATS.find(s => !room.seats[s])
    if (!seat && room.state.stepIndex === -1) {
      // 大厅里掉线太久的座位让给新玩家（开局后不允许：那会看到别人的私密剧本）
      seat = SEATS.find(s => {
        const c = room.seats[s]
        return !!c && !c.ws && c.offlineSince !== null && now - c.offlineSince > LOBBY_RECLAIM_MS
      })
      if (seat) {
        delete room.seats[seat]
        room.state = vacateSeat(room.state, seat, now)
      }
    }
    if (!seat) {
      fail()
      this.send(ws, { type: 'ERROR', message: '房间已满（本剧本限 2 人）。若你是掉线的玩家，请用原设备重新打开本页，会自动恢复。' })
      return
    }
    this.leave(ws)
    this.seat(room, seat, name, ws)
  }

  // ── 断线恢复 ──
  private resume(ws: WebSocket, rawCode: unknown, token: unknown) {
    if (typeof rawCode !== 'string' || typeof token !== 'string' || !token) {
      this.send(ws, { type: 'ERROR', message: '身份信息无效，无法恢复', fatal: true, reason: 'auth' })
      return
    }
    const code = normalizeRoomCode(rawCode)
    const room = this.rooms.get(code)
    if (!room) {
      this.send(ws, { type: 'ERROR', message: '房间已失效', fatal: true, reason: 'expired' })
      return
    }
    const seat = SEATS.find(s => room.seats[s]?.token === token)
    if (!seat) {
      this.send(ws, { type: 'ERROR', message: '身份校验失败，无法恢复', fatal: true, reason: 'auth' })
      return
    }
    const conn = room.seats[seat]!
    if (conn.ws === ws) {
      // 同一个连接重复 RESUME：不改在线状态，只重发身份与画面
      this.welcomeAgain(room, seat, ws)
      return
    }
    // 校验都通过之后才离开别的房间
    this.leave(ws)
    if (conn.ws) {
      // 同一身份的旧连接被顶替
      const old = conn.ws
      this.wsRoom.delete(old)
      this.send(old, { type: 'ERROR', message: '你已在其它窗口重新连接', fatal: true, reason: 'superseded' })
      try { old.close() } catch { /* 忽略 */ }
    }
    conn.ws = ws
    conn.offlineSince = null
    conn.lastView = null
    conn.abandoned = false
    this.wsRoom.set(ws, { code, seat })
    this.send(ws, { type: 'WELCOME', code, seat, token: conn.token })
    room.state = setPresence(room.state, seat, true, this.now())
    this.afterChange(room)
  }

  private welcomeAgain(room: Room, seat: Seat, ws: WebSocket) {
    const conn = room.seats[seat]
    if (!conn) return
    this.send(ws, { type: 'WELCOME', code: room.code, seat, token: conn.token })
    conn.lastView = null
    this.sendView(room, seat)
  }

  private seat(room: Room, seat: Seat, name: string, ws: WebSocket) {
    const token = randomUUID()
    room.seats[seat] = { name, token, ws, offlineSince: null, lastView: null }
    this.wsRoom.set(ws, { code: room.code, seat })
    this.send(ws, { type: 'WELCOME', code: room.code, seat, token })
    room.state = joinSeat(room.state, seat, name, this.now())
    this.afterChange(room)
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
    if (!this.rooms.has(room.code)) return
    const deadline = nextDeadline(room.state)
    if (deadline === null) return
    const delay = Math.max(0, Math.min(deadline - this.now(), 2 ** 31 - 1))
    room.timer = setTimeout(() => this.onTimer(room), delay + 20)
  }

  /** 到点推进。出错不能拖垮进程：记日志、通知房间、退避后重试 */
  private onTimer(room: Room) {
    room.timer = null
    try {
      const next = tick(room.state, this.now())
      room.tickFailures = 0
      if (next !== room.state) {
        room.state = next
        this.afterChange(room)
      } else {
        this.schedule(room)
      }
    } catch (err) {
      room.tickFailures++
      console.error(`[mystery] 房间 ${room.code} 定时推进出错（第 ${room.tickFailures} 次）`, err)
      for (const s of SEATS) {
        const ws = room.seats[s]?.ws
        if (ws) this.send(ws, { type: 'ERROR', message: '服务器推进阶段时出错，正在重试' })
      }
      if (room.tickFailures <= TICK_MAX_RETRIES && this.rooms.has(room.code)) {
        room.timer = setTimeout(() => this.onTimer(room), 2000 * room.tickFailures)
      }
    }
  }

  private broadcastViews(room: Room) {
    for (const seat of SEATS) this.sendView(room, seat)
  }

  /** 只在这个座位的视图真的变了时才发（对方的私密操作不能让你"多收到一份"） */
  private sendView(room: Room, seat: Seat) {
    const conn = room.seats[seat]
    if (!conn?.ws) return
    const view = viewFor(room.state, seat, this.now())
    const key = JSON.stringify({ ...view, step: { ...view.step, serverNow: 0 } })
    if (key === conn.lastView) return
    conn.lastView = key
    this.send(conn.ws, { type: 'VIEW', view })
  }

  private dropRoom(room: Room) {
    if (room.timer) clearTimeout(room.timer)
    room.timer = null
    this.rooms.delete(room.code)
  }

  private sweep(force = false) {
    const now = this.now()
    for (const [ip, e] of this.ipEvents) {
      e.creates = e.creates.filter(t => now - t < 60_000)
      e.joinFails = e.joinFails.filter(t => now - t < 60_000)
      if (!e.creates.length && !e.joinFails.length) this.ipEvents.delete(ip)
    }
    for (const room of [...this.rooms.values()]) {
      const online = SEATS.some(s => room.seats[s]?.ws)
      if (online) continue
      const idle = now - room.lastActivity
      const limit = force ? FORCE_IDLE_MS : room.state.stepIndex === -1 ? LOBBY_IDLE_MS : GAME_IDLE_MS
      if (idle > limit) this.dropRoom(room)
    }
  }

  private ipEventsOf(ws: WebSocket) {
    const ip = this.ipOf.get(ws) ?? 'unknown'
    let e = this.ipEvents.get(ip)
    if (!e) {
      e = { creates: [], joinFails: [] }
      this.ipEvents.set(ip, e)
    }
    return e
  }

  private rateOf(ws: WebSocket): ConnRate {
    let r = this.rate.get(ws)
    if (!r) {
      r = { windowStart: this.now(), count: 0, warned: false, creates: [], joinFails: [] }
      this.rate.set(ws, r)
    }
    return r
  }

  private allow(ws: WebSocket): boolean {
    const now = this.now()
    const r = this.rateOf(ws)
    if (now - r.windowStart > 1000) {
      r.windowStart = now
      r.count = 0
      r.warned = false
    }
    r.count++
    if (r.count <= MSG_BURST) return true
    // 超限：不静默丢弃，告诉客户端（每个窗口只提示一次）
    if (!r.warned) {
      r.warned = true
      this.send(ws, { type: 'ERROR', message: '操作太频繁，请稍后再试', reason: 'rate' })
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
