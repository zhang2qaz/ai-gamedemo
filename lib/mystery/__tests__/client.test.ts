// 浏览器端连接：存活检测不误判（后台标签页定时器被节流）、恢复旧局时丢掉未发出的建房请求
import type { ClientMsg } from '../protocol'

class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static all: FakeWS[] = []
  readyState = FakeWS.CONNECTING
  sent: ClientMsg[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) { FakeWS.all.push(this) }
  send(raw: string) { this.sent.push(JSON.parse(raw)) }
  close() { this.readyState = FakeWS.CLOSED }
  open() { this.readyState = FakeWS.OPEN; this.onopen?.() }
  reply(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }) }
}

const g = globalThis as Record<string, unknown>
g.WebSocket = FakeWS
g.window = { location: { protocol: 'http:', host: 'test' }, addEventListener() {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }
g.document = { visibilityState: 'visible', addEventListener() {} }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MysteryClient } = require('../client') as typeof import('../client')

beforeEach(() => {
  FakeWS.all = []
  jest.useFakeTimers()
  jest.setSystemTime(1_000_000)
})
afterEach(() => jest.useRealTimers())

type Heart = { heartbeat(): void }

test('后台标签页：心跳间隔被节流到 60 秒，只要上一个 PING 有回应就不重连', () => {
  const c = new MysteryClient()
  c.connect()
  const ws = FakeWS.all[0]
  ws.open()
  for (let i = 0; i < 5; i++) {
    jest.setSystemTime(Date.now() + 60_000) // 节流：每分钟才醒一次
    ;(c as unknown as Heart).heartbeat()
    expect(ws.sent.at(-1)).toEqual({ type: 'PING' })
    ws.reply({ type: 'PONG' })
  }
  expect(FakeWS.all).toHaveLength(1)
  c.close()
})

test('PING 发出后超过 10 秒没有任何回包：判定半开，立刻重连', () => {
  const c = new MysteryClient()
  c.connect()
  FakeWS.all[0].open()
  ;(c as unknown as Heart).heartbeat() // 发 PING，没有回应
  jest.setSystemTime(Date.now() + 20_000)
  ;(c as unknown as Heart).heartbeat()
  expect(FakeWS.all).toHaveLength(2)
  c.close()
})

test('离线时先点了建房、又改成恢复旧局：连上后只发 RESUME', () => {
  const c = new MysteryClient()
  c.send({ type: 'CREATE', name: '甲' })
  c.cancelIntent()
  c.resumeWith = { code: 'ABCD', token: 't' }
  FakeWS.all[0].open()
  expect(FakeWS.all[0].sent.map(m => m.type)).toEqual(['RESUME'])
  c.close()
})

test('离线时的游戏操作不排队补发', () => {
  const c = new MysteryClient()
  expect(c.send({ type: 'ACT', action: { type: 'ready', value: true } })).toBe(false)
  FakeWS.all[0].open()
  expect(FakeWS.all[0].sent).toEqual([])
  c.close()
})
