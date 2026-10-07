// 《草莓蛋糕不见了！》（给小学生的入门剧本）：内容一致性、唯一解、单人可解、整局流程、算星星
import { makeEngine } from '../core'
import { forestCake } from '../scenarios/forest-cake'
import { SCENARIO, ACCUSE, CASE_FILES } from '../scenarios/forest-cake/content'
import { PUZZLE, EXPECTED } from '../scenarios/forest-cake/puzzle'
import { KIDS_META } from '../scenarios/meta'
import { solveAll } from '../solver'
import type { Cond, GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(forestCake)
const clueIds = new Set(SCENARIO.clues.map(c => c.id))
const stepIds = new Set(SCENARIO.flow.map(s => s.id))
const roleIds = new Set(SCENARIO.roles.map(r => r.id))

function condClues(c: Cond | undefined, out: string[] = []): string[] {
  if (!c) return out
  if ('hasClue' in c) out.push(c.hasClue)
  else if ('owns' in c) out.push(c.owns)
  else if ('all' in c) c.all.forEach(x => condClues(x, out))
  else if ('any' in c) c.any.forEach(x => condClues(x, out))
  else if ('not' in c) condClues(c.not, out)
  return out
}

/** 某个孩子"单干"能拿到的线索（cast：这一局有人演的角色；他们的替身 NPC 不出场） */
function soloClues(roleId: string, cast: string[]): Set<string> {
  const have = new Set<string>()
  for (const st of SCENARIO.flow) for (const e of st.onEnter ?? []) if ('giveClue' in e && (!e.role || e.role === roleId)) have.add(e.giveClue)
  const ok = (c: Cond | undefined): boolean => {
    if (!c) return true
    if ('hasClue' in c) return have.has(c.hasClue)
    if ('owns' in c) return have.has(c.owns)
    if ('role' in c) return c.role === roleId
    if ('all' in c) return c.all.every(ok)
    if ('any' in c) return c.any.some(ok)
    if ('not' in c) return !ok(c.not)
    return true
  }
  for (let changed = true; changed;) {
    changed = false
    for (const c of SCENARIO.clues) {
      if (!c.location || have.has(c.id) || (c.onlyRole && c.onlyRole !== roleId) || !ok(c.requires)) continue
      have.add(c.id); changed = true
    }
    for (const n of SCENARIO.npcs) {
      if (n.standsInFor && cast.includes(n.standsInFor)) continue
      for (const q of n.questions) {
        if ((q.onlyRole && q.onlyRole !== roleId) || !ok(q.requires) || (q.present && !have.has(q.present))) continue
        for (const g of q.grants ?? []) if (!have.has(g)) { have.add(g); changed = true }
      }
    }
  }
  return have
}

/** 任何组合都能拿到的线索（含拍卖道具解锁的） */
function obtainable(): Set<string> {
  const s = new Set<string>()
  for (const c of SCENARIO.clues) if (c.location) s.add(c.id)
  for (const n of SCENARIO.npcs) for (const q of n.questions) for (const g of q.grants ?? []) s.add(g)
  for (const st of SCENARIO.flow) {
    for (const e of st.onEnter ?? []) if ('giveClue' in e) s.add(e.giveClue)
    for (const l of st.lots ?? []) s.add(l.item)
  }
  return s
}

describe('《草莓蛋糕不见了！》内容', () => {
  test('引用都指向存在的线索 / 步骤 / 角色；答案都在选项里', () => {
    expect(clueIds.size).toBe(SCENARIO.clues.length)
    const locIds = new Set(SCENARIO.locations.map(l => l.id))
    for (const c of SCENARIO.clues) {
      if (c.location) expect(locIds.has(c.location)).toBe(true)
      if (c.from) expect(stepIds.has(c.from)).toBe(true)
      for (const id of condClues(c.requires)) expect(clueIds.has(id)).toBe(true)
    }
    for (const n of SCENARIO.npcs) {
      if (n.from) expect(stepIds.has(n.from)).toBe(true)
      if (n.standsInFor) expect(SCENARIO.roles.find(r => r.id === n.standsInFor)?.optional).toBe(true)
      for (const q of n.questions) {
        for (const g of q.grants ?? []) expect(clueIds.has(g)).toBe(true)
        if (q.present) expect(clueIds.has(q.present)).toBe(true)
        for (const id of condClues(q.requires)) expect(clueIds.has(id)).toBe(true)
      }
    }
    for (const r of SCENARIO.roles) for (const ch of r.script) expect(stepIds.has(ch.from)).toBe(true)
    for (const st of SCENARIO.flow) {
      for (const e of st.onEnter ?? []) {
        if ('giveClue' in e) {
          expect(clueIds.has(e.giveClue)).toBe(true)
          if (e.role) expect(roleIds.has(e.role)).toBe(true)
        }
      }
      for (const l of st.lots ?? []) expect(SCENARIO.clues.find(c => c.id === l.item)?.kind).toBe('item')
      if (st.kind === 'read') expect(SCENARIO.roles.every(r => r.script.some(c => c.id === st.chapter))).toBe(true)
      for (const [role, c] of Object.entries(st.choice ?? {})) {
        expect(roleIds.has(role)).toBe(true)
        for (const o of c.options) for (const e of o.effects ?? []) if ('giveClue' in e) expect(clueIds.has(e.giveClue)).toBe(true)
      }
    }
    for (const q of ACCUSE) expect(q.options.some(o => o.id === q.answer)).toBe(true)
    for (const cf of CASE_FILES) for (const q of cf.questions) expect(q.options.some(o => o.id === q.answer)).toBe(true)
  })

  test('每个角色都有小秘密卡，而且小剧本里写着"你可以先不说，也可以说出来"', () => {
    for (const r of SCENARIO.roles) {
      const grants = SCENARIO.flow.flatMap(s => s.onEnter ?? []).filter(e => 'giveClue' in e && e.role === r.id).map(e => (e as { giveClue: string }).giveClue)
      expect(grants).toContain(`${r.id}_secret`)
      expect(r.script[0].text).toMatch(/你可以先不说，也可以勇敢地说出来/)
    }
  })

  test('给小朋友的：没有吓人的字眼；入口简介不剧透', () => {
    const all = JSON.stringify(SCENARIO)
    for (const w of ['死', '杀', '血', '尸', '毒', '警察', '坐牢']) expect(all.replace(/剧本杀/g, '')).not.toContain(w)
    for (const w of ['皮皮', '浣熊', '冰箱']) expect(KIDS_META.intro).not.toContain(w)
  })
})

describe('《草莓蛋糕不见了！》唯一解', () => {
  test('全部线索在手时，真相唯一且等于标准答案', () => {
    const sols = solveAll(PUZZLE, { limit: 5 })
    expect(sols).toHaveLength(1)
    expect(sols[0]).toEqual(EXPECTED)
    expect(EXPECTED.taker).toBe(ACCUSE.find(q => q.id === 'who')!.answer)
    expect(EXPECTED.where).toBe(ACCUSE.find(q => q.id === 'where')!.answer)
    expect(EXPECTED.why).toBe(ACCUSE.find(q => q.id === 'why')!.answer)
    expect(EXPECTED.berry).toBe(ACCUSE.find(q => q.id === 'berry')!.answer)
  })

  test('逻辑模型用到的线索都存在、都拿得到', () => {
    const ok = obtainable()
    for (const c of PUZZLE.constraints) for (const id of c.clues) {
      expect(clueIds.has(id)).toBe(true)
      expect(ok.has(id)).toBe(true)
    }
  })

  test('没有一条线索能单独推出全部真相', () => {
    const all = [...new Set(PUZZLE.constraints.flatMap(c => c.clues))]
    for (const only of all) expect(solveAll(PUZZLE, { limit: 2, clueFilter: id => id === only }).length).toBeGreaterThan(1)
  })

  test('只看"黑眼罩"会怀疑熊猫圆圆；看到条纹尾巴才能确定是浣熊', () => {
    const sols = solveAll(PUZZLE, { limit: 2000, clueFilter: id => ['squirrel_saw', 'poster'].includes(id) })
    expect(new Set(sols.map(s => s.taker))).toEqual(new Set(['pippi', 'panda']))
  })

  const KEY = ['taker', 'where', 'why', 'berry'] as const
  const CASTS = [['rabbit', 'fox'], ['rabbit', 'fox', 'panda'], ['rabbit', 'fox', 'panda', 'squirrel']]
  test.each(CASTS.flatMap(cast => cast.map(r => [cast.length, r, cast] as const)))('%i 人局里单干的 %s 也能推出：谁、在哪、为什么、草莓', (_n, roleId, cast) => {
    const have = soloClues(roleId, [...cast])
    const sols = solveAll(PUZZLE, { limit: 500, clueFilter: id => have.has(id) })
    for (const k of KEY) expect(new Set(sols.map(s => s[k]))).toEqual(new Set([EXPECTED[k]]))
  })

  test('小测验的"什么时候"要大家把知道的拼起来：跳跳 12:10 看见蛋糕还在', () => {
    const have = soloClues('panda', ['rabbit', 'fox', 'panda', 'squirrel'])
    const sols = solveAll(PUZZLE, { limit: 500, clueFilter: id => have.has(id) })
    expect(new Set(sols.map(s => s.when)).size).toBeGreaterThan(1)
    const shared = solveAll(PUZZLE, { limit: 500, clueFilter: id => have.has(id) || id === 'rabbit_saw' })
    expect(new Set(shared.map(s => s.when))).toEqual(new Set(['noon']))
  })
})

// ───────── 整局流程 ─────────

let now = 1_800_000_000_000
function ok(s: GameState, seat: Seat, a: MysteryAction): GameState {
  now += 1000
  const r = E.reduce(s, seat, a, now)
  if (r.error) throw new Error(`${seat} ${JSON.stringify(a)} → ${r.error}`)
  return r.state
}
function err(s: GameState, seat: Seat, a: MysteryAction) {
  return E.reduce(s, seat, a, now).error
}
const stepId = (s: GameState) => E.scenario.flow[s.stepIndex]?.id
const search = (st: GameState, clueId: string): MysteryAction => ({ type: 'search', spotId: E.spotIdOf(st, clueId) })
const CAST: [Seat, string][] = [['P1', 'rabbit'], ['P2', 'fox'], ['P3', 'panda'], ['P4', 'squirrel']]

function start(n: 2 | 3 | 4 = 2): GameState {
  let s = E.createGame('KIDS', 3, now)
  const cast = CAST.slice(0, n)
  for (const [seat] of cast) s = E.joinSeat(s, seat, seat, now)
  for (const [seat, role] of cast) s = ok(s, seat, { type: 'pickRole', roleId: role })
  for (const [seat] of cast) s = ok(s, seat, { type: 'ready', value: true })
  return s
}

/** 一直点"准备"走到某一步（拍卖都不出价，勇气时刻都说出来，指认都选标准答案） */
function until(s: GameState, id: string): GameState {
  for (let guard = 0; stepId(s) !== id; guard++) {
    if (guard > 40) throw new Error(`没能到达 ${id}`)
    const k = E.scenario.flow[s.stepIndex].kind
    const at = s.stepIndex
    for (const seat of s.roster) {
      if (s.stepIndex !== at) break
      if (k === 'auction' && !s.auction?.results) s = ok(s, seat, { type: 'bid', bids: {} })
      else if (k === 'accuse') s = ok(s, seat, { type: 'accuse', answers: Object.fromEntries(ACCUSE.map(q => [q.id, q.answer])) })
      else if (k === 'choice' && !s.seats[seat].choices[E.scenario.flow[s.stepIndex].id]) s = ok(s, seat, { type: 'choose', optionId: 'tell' })
      else s = ok(s, seat, { type: 'ready', value: true })
    }
  }
  return s
}

describe('《草莓蛋糕不见了！》整局', () => {
  test('两个人就能开局：跳跳、狐狸必须有人演；圆圆、果果由电脑回答问话', () => {
    let s = E.createGame('KIDS', 3, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'rabbit' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'panda' })
    s = ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })
    expect(s.stepIndex).toBe(-1) // 缺橙橙
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'fox' })
    s = ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })
    expect(stepId(s)).toBe('prologue')
    const v = E.viewFor(s, 'P1', now)
    expect(v.scenario.theme).toBe('kids')
    expect(v.scenario.currency?.unit).toBe('颗橡果')
    expect(v.me.money).toBe(10)
    // 开场：蛋糕盒和小纸条大家都看得见
    expect(v.clues.map(c => c.id)).toEqual(expect.arrayContaining(['box', 'note']))
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['box', 'note']))
    s = until(s, 'search1')
    const npcs = E.viewFor(s, 'P1', now).npcs.map(n => n.id)
    expect(npcs).toEqual(expect.arrayContaining(['owl', 'sheep', 'panda_npc', 'squirrel_npc']))
    expect(npcs).not.toContain('pippi') // 第二次找线索才出现
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['rabbit_saw', 'rabbit_secret']))
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).not.toContain('rabbit_secret')
  })

  test('橡果拍卖：一颗一颗地出；出得一样多，校长收回去', () => {
    let s = until(start(), 'auction')
    expect(err(s, 'P1', { type: 'bid', bids: { lot_star: 11 } })).toBe('总出价超过了你的现金')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_flashlight: 3, lot_star: 2 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_flashlight: 3, lot_bread: 1 } })
    expect(s.clues.item_flashlight).toBeUndefined()
    expect(s.clues.item_star.owner).toBe('P1')
    expect(s.clues.item_bread.owner).toBe('P2')
    expect(s.seats.P1.money).toBe(8)
    expect(s.seats.P2.money).toBe(9)
    const log = E.viewFor(s, 'P1', now).log.map(e => e.text).join('\n')
    expect(log).toMatch(/猫头鹰校长说："不许吵架哦/)
    expect(log).toMatch(/以 2 颗橡果 拍得/)
    expect(log).not.toMatch(/\$/)
  })

  test('道具有用：手电筒能照柜子底下；面包能让小鸟开口；皮皮要拿证据去问', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_flashlight: 2 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_bread: 1 } })
    s = until(s, 'search1')
    const spots = (seat: Seat) => E.viewFor(s, seat, now).spots.map(x => E.helpers.clueOfSpot(s, x.spotId)?.id)
    expect(spots('P1')).toContain('under_cabinet')
    expect(spots('P2')).not.toContain('under_cabinet')
    s = ok(s, 'P1', search(s, 'under_cabinet'))
    expect(s.clues.under_cabinet.owner).toBe('P1')
    s = until(s, 'search2')
    // 小鸟：没面包只会喊饿
    expect(err(s, 'P1', { type: 'ask', npcId: 'bird', questionId: 'b_bread' })).toBe('这个问题还不能问')
    s = ok(s, 'P1', { type: 'ask', npcId: 'bird', questionId: 'b_hungry' })
    expect(s.seats.P1.ap).toBe(4) // 不花体力
    s = ok(s, 'P2', { type: 'ask', npcId: 'bird', questionId: 'b_bread' })
    expect(s.clues.bird_saw.owner).toBe('P2')
    // 皮皮：先要找到冰箱里的蛋糕
    expect(err(s, 'P1', { type: 'ask', npcId: 'pippi', questionId: 'p_cake' })).toBe('这个问题还不能问')
    s = ok(s, 'P1', search(s, 'fridge_cake'))
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toContain('fridge_cake') // 自动公开
    s = ok(s, 'P2', { type: 'ask', npcId: 'pippi', questionId: 'p_cake' })
    expect(s.clues.pippi_truth.owner).toBe('P2')
  })

  test('小测验：答对得 3 颗橡果', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P1', { type: 'caseFile', caseId: 'cf_quiz', answers: { prints: 'raccoon', when: 'noon' } })
    expect(s.seats.P1.money).toBe(13)
  })

  test('勇气时刻：说出来的人，小秘密卡大家都能看到；所有人都说了，每人多 2 颗星', () => {
    let s = until(start(3), 'courage')
    s = ok(s, 'P1', { type: 'choose', optionId: 'tell' })
    s = ok(s, 'P2', { type: 'choose', optionId: 'tell' })
    // 大家同时揭晓：还没走完这一步之前，别人看不到
    expect(E.viewFor(s, 'P3', now).clues.map(c => c.id)).not.toContain('rabbit_secret')
    s = ok(s, 'P3', { type: 'choose', optionId: 'keep' })
    s = until(s, 'talk2')
    expect(E.viewFor(s, 'P3', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['rabbit_secret', 'fox_secret']))
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).not.toContain('panda_secret')
    s = until(s, 'ending')
    const r = E.viewFor(s, 'P1', now).result!
    const item = (role: string, prefix: string) => r.scores.find(x => x.roleName === role)!.items.find(i => i.label.startsWith(prefix))!
    expect(item('跳跳', '勇气星').points).toBe(1)
    expect(item('圆圆', '秘密星').points).toBe(2)
    expect(item('跳跳', '全班都说出了').got).toBe(false)
    expect(r.endings.find(e => e.roleName === '圆圆')!.title).toBe('悄悄改错的小熊猫')
  })

  test('整局打完（四个人都说出秘密、全都答对）：星星、结局、真相都对', () => {
    let s = until(start(4), 'ending')
    const v = E.viewFor(s, 'P1', now)
    expect(v.scenario.scoreUnit).toBe('颗⭐')
    const r = v.result!
    expect(r.endings).toHaveLength(4)
    expect(r.headline).toMatch(/全都猜对了/)
    for (const sc of r.scores) {
      expect(sc.items.find(i => i.label.startsWith('全班都说出了'))!.got).toBe(true)
      // 4 道题 9 颗 + 勇气 1 + 全班 2 + 橡果：10 + 答对奖励 5 = 15 颗 → 5 颗星
      expect(sc.total).toBe(9 + 1 + 2 + 5)
    }
    expect(r.truth[0].text).toMatch(/皮皮/)
    expect(r.truth.length).toBeGreaterThanOrEqual(4)
    s = E.tick(s, now + 10_000)
    expect(stepId(s)).toBe('ending')
  })

  test('超时也能走完：勇气时刻没选的人，电脑替他选"先不说"', () => {
    let s = until(start(), 'courage')
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(stepId(s)).toBe('talk2')
    expect(s.seats.P1.flags.told).toBe(false)
  })
})
