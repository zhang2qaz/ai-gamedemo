import { makeEngine } from '../core'
import { fixtureRuntime } from '../testFixture'
import type { ScenarioRuntime } from '../runtime'
import { MAX_CHAT_LOG } from '../log'
import type { GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(fixtureRuntime)

/** 测试用：线索 id → 本局的搜查点编号；搜查点 → 线索 id */
const search = (st: GameState, clueId: string): MysteryAction => ({ type: 'search', spotId: E.spotIdOf(st, clueId) })
const spotClue = (st: GameState, x: { spotId: string }) => E.helpers.clueOfSpot(st, x.spotId)?.id
let now = 1_000_000

function act(s: GameState, seat: Seat, a: MysteryAction) {
  now += 10
  const r = E.reduce(s, seat, a, now)
  return r
}
function ok(s: GameState, seat: Seat, a: MysteryAction) {
  const r = act(s, seat, a)
  expect(r.error).toBeUndefined()
  return r.state
}

function started() {
  let s = E.createGame('TEST', 42, now)
  s = E.joinSeat(s, 'P1', '小明', now)
  s = E.joinSeat(s, 'P2', '小红', now)
  s = ok(s, 'P1', { type: 'pickRole', roleId: 'a' })
  expect(act(s, 'P2', { type: 'pickRole', roleId: 'a' }).error).toBe('该角色已被对方选择')
  s = ok(s, 'P2', { type: 'pickRole', roleId: 'b' })
  s = ok(s, 'P1', { type: 'ready', value: true })
  s = ok(s, 'P2', { type: 'ready', value: true })
  return s
}

describe('剧本杀引擎（通用流程）', () => {
  test('大厅：双方选角并准备后开局，发放初始资金', () => {
    const s = started()
    expect(s.stepIndex).toBe(0)
    expect(s.seats.P1.money).toBe(100)
    expect(s.seats.P2.money).toBe(50)
  })

  test('reduce 不修改入参（纯函数）', () => {
    const s = started()
    const snapshot = JSON.stringify(s)
    act(s, 'P1', { type: 'chat', text: '你好' })
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  test('章节按流程解锁，且只发给本角色', () => {
    let s = started()
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = ok(s, 'P2', { type: 'ready', value: true })
    const v1 = E.viewFor(s, 'P1', now)
    const v2 = E.viewFor(s, 'P2', now)
    expect(v1.me.chapters.map(c => c.text)).toEqual(['甲的第一幕'])
    expect(v2.me.chapters.map(c => c.text)).toEqual(['乙的第一幕'])
  })

  function toSearch() {
    let s = started()
    for (let i = 0; i < 2; i++) {
      s = ok(s, 'P1', { type: 'ready', value: true })
      s = ok(s, 'P2', { type: 'ready', value: true })
    }
    expect(s.seats.P1.ap).toBe(3)
    return s
  }

  test('搜证：扣行动点、线索私有、二级线索需前置、专属线索只对本角色开放', () => {
    let s = toSearch()
    let v1 = E.viewFor(s, 'P1', now)
    expect(v1.spots.map(x => spotClue(s, x)).sort()).toEqual(['body', 'key'])
    const v2 = E.viewFor(s, 'P2', now)
    expect(v2.spots.map(x => spotClue(s, x)).sort()).toEqual(['body', 'diary', 'key'])
    expect(act(s, 'P1', search(s, 'diary')).error).toBe('还不能搜这里')

    s = ok(s, 'P1', search(s, 'key'))
    expect(s.seats.P1.ap).toBe(2)
    v1 = E.viewFor(s, 'P1', now)
    expect(v1.clues.find(c => c.id === 'key')?.holder).toBe('me')
    expect(E.viewFor(s, 'P2', now).clues.find(c => c.id === 'key')).toBeUndefined()
    expect(E.viewFor(s, 'P2', now).spots.find(x => spotClue(s, x) === 'key')?.status).toBe('taken')
    expect(act(s, 'P2', search(s, 'key')).error).toBe('这里已经被搜过了')
    // 二级线索解锁
    expect(E.viewFor(s, 'P1', now).spots.some(x => spotClue(s, x) === 'safe')).toBe(true)
    s = ok(s, 'P1', search(s, 'safe'))
    expect(s.seats.P1.ap).toBe(0)
    expect(act(s, 'P1', search(s, 'body')).error).toBe('行动点不足')
  })

  test('自动公开的线索双方可见', () => {
    let s = toSearch()
    s = ok(s, 'P2', search(s, 'body'))
    expect(E.viewFor(s, 'P1', now).clues.find(c => c.id === 'body')?.public).toBe(true)
  })

  test('公开与交出线索', () => {
    let s = toSearch()
    s = ok(s, 'P1', search(s, 'key'))
    expect(act(s, 'P2', { type: 'publish', clueId: 'key' }).error).toBe('只能公开自己持有的线索')
    s = ok(s, 'P1', { type: 'give', clueId: 'key' })
    expect(E.viewFor(s, 'P2', now).clues.find(c => c.id === 'key')?.holder).toBe('me')
    expect(E.viewFor(s, 'P1', now).clues.find(c => c.id === 'key')?.holder).toBe('other')
    s = ok(s, 'P2', { type: 'publish', clueId: 'key' })
    expect(E.viewFor(s, 'P1', now).clues.find(c => c.id === 'key')?.public).toBe(true)
  })

  test('问询：出示证据才能问，获得证词卡；每题每人只能问一次', () => {
    let s = toSearch()
    let q = E.viewFor(s, 'P1', now).npcs[0].questions
    expect(q.map(x => x.id)).toEqual(['q1'])
    s = ok(s, 'P1', { type: 'ask', npcId: 'maid', questionId: 'q1' })
    expect(act(s, 'P1', { type: 'ask', npcId: 'maid', questionId: 'q1' }).error).toBe('你已经问过了')
    s = ok(s, 'P1', search(s, 'key'))
    q = E.viewFor(s, 'P1', now).npcs[0].questions
    expect(q.map(x => x.id)).toEqual(['q1', 'q2'])
    s = ok(s, 'P1', { type: 'ask', npcId: 'maid', questionId: 'q2' })
    expect(E.viewFor(s, 'P1', now).clues.some(c => c.id === 'testimony')).toBe(true)
    // 回答只对提问者可见
    expect(E.viewFor(s, 'P2', now).npcs[0].questions.some(x => x.answer)).toBe(false)
  })

  test('案卷：全对领酬金，答错扣钱且次数有限', () => {
    let s = toSearch()
    s = ok(s, 'P1', { type: 'caseFile', caseId: 'case1', answers: { who: 'x' } })
    expect(s.seats.P1.money).toBe(0)
    s = ok(s, 'P1', { type: 'caseFile', caseId: 'case1', answers: { who: 'y' } })
    expect(s.seats.P1.money).toBe(500)
    expect(act(s, 'P1', { type: 'caseFile', caseId: 'case1', answers: { who: 'y' } }).error).toBe('你已经破解了这一案')
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'case1', answers: { who: 'x' } })
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'case1', answers: { who: 'x' } })
    expect(act(s, 'P2', { type: 'caseFile', caseId: 'case1', answers: { who: 'y' } }).error).toBe('提交次数已用完')
  })

  test('超时自动推进；抉择超时代选；指认后进入结局', () => {
    let s = toSearch()
    expect(E.nextDeadline(s)).toBe(s.deadline)
    s = E.tick(s, s.deadline! + 1)
    expect(fixtureRuntime.scenario.flow[s.stepIndex].id).toBe('choose')
    // P2 无需抉择，P1 未选 → 不能准备
    expect(act(s, 'P1', { type: 'ready', value: true }).error).toBe('请先做出选择')
    s = ok(s, 'P2', { type: 'ready', value: true })
    s = ok(s, 'P1', { type: 'choose', optionId: 'yes' })
    expect(s.flags.aTalked).toBe(true)
    expect(fixtureRuntime.scenario.flow[s.stepIndex].id).toBe('read2')
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = ok(s, 'P2', { type: 'ready', value: true })
    s = ok(s, 'P1', { type: 'accuse', answers: { killer: 'maid', bogus: 'x' } })
    expect(s.seats.P1.accuse).toEqual({ killer: 'maid' })
    s = ok(s, 'P2', { type: 'accuse', answers: { killer: 'a' } })
    expect(s.ended).toBe(true)
    expect(E.viewFor(s, 'P1', now).result?.secrets).toEqual(['甲说了'])
  })

  test('断线状态与不合法动作', () => {
    let s = started()
    s = E.setPresence(s, 'P2', false, now)
    expect(E.viewFor(s, 'P1', now).players.P2.online).toBe(false)
    expect(act(s, 'P1', search(s, 'key')).error).toBe('现在不是搜证时间')
    expect(act(s, 'P1', { type: 'pickRole', roleId: 'b' }).error).toBe('游戏已开始，不能更换角色')
    // @ts-expect-error 非法动作
    expect(act(s, 'P1', { type: 'hack' }).error).toBe('未知操作')
  })
})

