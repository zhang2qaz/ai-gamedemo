// 联机中枢：离开 / 补位 / 限流 / 过期操作 / 断线恢复（用假 socket 驱动）
import type { WebSocket } from 'ws'
import { MysteryHub } from '../hub'
import type { ClientMsg, ServerMsg } from '../protocol'

let clock = 1_000_000
let ipSeq = 0
const hub = new MysteryHub(() => clock)
afterAll(() => hub.dispose())

type Fake = { ws: WebSocket; msgs: ServerMsg[]; closed: boolean; ip?: string }

function sock(ip?: string): Fake {
  const f: Fake = { ws: null as unknown as WebSocket, msgs: [], closed: false, ip }
  f.ws = {
    send: (raw: string) => { f.msgs.push(JSON.parse(raw)) },
    close: () => { f.closed = true },
  } as unknown as WebSocket
  return f
}
const attached = new WeakSet<object>()
const send = (f: Fake, m: ClientMsg) => {
  if (!attached.has(f.ws as object)) { attached.add(f.ws as object); hub.attach(f.ws, f.ip ?? `10.0.0.${++ipSeq}`) }
  hub.handleMessage(f.ws, JSON.stringify(m))
}
const last = <T extends ServerMsg['type']>(f: Fake, type: T) =>
  [...f.msgs].reverse().find(m => m.type === type) as Extract<ServerMsg, { type: T }> | undefined
const tick = (ms = 1100) => { clock += ms }

/** 三个人进了同一个房间（本剧本 3–4 人） */
function room() {
  tick()
  const a = sock()
  send(a, { type: 'CREATE', name: '甲' })
  const code = last(a, 'WELCOME')!.code
  const b = sock()
  send(b, { type: 'JOIN', code, name: '乙' })
  const c = sock()
  send(c, { type: 'JOIN', code, name: '丙' })
  return { a, b, c, code }
}

