// 同一台设备开两个标签页（共用 localStorage）+ 另一台设备上的搭档，接真实的联机中枢。
// 消息经队列异步投递（和真实网络一样，不会在对方处理到一半时插进来）；
// 写 localStorage 会给各标签页派发 storage 事件。
import type { WebSocket as WsSocket } from 'ws'
import type { ClientMsg, ServerMsg } from '../protocol'

// ───────── 消息总线 ─────────
const queue: (() => void)[] = []
const flush = () => { for (let i = 0; queue.length && i < 10_000; i++) queue.shift()!() }

type Tab = { name: string; store: Store; sockets: FakeWS[] }

// ───────── 共享 localStorage + storage 事件 ─────────
const mem = new Map<string, string>()
/** 每个标签页各自注册的 storage 监听（关掉标签页就移除它自己的） */
const storageListeners: { tab: Tab | null; fn: (e: { key: string | null }) => void }[] = []
const emitStorage = () => queue.push(() => { for (const l of [...storageListeners]) l.fn({ key: 'mystery:session' }) })
const session = () => (mem.has('mystery:session') ? JSON.parse(mem.get('mystery:session')!) : null)

// ───────── 浏览器端的 WebSocket，桥接到中枢 ─────────
let creatingTab: Tab | null = null
let hub: import('../hub').MysteryHub

class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  server: WsSocket
  constructor() {
    creatingTab?.sockets.push(this)
    this.server = {
      send: (raw: string) => queue.push(() => { if (this.readyState === 1) this.onmessage?.({ data: raw }) }),
      close: () => queue.push(() => this.drop()),
    } as unknown as WsSocket
    // 连接建立是异步的
    queue.push(() => {
      if (this.readyState !== 0) return
      this.readyState = 1
      hub.attach(this.server, '10.0.0.1')
      this.onopen?.()
    })
  }
  send(raw: string) {
    queue.push(() => { if (this.readyState === 1) hub.handleMessage(this.server, raw) })
  }
  close() { this.drop() }
  drop() {
    if (this.readyState === 3) return
    this.readyState = 3
    hub.handleClose(this.server)
    this.onclose?.()
  }
}

const g = globalThis as Record<string, unknown>
g.WebSocket = FakeWS
g.window = {
  location: { protocol: 'http:', host: 'test', search: '' },
  addEventListener(type: string, fn: (e: { key: string | null }) => void) { if (type === 'storage') storageListeners.push({ tab: creatingTab, fn }) },
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); emitStorage() },
    removeItem: (k: string) => { mem.delete(k); emitStorage() },
  },
}
g.document = { visibilityState: 'visible', addEventListener() {} }

type Store = typeof import('../../../store/mysteryStore')['useMysteryStore']

/** 打开一个新标签页（全新的 store + 连接），执行页面挂载时的 init() */
function openTab(name: string): Tab {
  const tab: Tab = { name, store: null as unknown as Store, sockets: [] }
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tab.store = (require('../../../store/mysteryStore') as typeof import('../../../store/mysteryStore')).useMysteryStore
  })
  inTab(tab, () => tab.store.getState().init())
  return tab
}
function inTab(tab: Tab, fn: () => void) {
  creatingTab = tab
  try { fn() } finally { creatingTab = null }
  flush()
}
/** 关掉标签页：连接断开，之后不再重连 */
function closeTab(tab: Tab) {
  for (const s of tab.sockets) s.drop()
  tab.sockets.length = 0
  for (let i = storageListeners.length - 1; i >= 0; i--) if (storageListeners[i].tab === tab) storageListeners.splice(i, 1)
  flush()
}

// ───────── 另一台设备上的搭档（直接连中枢）─────────
type Partner = { ws: WsSocket; msgs: ServerMsg[] }
function partner(): Partner {
  const p: Partner = { ws: null as unknown as WsSocket, msgs: [] }
  p.ws = { send: (raw: string) => { p.msgs.push(JSON.parse(raw)) }, close() {} } as unknown as WsSocket
  hub.attach(p.ws, '10.9.9.9')
  return p
}
const say = (p: Partner, m: ClientMsg) => { hub.handleMessage(p.ws, JSON.stringify(m)); flush() }
const lastOf = <T extends ServerMsg['type']>(p: Partner, type: T) =>
  [...p.msgs].reverse().find(m => m.type === type) as Extract<ServerMsg, { type: T }> | undefined
const partnerLog = (p: Partner) => lastOf(p, 'VIEW')!.view.log.map(e => e.text)

beforeEach(() => {
  jest.useFakeTimers()
  mem.clear()
  queue.length = 0
  storageListeners.length = 0
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MysteryHub } = require('../hub') as typeof import('../hub')
  hub = new MysteryHub(() => Date.now())
})
afterEach(() => {
  hub.dispose()
  jest.useRealTimers()
})

