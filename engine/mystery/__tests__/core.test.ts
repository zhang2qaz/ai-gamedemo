import { makeEngine } from '../core'
import { fixtureRuntime } from '../testFixture'
import type { GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(fixtureRuntime)
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
    expect(v1.spots.map(x => x.clueId).sort()).toEqual(['body', 'key'])
    const v2 = E.viewFor(s, 'P2', now)
    expect(v2.spots.map(x => x.clueId).sort()).toEqual(['body', 'diary', 'key'])
    expect(act(s, 'P1', { type: 'search', clueId: 'diary' }).error).toBe('还不能搜这里')

    s = ok(s, 'P1', { type: 'search', clueId: 'key' })
    expect(s.seats.P1.ap).toBe(2)
    v1 = E.viewFor(s, 'P1', now)
    expect(v1.clues.find(c => c.id === 'key')?.holder).toBe('me')
    expect(E.viewFor(s, 'P2', now).clues.find(c => c.id === 'key')).toBeUndefined()
    expect(E.viewFor(s, 'P2', now).spots.find(x => x.clueId === 'key')?.status).toBe('taken')
    expect(act(s, 'P2', { type: 'search', clueId: 'key' }).error).toBe('这里已经被搜过了')
    // 二级线索解锁
    expect(E.viewFor(s, 'P1', now).spots.some(x => x.clueId === 'safe')).toBe(true)
    s = ok(s, 'P1', { type: 'search', clueId: 'safe' })
    expect(s.seats.P1.ap).toBe(0)
    expect(act(s, 'P1', { type: 'search', clueId: 'body' }).error).toBe('行动点不足')
  })

  test('自动公开的线索双方可见', () => {
    let s = toSearch()
    s = ok(s, 'P2', { type: 'search', clueId: 'body' })
    expect(E.viewFor(s, 'P1', now).clues.find(c => c.id === 'body')?.public).toBe(true)
  })

  test('公开与交出线索', () => {
    let s = toSearch()
    s = ok(s, 'P1', { type: 'search', clueId: 'key' })
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
    s = ok(s, 'P1', { type: 'search', clueId: 'key' })
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
    expect(act(s, 'P1', { type: 'search', clueId: 'key' }).error).toBe('现在不是搜证时间')
    expect(act(s, 'P1', { type: 'pickRole', roleId: 'b' }).error).toBe('游戏已开始，不能更换角色')
    // @ts-expect-error 非法动作
    expect(act(s, 'P1', { type: 'hack' }).error).toBe('未知操作')
  })
})
