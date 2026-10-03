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

test('大厅里离线点「离开」：令牌先保留，连上后发 ABANDON；服务器确认让出座位后才删除', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(store.getState().paused).toBeNull() // 大厅不显示"回到房间"
  last().open()
  expect(last().sent).toEqual([{ type: 'ABANDON', code: 'ABCD', token: 't', final: false }])
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  expect(session()).toBeNull()
})

test('离开时服务器说座位还保留（恰好开局了）：令牌留着，入口页可以回来', () => {
  const store = fresh()
  store.getState().init()
  last().open()
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  store.getState().leave()
  expect(last().sent.at(-1)).toEqual({ type: 'LEAVE' })
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: false })
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(store.getState().paused?.code).toBe('ABCD')
})

test('放弃请求发出后、确认前断线：每次重连都重发，直到服务器确认', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['ABANDON'])
  last().drop()
  jest.advanceTimersByTime(1000)
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['ABANDON'])
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: false, token: 't' })
  last().drop()
  jest.advanceTimersByTime(1000)
  last().open()
  expect(last().sent).toEqual([]) // 已确认，不再重发
  expect(store.getState().paused?.code).toBe('ABCD')
})

test('离线点「离开」后又改主意「回到房间」：撤回放弃，只发 RESUME', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  store.getState().resume()
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['RESUME'])
  last().reply({ type: 'WELCOME', code: 'ABCD', seat: 'P1', token: 't' })
  expect(store.getState().joined).toBe(true)
})

test('离线点「离开」后又去建新房：放弃旧座位照常发出，且排在建房之前', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  store.getState().create('甲')
  last().open()
  expect(last().sent.map(m => m.type)).toEqual(['ABANDON', 'CREATE'])
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  last().reply({ type: 'WELCOME', code: 'NEW1', seat: 'P1', token: 'n' })
  expect(store.getState().code).toBe('NEW1')
  expect(session()).toEqual({ code: 'NEW1', token: 'n' })
})

test('令牌已失效（座位被补位 / 房间回收）：服务器回 vacated，删掉本地令牌，没有错误提示', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  last().open()
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  expect(session()).toBeNull()
  expect(store.getState().paused).toBeNull()
  expect(store.getState().toasts).toHaveLength(0)
})

test('入口页「放弃这局」发 ABANDON(final)，而不只是删本地令牌', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't', paused: true }))
  const store = fresh()
  store.getState().init()
  expect(store.getState().paused?.code).toBe('ABCD')
  last().open()
  store.getState().forget()
  expect(last().sent).toEqual([{ type: 'ABANDON', code: 'ABCD', token: 't', final: true }])
  expect(session()).toBeNull()
})

test('另一个标签页已经回到这局时，这边点「放弃这局」什么都不做', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't', paused: true }))
  const store = fresh()
  store.getState().init()
  last().open()
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
  store.getState().forget()
  expect(last().sent).toEqual([])
  expect(session()).toEqual({ code: 'ABCD', token: 't' })
})

test('另一个标签页在玩别的房间时，这边点「放弃这局」不会删掉它的令牌', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't', paused: true }))
  const store = fresh()
  store.getState().init()
  last().open()
  mem.set('mystery:session', JSON.stringify({ code: 'WXYZ', token: 'other' }))
  store.getState().forget()
  expect(last().sent).toEqual([{ type: 'ABANDON', code: 'ABCD', token: 't', final: true }])
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  expect(session()).toEqual({ code: 'WXYZ', token: 'other' })
})

test('座位还挂着旧连接（busy）：服务器接管，不再重发；服务器稍后通知让出时删除令牌', () => {
  const store = joinedOffline('lobby')
  store.getState().leave()
  last().open()
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: false, busy: true, token: 't' })
  expect(session()).toEqual({ code: 'ABCD', token: 't', paused: true })
  // 服务器回收旧连接后执行放弃，通知本连接
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  expect(session()).toBeNull()
  last().drop()
  jest.advanceTimersByTime(1000)
  last().open()
  expect(last().sent).toEqual([])
})

test('同一房间号、不同令牌的回复不会误删当前令牌', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  // 本地已是新令牌 t2 的暂离会话（比如重新加入过）
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't2', paused: true }))
  last().open()
  last().reply({ type: 'LEFT', code: 'ABCD', vacated: true, token: 't' })
  expect(session()).toEqual({ code: 'ABCD', token: 't2', paused: true })
  void store
})

test('排队的放弃在发送前复查：别的标签页已经凭这枚令牌回到座位，就不发', () => {
  const store = joinedOffline('read')
  store.getState().leave()
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' })) // 别的标签页恢复了
  last().open()
  expect(last().sent.map(m => m.type)).not.toContain('ABANDON')
  void store
})