describe('引擎边界（审查修复回归）', () => {
  function variant(patch: (sc: ScenarioRuntime['scenario']) => void) {
    const sc = structuredClone(fixtureRuntime.scenario)
    patch(sc)
    return makeEngine({ ...fixtureRuntime, scenario: sc })
  }
  function startWith(E2: ReturnType<typeof makeEngine>) {
    let s = E2.createGame('T', 1, now)
    s = E2.joinSeat(s, 'P1', 'x', now)
    s = E2.joinSeat(s, 'P2', 'y', now)
    for (const [seat, role] of [['P1', 'a'], ['P2', 'b']] as const) s = E2.reduce(s, seat, { type: 'pickRole', roleId: role }, now).state
    for (const seat of ['P1', 'P2'] as const) s = E2.reduce(s, seat, { type: 'ready', value: true }, now).state
    return s
  }

  test('onEnter：全局效果（广播、setFlag、不带角色的发线索）只执行一次，线索双方都能看到', () => {
    const E2 = variant(sc => {
      sc.flow[1].onEnter = [{ dm: '全体注意', to: 'both' }, { setFlag: 'x', value: true }, { giveClue: 'testimony' }]
    })
    let s = startWith(E2)
    s = E2.reduce(s, 'P1', { type: 'ready', value: true }, now).state
    s = E2.reduce(s, 'P2', { type: 'ready', value: true }, now).state
    expect(s.log.filter(e => e.text === '全体注意')).toHaveLength(1)
    expect(s.flags.x).toBe(true)
    for (const seat of ['P1', 'P2'] as const) expect(E2.viewFor(s, seat, now).clues.some(c => c.id === 'testimony')).toBe(true)
  })

  test('onEnter：显式 to:self 的发线索对每个座位各执行一次', () => {
    const E2 = variant(sc => { sc.flow[1].onEnter = [{ giveClue: 'testimony', to: 'self' }] })
    let s = startWith(E2)
    s = E2.reduce(s, 'P1', { type: 'ready', value: true }, now).state
    s = E2.reduce(s, 'P2', { type: 'ready', value: true }, now).state
    for (const seat of ['P1', 'P2'] as const) expect(E2.viewFor(s, seat, now).clues.some(c => c.id === 'testimony')).toBe(true)
  })

  test('流程没有以 ending 收尾时，最后一步结束即结束游戏，不会反复结算', () => {
    const E2 = variant(sc => {
      sc.flow = sc.flow.filter(st => st.kind !== 'ending')
      sc.accuse[0].bonus = 100
    })
    let s = startWith(E2)
    for (let i = 0; i < 20 && !s.ended; i++) {
      const k = E2.scenario.flow[s.stepIndex].kind
      if (k === 'accuse') {
        for (const seat of ['P1', 'P2'] as const) s = E2.reduce(s, seat, { type: 'accuse', answers: { killer: 'maid' } }, now).state
      } else if (k === 'choice') {
        s = E2.reduce(s, 'P1', { type: 'choose', optionId: 'no' }, now).state
        s = E2.reduce(s, 'P2', { type: 'ready', value: true }, now).state
      } else {
        for (const seat of ['P1', 'P2'] as const) s = E2.reduce(s, seat, { type: 'ready', value: true }, now).state
      }
    }
    expect(s.ended).toBe(true)
    const money = s.seats.P1.money
    for (let i = 0; i < 5; i++) s = E2.reduce(s, 'P1', { type: 'chat', text: 'hi' }, now).state
    expect(s.seats.P1.money).toBe(money)
  })

  test('没配倒计时的指认 / 抉择也有兜底时限', () => {
    let s = started()
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = ok(s, 'P2', { type: 'ready', value: true }) // → read1
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = ok(s, 'P2', { type: 'ready', value: true }) // → search1
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = ok(s, 'P2', { type: 'ready', value: true }) // → choose
    expect(E.scenario.flow[s.stepIndex].kind).toBe('choice')
    expect(E.nextDeadline(s)).not.toBeNull()
  })

  test('刷聊天不会把剧情和私信挤出记录', () => {
    let s = started()
    for (let i = 0; i < MAX_CHAT_LOG + 50; i++) s = E.reduce(s, 'P1', { type: 'chat', text: `刷屏 ${i}` }, now).state
    const v = E.viewFor(s, 'P2', now)
    expect(v.log.some(e => e.text.includes('开场白'))).toBe(true)
    expect(v.log.filter(e => e.kind === 'chat').length).toBeLessThanOrEqual(200)
  })
})
