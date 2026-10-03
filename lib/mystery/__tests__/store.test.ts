// 客户端状态：离开房间时令牌的去留由服务器确认决定；离线时的"离开"在连上后补发
import type { ClientMsg } from '../protocol'

const mem = new Map<string, string>()
class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static all: FakeWS[] = []
  readyState = 0
  sent: ClientMsg[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { FakeWS.all.push(this) }
  send(raw: string) { this.sent.push(JSON.parse(raw)) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
  reply(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }) }
}
const g = globalThis as Record<string, unknown>
g.WebSocket = FakeWS
g.window = {
  location: { protocol: 'http:', host: 'test' },
  addEventListener() {},
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } },
}
g.document = { visibilityState: 'visible', addEventListener() {} }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useMysteryStore } = require('../../../store/mysteryStore') as typeof import('../../../store/mysteryStore')
import type { SeatView } from '../../../engine/mystery/types'

const fakeView = (kind: string) => ({ code: 'ABCD', step: { kind, index: kind === 'lobby' ? -1 : 3 }, result: null }) as unknown as SeatView
const session = () => (mem.has('mystery:session') ? JSON.parse(mem.get('mystery:session')!) : null)
const ws = () => FakeWS.all[FakeWS.all.length - 1]

beforeEach(() => {
  mem.clear()
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
})

test('大厅里离线点「离开」：令牌先保留，连上后凭令牌补发离开；服务器确认让出座位后才删除', () => {
  useMysteryStore.getState().init() // 建立连接（尚未连上）
  useMysteryStore.setState({ joined: true, code: 'ABCD', view: fakeView('lobby'), resuming: false })
  useMysteryStore.getState().leave()
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(useMysteryStore.getState().paused).toBeNull() // 大厅不显示"回到房间"
  ws().open()
  expect(ws().sent.slice(0, 2).map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  // 服务器先恢复身份（不能把画面拉回去），再确认座位已让出
  ws().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  expect(useMysteryStore.getState().joined).toBe(false)
  ws().reply({ type: 'LEFT', code: 'ABCD', vacated: true })
  expect(session()).toBeNull()
})

test('离开时服务器说座位还保留（恰好开局了）：令牌留着，入口页可以回来', () => {
  useMysteryStore.setState({ joined: true, code: 'ABCD', view: fakeView('lobby'), paused: null })
  ws().readyState = 1
  useMysteryStore.getState().leave()
  ws().reply({ type: 'LEFT', code: 'ABCD', vacated: false })
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(useMysteryStore.getState().paused?.code).toBe('ABCD')
})

test('入口页「放弃这局」会通知服务器（凭令牌离开），而不只是删本地令牌', () => {
  useMysteryStore.setState({ joined: false, paused: { code: 'ABCD', token: 't', paused: true } })
  ws().readyState = 1
  const before = ws().sent.length
  useMysteryStore.getState().forget()
  expect(ws().sent.slice(before).map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  expect(session()).toBeNull()
})
