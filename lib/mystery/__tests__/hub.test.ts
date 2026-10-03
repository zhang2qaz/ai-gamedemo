// 联机中枢：离开 / 补位 / 限流 / 过期操作 / 断线恢复（用假 socket 驱动）
import type { WebSocket } from 'ws'
import { MysteryHub } from '../hub'
import type { ClientMsg, ServerMsg } from '../protocol'

let clock = 1_000_000
const hub = new MysteryHub(() => clock)
afterAll(() => hub.dispose())

type Fake = { ws: WebSocket; msgs: ServerMsg[]; closed: boolean }

function sock(): Fake {
  const f: Fake = { ws: null as unknown as WebSocket, msgs: [], closed: false }
  f.ws = {
    send: (raw: string) => { f.msgs.push(JSON.parse(raw)) },
    close: () => { f.closed = true },
  } as unknown as WebSocket
  return f
}
const send = (f: Fake, m: ClientMsg) => hub.handleMessage(f.ws, JSON.stringify(m))
const last = <T extends ServerMsg['type']>(f: Fake, type: T) =>
  [...f.msgs].reverse().find(m => m.type === type) as Extract<ServerMsg, { type: T }> | undefined
const tick = (ms = 1100) => { clock += ms }

function room() {
  tick()
  const a = sock()
  send(a, { type: 'CREATE', name: '甲' })
  const code = last(a, 'WELCOME')!.code
  const b = sock()
  send(b, { type: 'JOIN', code, name: '乙' })
  return { a, b, code }
}

describe('MysteryHub', () => {
  test('大厅里离开会让出座位，第三个人可以补位；两人都走了房间就删除', () => {
    const { a, b, code } = room()
    send(b, { type: 'LEAVE' })
    const c = sock()
    send(c, { type: 'JOIN', code, name: '丙' })
    expect(last(c, 'WELCOME')?.seat).toBe('P2')
    expect(last(a, 'VIEW')!.view.players.P2.name).toBe('丙')
    const before = hub.roomCount
    send(a, { type: 'LEAVE' })
    send(c, { type: 'LEAVE' })
    expect(hub.roomCount).toBe(before - 1)
  })

  test('开局后离开保留座位，原令牌可以回来', () => {
    const { a, b, code } = room()
    send(a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    send(a, { type: 'ACT', action: { type: 'ready', value: true } })
    send(b, { type: 'ACT', action: { type: 'ready', value: true } })
    expect(last(a, 'VIEW')!.view.step.index).toBe(0)
    const token = last(b, 'WELCOME')!.token
    send(b, { type: 'LEAVE' })
    expect(last(a, 'VIEW')!.view.players.P2.online).toBe(false)
    const c = sock()
    send(c, { type: 'JOIN', code, name: '丙' })
    expect(last(c, 'ERROR')?.message).toMatch(/房间已满/)
    const b2 = sock()
    send(b2, { type: 'RESUME', code, token })
    expect(last(b2, 'WELCOME')?.seat).toBe('P2')
  })

  test('大厅里掉线超过 1 分钟的座位可以被新玩家补上', () => {
    const { b, code } = room()
    hub.handleClose(b.ws)
    const c = sock()
    send(c, { type: 'JOIN', code, name: '丙' })
    expect(last(c, 'ERROR')?.message).toMatch(/房间已满/)
    tick(61_000)
    send(c, { type: 'JOIN', code, name: '丙' })
    expect(last(c, 'WELCOME')?.seat).toBe('P2')
  })

  test('LEAVE / 建房不会清零限流计数', () => {
    tick()
    const x = sock()
    for (let i = 0; i < 50; i++) {
      send(x, { type: 'LEAVE' })
      send(x, { type: 'PING' })
    }
    const pongs = x.msgs.filter(m => m.type === 'PONG').length
    expect(pongs).toBeLessThanOrEqual(30)
    expect(x.msgs.some(m => m.type === 'ERROR' && m.reason === 'rate')).toBe(true)
  })

  test('一个连接一分钟内最多建 5 个房间', () => {
    const before = hub.roomCount
    const x = sock()
    for (let i = 0; i < 8; i++) {
      tick()
      send(x, { type: 'CREATE', name: '刷' })
    }
    // 每次建新房都会离开（并删除）上一个空房，所以房间数最多 +1；关键是第 6 次起被拒绝
    expect(x.msgs.filter(m => m.type === 'WELCOME')).toHaveLength(5)
    expect(hub.roomCount).toBeLessThanOrEqual(before + 1)
  })

  test('扫房间号：加入失败太多次会被暂停', () => {
    const x = sock()
    for (let i = 0; i < 12; i++) {
      tick(100)
      send(x, { type: 'JOIN', code: 'ZZZ' + 'ABCDEFGHJKLM'[i], name: '扫' })
    }
    expect(last(x, 'ERROR')?.message).toMatch(/太频繁/)
  })

  test('过期操作（阶段已推进）被丢弃，聊天不受影响', () => {
    const { a, b } = room()
    send(a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    send(a, { type: 'ACT', action: { type: 'ready', value: true }, at: -1 })
    send(b, { type: 'ACT', action: { type: 'ready', value: true }, at: -1 })
    // 双击：第二下仍带着大厅的序号
    send(a, { type: 'ACT', action: { type: 'ready', value: true }, at: -1 })
    expect(last(a, 'ERROR')?.reason).toBe('stale')
    expect(last(a, 'VIEW')!.view.players.P1.ready).toBe(false)
    tick()
    send(a, { type: 'ACT', action: { type: 'chat', text: '你好' }, at: -1 })
    expect(last(b, 'VIEW')!.view.log.some(e => e.kind === 'chat' && e.text === '你好')).toBe(true)
  })

  test('断线恢复：同一连接重复 RESUME 不刷在线状态；别的窗口登录会顶掉旧连接（reason=superseded）', () => {
    const { a, code } = room()
    const token = last(a, 'WELCOME')!.token
    const logLen = last(a, 'VIEW')!.view.log.length
    send(a, { type: 'RESUME', code, token })
    expect(last(a, 'VIEW')!.view.log.length).toBe(logLen)
    const a2 = sock()
    send(a2, { type: 'RESUME', code, token })
    const err = last(a, 'ERROR')!
    expect(err.fatal).toBe(true)
    expect(err.reason).toBe('superseded')
    expect(a.closed).toBe(true)
    expect(last(a2, 'WELCOME')?.seat).toBe('P1')
  })

  test('不带令牌的 RESUME 不会抛错，也不会把连接踢出原房间', () => {
    const { a, code } = room()
    send(a, { type: 'RESUME', code } as unknown as ClientMsg)
    expect(last(a, 'ERROR')?.reason).toBe('auth')
    tick()
    send(a, { type: 'ACT', action: { type: 'chat', text: '还在' } })
    expect(last(a, 'VIEW')!.view.log.some(e => e.text === '还在')).toBe(true)
  })

  test('对方余额不随视图下发', () => {
    const { a } = room()
    const v = last(a, 'VIEW')!.view
    expect(v.players.P2.money).toBeUndefined()
  })
})
