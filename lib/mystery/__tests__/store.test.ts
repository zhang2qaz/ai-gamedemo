// 客户端状态：离开房间时令牌的去留由服务器确认决定；离线时的"离开"在连上后补发；
// 补发途中断线、令牌失效、多标签页等边界情况
import type { ClientMsg } from '../protocol'
import type { SeatView } from '../../../engine/mystery/types'

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
  drop() { this.readyState = 3; this.onclose?.() }
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

type Store = typeof import('../../../store/mysteryStore')['useMysteryStore']

/** 每个测试一份全新的 store + 连接（它们都是模块级单例） */
function fresh(): Store {
  let store!: Store
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = (require('../../../store/mysteryStore') as typeof import('../../../store/mysteryStore')).useMysteryStore
  })
  return store
}

const fakeView = (kind: string) => ({ code: 'ABCD', step: { kind, index: kind === 'lobby' ? -1 : 3 }, result: null }) as unknown as SeatView
const session = () => (mem.has('mystery:session') ? JSON.parse(mem.get('mystery:session')!) : null)
const last = () => FakeWS.all[FakeWS.all.length - 1]

/** 已在房间里、连接已断开（离线） */
function joinedOffline(kind: string) {
  const store = fresh()
  store.getState().init() // 有会话 → 发起恢复，建立第一条连接
  last().open()
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  last().reply({ type: 'VIEW', view: { ...fakeView(kind), step: { ...fakeView(kind).step, serverNow: Date.now() } } })
  expect(store.getState().joined).toBe(true)
  last().drop()
  return store
}

beforeEach(() => {
  jest.useFakeTimers()
  mem.clear()
  FakeWS.all = []
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
})
afterEach(() => jest.useRealTimers())

test('大厅里离线点「离开」：令牌先保留，连上后凭令牌补发离开；服务器确认让出座位后才删除', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(store.getState().paused).toBeNull() // 大厅不显示"回到房间"
  last().open()
  expect(last().sent.slice(0, 2).map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  // 服务器先恢复身份（不能把画面拉回去），再确认座位已让出
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  expect(store.getState().joined).toBe(false)
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true })
  expect(session()).toBeNull()
})

test('离开时服务器说座位还保留（恰好开局了）：令牌留着，入口页可以回来', () => {
  const store = fresh()
  store.getState().init()
  last().open()
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  store.getState().leave()
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: false })
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(store.getState().paused?.code).toBe('ABCD')
})

test('离开请求发出后、确认前断线：重连会补发；之后玩家点「回到房间」不会被拦住', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  expect(store.getState().paused?.code).toBe('ABCD')
  // 连上：补发 RESUME + LEAVE，还没回包又断了
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  last().drop()
  // 重连（退避后）：离开会再补发一次
  jest.advanceTimersByTime(1000)
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: false })
  // 玩家改主意点「回到房间」：WELCOME 必须被接受
  store.getState().resume()
  expect(last().sent.at(-1)?.type).toBe('RESUME')
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  expect(store.getState().joined).toBe(true)
})

test('补发离开前断线、随后玩家直接点「回到房间」：不再补发离开，WELCOME 照常接受', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  store.getState().resume() // 还没连上就改主意
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['RESUME'])
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  expect(store.getState().joined).toBe(true)
})

test('补发离开时令牌已失效（座位被补位 / 房间回收）：本地令牌一并删掉，不留失效的「回到房间」', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  last().open()
  last().reply({ type: 'ERROR', message: '身份校验失败，无法恢复', fatal: true, reason: 'auth' })
  expect(session()).toBeNull()
  expect(store.getState().paused).toBeNull()
  expect(store.getState().toasts).toHaveLength(0)
})

test('入口页「放弃这局」会通知服务器（凭令牌离开），而不只是删本地令牌', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't', paused: true }))
  const store = fresh()
  store.getState().init()
  expect(store.getState().paused?.code).toBe('ABCD')
  last().open()
  store.getState().forget()
  expect(last().sent.map(m => m.type)).toEqual(['RESUME', 'LEAVE'])
  expect(session()).toBeNull()
})

test('另一个标签页已经回到这局时，这边点「放弃这局」不会顶掉它', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't', paused: true }))
  const store = fresh()
  store.getState().init()
  last().open()
  // 别的标签页恢复了这局：共享会话不再是"暂离"
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
  store.getState().forget()
  expect(last().sent).toEqual([])
  expect(session()).toEqual({ code: 'ABCD', token: 't' })
})