/** 标签页 A 建房，两位搭档加入，选角、准备、开局 */
function startedGame() {
  const A = openTab('A')
  inTab(A, () => A.store.getState().create('甲'))
  const code = A.store.getState().code!
  const P = partner()
  say(P, { type: 'JOIN', code, name: '乙' })
  const Q = partner()
  say(Q, { type: 'JOIN', code, name: '丙' })
  inTab(A, () => A.store.getState().act({ type: 'pickRole', roleId: 'mandy' }))
  say(P, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
  say(Q, { type: 'ACT', action: { type: 'pickRole', roleId: 'joan' } })
  inTab(A, () => A.store.getState().act({ type: 'ready', value: true }))
  say(P, { type: 'ACT', action: { type: 'ready', value: true } })
  say(Q, { type: 'ACT', action: { type: 'ready', value: true } })
  expect(A.store.getState().view?.step.index).toBe(0)
  return { A, P, code }
}

describe('同一台设备两个标签页', () => {
  test('第二个标签页接管后，第一个只给"在此窗口继续"；第二个关掉后能在第一个里接着玩', () => {
    const { A, P } = startedGame()
    const B = openTab('B') // 自动恢复，顶掉 A
    expect(B.store.getState().joined).toBe(true)
    expect(A.store.getState().joined).toBe(false)
    expect(A.store.getState().pausedElsewhere).toBe(true)
    closeTab(B)
    inTab(A, () => A.store.getState().resume())
    expect(A.store.getState().joined).toBe(true)
    expect(lastOf(P, 'VIEW')!.view.players.P1!.online).toBe(true)
  })

  test('A 离开（暂离），B 打开后「回到房间」；A 的横幅随之变成"正在另一个窗口里进行"', () => {
    const { A } = startedGame()
    inTab(A, () => A.store.getState().leave())
    expect(A.store.getState().paused).toBeTruthy()
    expect(A.store.getState().pausedElsewhere).toBe(false)
    const B = openTab('B')
    expect(B.store.getState().paused).toBeTruthy() // 暂离会话不自动恢复
    inTab(B, () => B.store.getState().resume())
    expect(B.store.getState().joined).toBe(true)
    expect(A.store.getState().pausedElsewhere).toBe(true)
  })

  test('A 暂离着一局，B 开了新局：旧局被如实放弃，A 的横幅收起，A 也不能把旧局拉回来', () => {
    const { A, P } = startedGame()
    inTab(A, () => A.store.getState().leave())
    const B = openTab('B')
    inTab(B, () => B.store.getState().create('甲'))
    const newCode = B.store.getState().code
    expect(newCode).not.toBeNull()
    expect(partnerLog(P).some(t => t.includes('不会再回来了'))).toBe(true)
    expect(session()?.code).toBe(newCode)
    // A 的横幅已按共享会话更新：现在显示的是 B 正在进行的新局（不能在 A 里另开新局覆盖它）
    expect(A.store.getState().paused?.code).toBe(newCode)
    expect(A.store.getState().pausedElsewhere).toBe(true)
  })

  test('即使没收到 storage 事件、横幅过时：「回到房间」先核对共享会话，不会把放弃了的局拉回来', () => {
    const { A, P, code } = startedGame()
    inTab(A, () => A.store.getState().leave())
    // 模拟 A 错过了 storage 事件
    for (let i = storageListeners.length - 1; i >= 0; i--) if (storageListeners[i].tab === A) storageListeners.splice(i, 1)
    const B = openTab('B')
    inTab(B, () => B.store.getState().create('甲'))
    const before = partnerLog(P).length
    inTab(A, () => A.store.getState().resume())
    expect(A.store.getState().joined).toBe(false)
    expect(A.store.getState().paused).toBeNull()
    expect(session()?.code).not.toBe(code) // B 的新局会话没被覆盖
    expect(partnerLog(P).slice(before).some(t => t.includes('已重新连线'))).toBe(false)
  })

  test('A 在大厅被 B 接管，B 离开大厅让出座位：A 的横幅自动收起', () => {
    const A = openTab('A')
    inTab(A, () => A.store.getState().create('甲'))
    const B = openTab('B')
    expect(A.store.getState().pausedElsewhere).toBe(true)
    inTab(B, () => B.store.getState().leave())
    expect(session()).toBeNull()
    expect(A.store.getState().paused).toBeNull()
  })

  test('空闲的入口页发现另一个标签页正在玩：显示"正在另一个窗口里进行"，不让另开新局覆盖', () => {
    const A = openTab('A') // 空闲入口页
    const B = openTab('B')
    inTab(B, () => B.store.getState().create('甲'))
    expect(A.store.getState().paused?.code).toBe(B.store.getState().code)
    expect(A.store.getState().pausedElsewhere).toBe(true)
  })
})
