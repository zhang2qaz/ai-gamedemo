// 客户端状态：大厅里离线点「离开」时，令牌要删掉（不会有服务器确认）
const mem = new Map<string, string>()
const g = globalThis as Record<string, unknown>
class DeadWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = 0
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  send() {}
  close() {}
}
g.WebSocket = DeadWS
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

beforeEach(() => mem.clear())

test('大厅里离线点「离开」：LEAVE 发不出去，直接删掉令牌（不留"回到房间"）', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
  useMysteryStore.setState({ joined: true, code: 'ABCD', view: fakeView('lobby') })
  useMysteryStore.getState().leave()
  expect(mem.get('mystery:session')).toBeUndefined()
  expect(useMysteryStore.getState().paused).toBeNull()
})

test('开局后离线点「离开」：令牌保留为暂离，入口页可以回来', () => {
  mem.set('mystery:session', JSON.stringify({ code: 'ABCD', token: 't' }))
  useMysteryStore.setState({ joined: true, code: 'ABCD', view: fakeView('read') })
  useMysteryStore.getState().leave()
  expect(JSON.parse(mem.get('mystery:session')!)).toEqual({ code: 'ABCD', token: 't', paused: true })
  expect(useMysteryStore.getState().paused?.code).toBe('ABCD')
})