/** 三个人选好角色、都准备好：开局 */
function started() {
  const r = room()
  send(r.a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
  send(r.b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
  send(r.c, { type: 'ACT', action: { type: 'pickRole', roleId: 'joan' } })
  for (const f of [r.a, r.b, r.c]) send(f, { type: 'ACT', action: { type: 'ready', value: true } })
  return r
}

describe('MysteryHub', () => {
  test('大厅里离开会让出座位，新来的人可以补位；人都走了房间就删除', () => {
    const { a, b, c, code } = room()
    send(b, { type: 'LEAVE' })
    const d = sock()
    send(d, { type: 'JOIN', code, name: '丁' })
    expect(last(d, 'WELCOME')?.seat).toBe('P2')
    expect(last(a, 'VIEW')!.view.players.P2!.name).toBe('丁')
    const before = hub.roomCount
    for (const f of [a, c, d]) send(f, { type: 'LEAVE' })
    expect(hub.roomCount).toBe(before - 1)
  })

  test('最多 4 个人：第 4 个人坐 P4，第 5 个人进不来', () => {
    const { a, code } = room()
    const d = sock()
    send(d, { type: 'JOIN', code, name: '丁' })
    expect(last(d, 'WELCOME')?.seat).toBe('P4')
    expect(last(a, 'VIEW')!.view.players.P4!.name).toBe('丁')
    const e = sock()
    send(e, { type: 'JOIN', code, name: '戊' })
    expect(last(e, 'ERROR')?.message).toMatch(/房间已满（本剧本最多 4 人）/)
  })

  test('开局后离开保留座位，原令牌可以回来；开局后新的人不能再加入', () => {
    const { a, b, code } = started()
    expect(last(a, 'VIEW')!.view.step.index).toBe(0)
    const token = last(b, 'WELCOME')!.token
    send(b, { type: 'LEAVE' })
    expect(last(a, 'VIEW')!.view.players.P2!.online).toBe(false)
    const d = sock()
    send(d, { type: 'JOIN', code, name: '丁' })
    expect(last(d, 'ERROR')?.message).toMatch(/已经开始/)
    const b2 = sock()
    send(b2, { type: 'RESUME', code, token })
    expect(last(b2, 'WELCOME')?.seat).toBe('P2')
  })

  test('大厅里掉线超过 1 分钟的座位可以被新玩家补上', () => {
    const { b, code } = room()
    const d = sock()
    send(d, { type: 'JOIN', code, name: '丁' })
    hub.handleClose(b.ws)
    const e = sock()
    send(e, { type: 'JOIN', code, name: '戊' })
    expect(last(e, 'ERROR')?.message).toMatch(/房间已满/)
    tick(61_000)
    send(e, { type: 'JOIN', code, name: '戊' })
    expect(last(e, 'WELCOME')?.seat).toBe('P2')
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
    const { a, b, c } = room()
    send(a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    send(c, { type: 'ACT', action: { type: 'pickRole', roleId: 'joan' } })
    for (const f of [a, b, c]) send(f, { type: 'ACT', action: { type: 'ready', value: true }, at: -1 })
    // 双击：第二下仍带着大厅的序号
    send(a, { type: 'ACT', action: { type: 'ready', value: true }, at: -1 })
    expect(last(a, 'ERROR')?.reason).toBe('stale')
    expect(last(a, 'VIEW')!.view.players.P1!.ready).toBe(false)
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
    expect(v.players.P2!.money).toBeUndefined()
    expect(v.players.P3!.money).toBeUndefined()
  })
})

describe('MysteryHub（第二轮修复）', () => {
  test('离开有确认：大厅里 vacated=true，开局后 vacated=false', () => {
    const r1 = room()
    send(r1.b, { type: 'LEAVE' })
    expect(last(r1.b, 'LEFT')).toEqual({ type: 'LEFT', code: r1.code, vacated: true })
    const r2 = started()
    send(r2.b, { type: 'LEAVE' })
    expect(last(r2.b, 'LEFT')).toEqual({ type: 'LEFT', code: r2.code, vacated: false })
  })

  test('对方的私密操作（答错案卷）不会让你多收到一份视图', () => {
    const { a, b, c } = started()
    // 推进到搜证一
    for (let guard = 0; guard < 20; guard++) {
      const v = last(a, 'VIEW')!.view
      if (v.step.id === 'search1') break
      tick()
      if (v.step.kind === 'auction' && !v.auction?.results) {
        for (const f of [a, b, c]) send(f, { type: 'ACT', action: { type: 'bid', bids: {} } })
        continue
      }
      for (const f of [a, b, c]) send(f, { type: 'ACT', action: { type: 'ready', value: true } })
    }
    expect(last(a, 'VIEW')!.view.step.id).toBe('search1')
    const views = () => b.msgs.filter(m => m.type === 'VIEW').length
    const before = views()
    tick()
    send(a, { type: 'ACT', action: { type: 'caseFile', caseId: 'cf_rose', answers: { cause: 'heart', vehicle: 'dinner', claim: 'possible' } } })
    expect(last(a, 'VIEW')!.view.caseFiles.find(c => c.id === 'cf_rose')!.attemptsLeft).toBe(1)
    expect(views()).toBe(before)
    // 双方都看得见的变化照常推送
    send(a, { type: 'ACT', action: { type: 'ready', value: true } })
    expect(views()).toBe(before + 1)
  })

  test('公开 / 交出 / 递交案卷跨阶段合法：不做阶段号检查；被判过期的操作会带上操作类型', () => {
    const { a } = started()
    tick()
    send(a, { type: 'ACT', action: { type: 'publish', clueId: 'nope' }, at: -1 })
    expect(last(a, 'ERROR')?.reason).not.toBe('stale')
    send(a, { type: 'ACT', action: { type: 'search', spotId: 'x' }, at: -1 })
    expect(last(a, 'ERROR')).toMatchObject({ reason: 'stale', action: 'search' })
  })

  test('换连接也绕不过加入失败的限流（按 IP 计）', () => {
    let blocked = 0
    for (let c = 0; c < 5; c++) {
      const x = sock('203.0.113.9')
      for (let i = 0; i < 8; i++) {
        tick(50)
        send(x, { type: 'JOIN', code: 'QQQ' + 'ABCDEFGH'[i], name: '扫' })
      }
      blocked += x.msgs.filter(m => m.type === 'ERROR' && m.reason === 'rate').length
    }
    // 40 次里最多 30 次真正去查房间号
    expect(blocked).toBeGreaterThanOrEqual(10)
  })
})

describe('MysteryHub（ABANDON：凭令牌放弃座位）', () => {
  test('大厅里离线的座位：放弃后让出，别人可以立刻补位；不发 WELCOME', () => {
    const { b, code } = room()
    const token = last(b, 'WELCOME')!.token
    hub.handleClose(b.ws)
    const x = sock()
    send(x, { type: 'ABANDON', code, token })
    expect(x.msgs.map(m => m.type)).toEqual(['LEFT'])
    expect(last(x, 'LEFT')).toMatchObject({ vacated: true })
    const c = sock()
    send(c, { type: 'JOIN', code, name: '丙' })
    expect(last(c, 'WELCOME')?.seat).toBe('P2')
  })

  test('座位还挂着连接：不顶掉它（busy）；等那条连接断开再执行放弃并通知', () => {
    const { a, b, code } = room()
    const token = last(b, 'WELCOME')!.token
    const x = sock()
    send(x, { type: 'ABANDON', code, token })
    expect(last(x, 'LEFT')).toMatchObject({ vacated: false, busy: true, token })
    expect(b.closed).toBe(false)
    expect(b.msgs.some(m => m.type === 'ERROR' && m.reason === 'superseded')).toBe(false)
    // 旧连接被回收（心跳 / 关闭）→ 执行放弃：大厅座位让出，发起方收到确认
    hub.handleClose(b.ws)
    expect(last(x, 'LEFT')).toMatchObject({ vacated: true, token })
    expect(last(a, 'VIEW')!.view.players.P2?.name ?? null).toBeNull()
  })

  test('暂缓的放弃：期间有人凭令牌回到座位就作废', () => {
    const { b, code } = room()
    const token = last(b, 'WELCOME')!.token
    const x = sock()
    send(x, { type: 'ABANDON', code, token })
    const b2 = sock()
    send(b2, { type: 'RESUME', code, token }) // 别的标签页回来了（顶掉旧连接）
    hub.handleClose(b2.ws)
    expect(x.msgs.filter(m => m.type === 'LEFT')).toHaveLength(1) // 只有最初的 busy
  })

  test('开局后彻底放弃：座位保留，对方只看到一次"不会再回来了"，不会闪"已重新连线"', () => {
    const { a, b, code } = started()
    const token = last(b, 'WELCOME')!.token
    hub.handleClose(b.ws)
    for (let i = 0; i < 2; i++) {
      const x = sock()
      send(x, { type: 'ABANDON', code, token, final: true })
      expect(last(x, 'LEFT')).toMatchObject({ vacated: false })
    }
    const log = last(a, 'VIEW')!.view.log.map(e => e.text)
    expect(log.filter(t => t.includes('不会再回来了'))).toHaveLength(1)
    expect(log.slice(-3).some(t => t.includes('已重新连线'))).toBe(false)
  })

  test('令牌无效 / 房间不存在：回复一模一样（探测不出房间号是否存在）', () => {
    const { code } = room()
    const x = sock()
    send(x, { type: 'ABANDON', code, token: 'nope' })
    send(x, { type: 'ABANDON', code: 'ZZZZ', token: 'nope' })
    const lefts = x.msgs.filter(m => m.type === 'LEFT').map(m => ({ ...m, code: '' }))
    expect(lefts[0]).toEqual(lefts[1])
  })
})

describe('MysteryHub（暂缓的放弃：时限与取消准备）', () => {
  test('大厅里暂缓放弃期间先取消准备：别人不能抢先开局', () => {
    const { a, b, c, code } = room()
    send(a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    send(c, { type: 'ACT', action: { type: 'pickRole', roleId: 'joan' } })
    send(b, { type: 'ACT', action: { type: 'ready', value: true } })
    send(c, { type: 'ACT', action: { type: 'ready', value: true } })
    const token = last(b, 'WELCOME')!.token
    const x = sock()
    send(x, { type: 'ABANDON', code, token })
    expect(last(a, 'VIEW')!.view.players.P2!.ready).toBe(false)
    send(a, { type: 'ACT', action: { type: 'ready', value: true } })
    expect(last(a, 'VIEW')!.view.step.index).toBe(-1)
  })

  test('暂缓的放弃超过 90 秒作废：那其实是另一个真实在玩的连接，之后它短暂断线也不会被替它离开', () => {
    const { a, b, code } = room()
    const token = last(b, 'WELCOME')!.token
    const x = sock()
    send(x, { type: 'ABANDON', code, token })
    tick(91_000)
    hub.handleClose(b.ws)
    expect(last(a, 'VIEW')!.view.players.P2!.name).toBe('乙')
    // 发起方收到最终结果：座位保留（暂缓的放弃已作废）
    expect(x.msgs.filter(m => m.type === 'LEFT').map(m => (m as { kept?: boolean }).kept ?? false)).toEqual([false, true])
  })
})

describe('MysteryHub（暂缓放弃：时限从第一次算起）', () => {
  test('重发不重新计时、不反复取消准备；超时后的重发得到最终的"座位保留"', () => {
    const { a, b, code } = room()
    send(a, { type: 'ACT', action: { type: 'pickRole', roleId: 'mandy' } })
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    const token = last(b, 'WELCOME')!.token
    const x1 = sock()
    send(x1, { type: 'ABANDON', code, token })
    expect(last(a, 'VIEW')!.view.players.P2!.ready).toBe(false)
    // 乙（真实在玩）重新准备
    send(b, { type: 'ACT', action: { type: 'ready', value: true } })
    tick(60_000)
    const x2 = sock()
    send(x2, { type: 'ABANDON', code, token }) // 重发：仍 busy，但不再取消准备
    expect(last(x2, 'LEFT')).toMatchObject({ busy: true })
    expect(last(a, 'VIEW')!.view.players.P2!.ready).toBe(true)
    tick(31_000) // 距第一次已 91 秒
    const x3 = sock()
    send(x3, { type: 'ABANDON', code, token })
    expect(last(x3, 'LEFT')).toMatchObject({ vacated: false, kept: true, token })
    // 之后乙短暂断线：不会被替它离开
    hub.handleClose(b.ws)
    expect(last(a, 'VIEW')!.view.players.P2!.name).toBe('乙')
  })
})

describe('MysteryHub（ABANDON check：只查询）', () => {
  test('只查询没有副作用：座位还在回 kept，令牌失效回 vacated', () => {
    const { a, b, code } = room()
    send(b, { type: 'ACT', action: { type: 'pickRole', roleId: 'ethan' } })
    send(b, { type: 'ACT', action: { type: 'ready', value: true } })
    const token = last(b, 'WELCOME')!.token
    const before = JSON.stringify(last(a, 'VIEW')!.view.players)
    const x = sock()
    send(x, { type: 'ABANDON', code, token, check: true })
    expect(last(x, 'LEFT')).toMatchObject({ vacated: false, kept: true, token })
    expect(JSON.stringify(last(a, 'VIEW')!.view.players)).toBe(before)
    send(x, { type: 'ABANDON', code, token: 'nope', check: true })
    expect(last(x, 'LEFT')).toMatchObject({ vacated: true })
  })
})
