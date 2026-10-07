// 《恐龙蛋失踪之夜》（给三年级以上小学生的剧本）：内容一致性、唯一解、单人可解、隐藏者藏不住、整局流程、算分
import { makeEngine } from '../core'
import { museumNight } from '../scenarios/museum-night'
import { SCENARIO, ACCUSE, CASE_FILES } from '../scenarios/museum-night/content'
import { PUZZLE, EXPECTED } from '../scenarios/museum-night/puzzle'
import { CULPRIT } from '../scenarios/museum-night/roles'
import { KIDS_META, SCENARIO_METAS } from '../scenarios/meta'
import { RUNTIMES } from '../scenarios'
import { COINS_PER_POINT, CULPRIT_POINTS, SECRET_KEPT, SUSPECT_PENALTY, TEAM_BONUS } from '../scenarios/museum-night/result'
import { solveAll } from '../solver'
import type { Cond, GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(museumNight)
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

/**
 * 某个侦探"单干"能拿到的线索（cast：这一局有人演的角色；他们的替身不出场）。
 * spots=false：一个地方都不搜，只靠自己的线索卡、开场公开的线索和问人——模拟隐藏者把能搜的线索全藏起来了。
 */
function soloClues(roleId: string, cast: string[], spots = true): Set<string> {
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
    if (spots) {
      for (const c of SCENARIO.clues) {
        if (!c.location || have.has(c.id) || (c.onlyRole && c.onlyRole !== roleId) || !ok(c.requires)) continue
        have.add(c.id); changed = true
      }
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

describe('《恐龙蛋失踪之夜》内容', () => {
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
        if (q.from) expect(stepIds.has(q.from)).toBe(true)
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
      if (st.kind === 'choice') expect(Object.keys(st.choice ?? {}).sort()).toEqual([...roleIds].sort())
      for (const [role, c] of Object.entries(st.choice ?? {})) {
        expect(roleIds.has(role)).toBe(true)
        for (const o of c.options) for (const e of o.effects ?? []) if ('giveClue' in e) expect(clueIds.has(e.giveClue)).toBe(true)
      }
    }
    for (const q of ACCUSE) {
      if (q.onlyRole) expect(roleIds.has(q.onlyRole)).toBe(true)
      if (q.notRole) expect(roleIds.has(q.notRole)).toBe(true)
      if (q.points > 0) expect(q.options.some(o => o.id === q.answer)).toBe(true)
    }
    for (const cf of CASE_FILES) for (const q of cf.questions) expect(q.options.some(o => o.id === q.answer)).toBe(true)
  })

  test('隐藏者必须有人演；剧本告诉他可以说谎；侦探的剧本写着"侦探不能说谎"，开局都有自己的秘密卡', () => {
    const culprit = SCENARIO.roles.find(r => r.id === CULPRIT)!
    expect(culprit.optional).toBeFalsy()
    expect(culprit.script[0].text).toMatch(/你是本局的隐藏者/)
    expect(culprit.script[0].text).toMatch(/可以说谎/)
    for (const r of SCENARIO.roles.filter(x => x.id !== CULPRIT)) {
      const grants = SCENARIO.flow.flatMap(s => s.onEnter ?? []).filter(e => 'giveClue' in e && e.role === r.id).map(e => (e as { giveClue: string }).giveClue)
      expect(grants).toContain(`${r.id}_secret`)
      expect(r.script[0].text).toMatch(/侦探不能说谎/)
    }
    // 开场就讲清楚规则
    expect(SCENARIO.flow[0].text).toMatch(/隐藏者/)
    expect(SCENARIO.flow[0].text).toMatch(/侦探.{0,4}：不能说谎/)
    expect(SCENARIO.flow[0].text).toMatch(/可能就在你们中间/)
  })

  test('"怎么得分"写的和真正算分的一样', () => {
    for (const r of SCENARIO.roles) {
      const g = Object.fromEntries(r.goals.map(x => [x.id, x]))
      expect(g.g_coin.text).toContain(`每 ${COINS_PER_POINT} 个金币换 1 分`)
      if (r.id === CULPRIT) {
        expect(g.c_who.points).toBe(CULPRIT_POINTS.who)
        expect(g.c_who.text).toContain(`得 ${CULPRIT_POINTS.who} 分`)
        expect(g.c_where.points).toBe(CULPRIT_POINTS.where)
        expect(g.c_where.text).toContain(`最多 ${CULPRIT_POINTS.where} 分`)
        expect(g.c_why.points).toBe(CULPRIT_POINTS.why)
        expect(g.c_why.text).toContain(`最多 ${CULPRIT_POINTS.why} 分`)
        continue
      }
      for (const q of ACCUSE.filter(x => x.notRole === CULPRIT)) expect(g[`g_${q.id}`].points).toBe(q.points)
      expect(g.g_team.points).toBe(TEAM_BONUS)
      expect(g.g_team.text).toContain(`加 ${TEAM_BONUS} 分`)
      expect(g.g_secret.points).toBe(SECRET_KEPT)
      expect(g.g_secret.text).toContain(`加 ${SECRET_KEPT} 分`)
      expect(g.g_secret.text).toContain(`扣 ${SUSPECT_PENALTY} 分`)
    }
  })

  test('秘密时刻在第二轮搜线索之前（公开了，别人才用得上）；隐藏者只答"投给谁"，侦探不答这一题', () => {
    const order = SCENARIO.flow.map(s => s.id)
    expect(order.indexOf('secret')).toBeLessThan(order.indexOf('search2'))
    expect(ACCUSE.filter(q => q.onlyRole === CULPRIT).map(q => q.id)).toEqual(['frame'])
    expect(ACCUSE.filter(q => !q.onlyRole).every(q => q.notRole === CULPRIT)).toBe(true)
  })

  test('入口页能选的故事，服务器上都有；顺序一致（第一个是默认）', () => {
    expect(SCENARIO_METAS.map(m => m.id).sort()).toEqual(Object.keys(RUNTIMES).sort())
    for (const m of SCENARIO_METAS) {
      const sc = RUNTIMES[m.id].scenario
      expect(sc.title).toBe(m.title)
      expect(sc.theme ?? 'noir').toBe(m.theme)
    }
  })

  test('给小学生的：没有吓人的字眼；不用哄幼儿园小孩的说法；入口简介不剧透', () => {
    const all = JSON.stringify(SCENARIO).replace(/剧本杀|狼人杀/g, '')
    for (const w of ['死', '杀', '血', '尸', '毒', '警察', '坐牢']) expect(all).not.toContain(w)
    for (const w of ['小侦探', '小秘密', '小剧本', '⭐', '小朋友们']) expect(all).not.toContain(w)
    for (const w of ['一鸣', '换了手环', '换手环', '闪电', '蛋筐', '摸一摸', '泡面']) expect(KIDS_META.intro).not.toContain(w)
  })
})

describe('《恐龙蛋失踪之夜》唯一解', () => {
  test('全部线索在手时，真相唯一且等于标准答案', () => {
    const sols = solveAll(PUZZLE, { limit: 5 })
    expect(sols).toHaveLength(1)
    expect(sols[0]).toEqual(EXPECTED)
    for (const k of ['who', 'where', 'why', 'blackout'] as const) {
      expect(EXPECTED[k === 'who' ? 'taker' : k]).toBe(ACCUSE.find(q => q.id === k)!.answer)
    }
    expect(EXPECTED.when).toBe(CASE_FILES[0].questions.find(q => q.id === 'when')!.answer)
    expect(EXPECTED.taker).toBe(CULPRIT)
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

  test('本案的陷阱：只知道"蓝色手环"、不知道换过手环，就定不了是谁（登记表上蓝色是小米）', () => {
    const sols = solveAll(PUZZLE, { limit: 5000, clueFilter: id => ['duoduo_secret', 'lid_zoom'].includes(id) })
    expect(new Set(sols.map(s => s.taker))).toEqual(new Set(['yiming', 'xiaomi', 'dazhuang', 'duoduo']))
    const withSwap = solveAll(PUZZLE, { limit: 5000, clueFilter: id => ['duoduo_secret', 'xiaomi_swap'].includes(id) })
    expect(new Set(withSwap.map(s => s.taker))).toEqual(new Set(['yiming']))
  })

  const KEY = ['taker', 'where', 'why', 'blackout'] as const
  const CASTS = [['yiming', 'xiaomi'], ['yiming', 'xiaomi', 'dazhuang'], ['yiming', 'xiaomi', 'duoduo'], ['yiming', 'xiaomi', 'dazhuang', 'duoduo']]
  const solvesAll = (have: Set<string>) => {
    const sols = solveAll(PUZZLE, { limit: 5000, clueFilter: id => have.has(id) })
    return KEY.every(k => sols.length > 0 && new Set(sols.map(s => s[k])).size === 1 && sols[0][k] === EXPECTED[k])
  }

  test.each(CASTS.flatMap(cast => cast.filter(r => r !== CULPRIT).map(r => [cast.length, r, cast] as const)))(
    '%i 人局里单干的 %s 也能推出：谁、在哪、为什么、停电', (_n, roleId, cast) => {
      expect(solvesAll(soloClues(roleId, [...cast]))).toBe(true)
    })

  test.each(CASTS.filter(c => !c.includes('duoduo')).flatMap(cast => cast.filter(r => r !== CULPRIT).map(r => [cast.length, r, cast] as const)))(
    '%i 人局（朵朵由电脑演）：隐藏者就算把能搜的线索全藏起来，%s 光靠问人也能破案', (_n, roleId, cast) => {
      expect(solvesAll(soloClues(roleId, [...cast], false))).toBe(true)
    })

  test.each(CASTS.filter(c => c.includes('duoduo')).map(cast => [cast.length, cast] as const))(
    '%i 人局（朵朵有人演）：朵朵自己就能破案；小米靠自己的回忆认得出隐藏者，可要找到蛋，得搜线索或者等朵朵说出来', (_n, cast) => {
      expect(solvesAll(soloClues('duoduo', [...cast], false))).toBe(true)
      const xiaomi = soloClues('xiaomi', [...cast], false)
      const sols = solveAll(PUZZLE, { limit: 5000, clueFilter: id => xiaomi.has(id) })
      expect(new Set(sols.map(s => s.taker))).toEqual(new Set(['yiming']))
      expect(solvesAll(xiaomi)).toBe(false)
      expect(solvesAll(new Set([...xiaomi, 'duoduo_secret']))).toBe(true)
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
const ask = (npcId: string, questionId: string): MysteryAction => ({ type: 'ask', npcId, questionId })
const CAST: [Seat, string][] = [['P1', 'yiming'], ['P2', 'xiaomi'], ['P3', 'dazhuang'], ['P4', 'duoduo']]
const CORRECT = Object.fromEntries(ACCUSE.filter(q => q.notRole === CULPRIT).map(q => [q.id, q.answer as string]))

function start(n: 2 | 3 | 4 = 2): GameState {
  let s = E.createGame('KIDS', 3, now)
  const cast = CAST.slice(0, n)
  for (const [seat] of cast) s = E.joinSeat(s, seat, seat, now)
  for (const [seat, role] of cast) s = ok(s, seat, { type: 'pickRole', roleId: role })
  for (const [seat] of cast) s = ok(s, seat, { type: 'ready', value: true })
  return s
}

/** 一直点"准备"走到某一步（拍卖都不出价；秘密时刻按 pick 选；投票：侦探全对，隐藏者投小米） */
function until(s: GameState, id: string, pick: (role: string) => string = r => (r === CULPRIT ? 'fake' : 'tell')): GameState {
  for (let guard = 0; stepId(s) !== id; guard++) {
    if (guard > 40) throw new Error(`没能到达 ${id}`)
    const k = E.scenario.flow[s.stepIndex].kind
    const at = s.stepIndex
    for (const seat of s.roster) {
      if (s.stepIndex !== at) break
      const role = s.seats[seat].roleId!
      if (k === 'auction' && !s.auction?.results) s = ok(s, seat, { type: 'bid', bids: {} })
      else if (k === 'accuse') s = ok(s, seat, { type: 'accuse', answers: role === CULPRIT ? { frame: 'xiaomi' } : CORRECT })
      else if (k === 'choice' && !s.seats[seat].choices[E.scenario.flow[s.stepIndex].id]) s = ok(s, seat, { type: 'choose', optionId: pick(role) })
      else s = ok(s, seat, { type: 'ready', value: true })
    }
  }
  return s
}

const cluesOf = (s: GameState, seat: Seat) => E.viewFor(s, seat, now).clues.map(c => c.id)

describe('《恐龙蛋失踪之夜》整局', () => {
  test('两个人就能开局：一鸣（隐藏者）和小米必须有人演；大壮、朵朵由电脑回答问话', () => {
    let s = E.createGame('KIDS', 3, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'xiaomi' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'dazhuang' })
    s = ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })
    expect(s.stepIndex).toBe(-1) // 缺一鸣
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'yiming' })
    s = ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })
    expect(stepId(s)).toBe('prologue')
    const v = E.viewFor(s, 'P1', now)
    expect(v.scenario.theme).toBe('kids')
    expect(v.scenario.currency?.unit).toBe('个金币')
    expect(v.scenario.scoreUnit).toBe('分')
    expect(v.me.money).toBe(10)
    expect(cluesOf(s, 'P1')).toEqual(expect.arrayContaining(['case', 'bracelets']))
    expect(cluesOf(s, 'P2')).toEqual(expect.arrayContaining(['case', 'bracelets']))
    s = until(s, 'search1')
    expect(E.viewFor(s, 'P1', now).npcs.map(n => n.id)).toEqual(expect.arrayContaining(['guard', 'guide', 'dazhuang_npc', 'duoduo_npc']))
    // 小米开局有自己的线索卡；隐藏者没有，别人也看不到小米的
    expect(cluesOf(s, 'P1')).toEqual(expect.arrayContaining(['xiaomi_swap', 'xiaomi_secret']))
    expect(cluesOf(s, 'P2')).not.toContain('xiaomi_secret')
    expect(cluesOf(s, 'P2').filter(id => !['case', 'bracelets'].includes(id))).toEqual([])
  })

  test('投票：隐藏者只看到"投给谁"，侦探看到四道题', () => {
    let s = until(start(3), 'accuse')
    expect(E.viewFor(s, 'P1', now).accuse.map(q => q.id)).toEqual(['frame'])
    expect(E.viewFor(s, 'P2', now).accuse.map(q => q.id)).toEqual(['who', 'where', 'why', 'blackout'])
    expect(E.viewFor(s, 'P1', now).accuse[0].options.map(o => o.id)).not.toContain(CULPRIT)
    s = ok(s, 'P1', { type: 'accuse', answers: { frame: 'dazhuang', who: 'xiaomi' } })
    expect(s.seats.P1.accuse).toEqual({ frame: 'dazhuang' }) // 不该答的题不收
  })

  test('工具拍卖：按金币出价；最高价一样，谁也拿不到', () => {
    let s = until(start(), 'auction')
    expect(err(s, 'P1', { type: 'bid', bids: { lot_badge: 11 } })).toBe('出价加起来，比你有的金币还多')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_uv: 3, lot_badge: 2 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_uv: 3, lot_flashlight: 1 } })
    expect(s.clues.item_uv).toBeUndefined()
    expect(s.clues.item_badge.owner).toBe('P1')
    expect(s.clues.item_flashlight.owner).toBe('P2')
    expect(s.seats.P1.money).toBe(8)
    expect(s.seats.P2.money).toBe(9)
    const log = E.viewFor(s, 'P1', now).log.map(e => e.text).join('\n')
    expect(log).toMatch(/许姐姐把这件工具放回了工具箱/)
    expect(log).toMatch(/以 2 个金币 拍得/)
    expect(log).not.toMatch(/\$/)
  })

  test('工具有用：紫外线灯照出真蛋，手电筒照出鞋印，放大镜看出是小孩的手', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_magnifier: 1 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_uv: 2, lot_flashlight: 1 } })
    s = until(s, 'search1')
    const spots = (seat: Seat) => E.viewFor(s, seat, now).spots.map(x => E.helpers.clueOfSpot(s, x.spotId)?.id)
    expect(spots('P2')).toEqual(expect.arrayContaining(['uv_egg', 'floor']))
    expect(spots('P2')).not.toContain('lid_zoom')
    expect(spots('P1')).toContain('lid_zoom')
    expect(spots('P1')).not.toContain('uv_egg')
    expect(spots('P1')).not.toContain('heavy_egg') // 第二轮才能掂
    s = ok(s, 'P2', search(s, 'uv_egg'))
    expect(s.clues.uv_egg.owner).toBe('P2')
    // 同一个地方只能搜一次：隐藏者可以抢先把线索藏起来
    s = ok(s, 'P1', search(s, 'sandbox'))
    expect(err(s, 'P2', search(s, 'sandbox'))).toBe('这里已经被搜过了')
  })

  test('问人：要先知道有人偷听，才能问许姐姐那个电话；朵朵（电脑）要拿出证据才肯说', () => {
    let s = until(start(), 'search1')
    expect(err(s, 'P1', ask('guide', 'x_call'))).toBe('这个问题还不能问')
    s = ok(s, 'P1', ask('guard', 'g_2130'))
    s = ok(s, 'P1', ask('guide', 'x_call'))
    expect(cluesOf(s, 'P1')).toContain('guide_call')
    s = ok(s, 'P1', ask('guide', 'x_swap'))
    expect(cluesOf(s, 'P1')).toContain('guide_swap')
    // 朵朵：第一轮要拿出橡皮屑；第二轮拿手环登记表就行
    expect(err(s, 'P1', ask('duoduo_npc', 'dd_eraser'))).toBe('这个问题还不能问')
    expect(err(s, 'P1', ask('duoduo_npc', 'dd_glow'))).toBe('这个问题还不能问')
    s = until(s, 'search2')
    s = ok(s, 'P1', ask('duoduo_npc', 'dd_glow'))
    expect(cluesOf(s, 'P1')).toContain('duoduo_secret')
    // 问人拿到的证词不是独占的：别人也能问到
    s = ok(s, 'P2', ask('duoduo_npc', 'dd_glow'))
    expect(cluesOf(s, 'P2')).toContain('duoduo_secret')
  })

  test('推理题：答对得 3 个金币', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'cf_dark', answers: { when: 'dark', alibi: 'guard_dz' } })
    expect(s.seats.P2.money).toBe(13)
  })

  test('秘密时刻：同时揭晓；侦探公开的是真秘密卡，隐藏者公开的是假卡；超时没选的人算"不公开"', () => {
    let s = until(start(3), 'secret')
    s = ok(s, 'P1', { type: 'choose', optionId: 'fake' })
    s = ok(s, 'P2', { type: 'choose', optionId: 'tell' })
    expect(cluesOf(s, 'P3')).not.toContain('xiaomi_secret') // 还没揭晓
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(stepId(s)).toBe('read2')
    expect(cluesOf(s, 'P3')).toEqual(expect.arrayContaining(['xiaomi_secret', 'yiming_fake']))
    expect(cluesOf(s, 'P2')).toContain('yiming_fake')
    expect(cluesOf(s, 'P1')).not.toContain('dazhuang_secret')
    expect(s.seats.P3.flags.told).toBe(false)
    // 假卡和真卡看起来一样
    const fake = E.viewFor(s, 'P3', now).clues.find(c => c.id === 'yiming_fake')!
    const real = E.viewFor(s, 'P3', now).clues.find(c => c.id === 'xiaomi_secret')!
    expect(fake.title).toBe('一鸣的秘密')
    expect(real.title).toBe('小米的秘密')
    expect(fake.kind).toBe(real.kind)
  })

  test('隐藏者坐在哪个座位都一样：假秘密卡的主人是他自己，和真秘密卡一样', () => {
    let s = E.createGame('KIDS', 3, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'xiaomi' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'yiming' })
    s = ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })
    s = until(s, 'read2')
    expect(s.clues.yiming_fake.owner).toBe('P2')
    expect(s.clues.xiaomi_secret.owner).toBe('P1')
    const fake = E.viewFor(s, 'P1', now).clues.find(c => c.id === 'yiming_fake')!
    const real = E.viewFor(s, 'P2', now).clues.find(c => c.id === 'xiaomi_secret')!
    expect(fake.holder).toBe(real.holder)
  })

  test('整局打完（4 人，侦探全投中、都公开了秘密；隐藏者用了假卡、把票投给小米）：分数、结局、真相都对', () => {
    const s = until(start(4), 'ending')
    const r = E.viewFor(s, 'P1', now).result!
    expect(r.endings).toHaveLength(4)
    expect(r.headline).toMatch(/隐藏者被侦探们识破/)
    const total = (name: string) => r.scores.find(x => x.roleName === name)!.total
    // 侦探：四题 8 + 团队奖 2 + 金币 (10 + 投票奖励 5) / 4 = 3。小米被隐藏者投了一票，可她公开了秘密，不扣分
    for (const name of ['小米', '大壮', '朵朵']) expect(total(name)).toBe(8 + TEAM_BONUS + Math.floor(15 / COINS_PER_POINT))
    // 隐藏者：三题都被投对了，只剩金币 10 / 4
    expect(total('一鸣')).toBe(Math.floor(10 / COINS_PER_POINT))
    expect(r.endings.find(e => e.roleName === '一鸣')!.title).toBe('被识破的护蛋人')
    expect(r.endings.find(e => e.roleName === '朵朵')!.title).toBe('唯一的目击者')
    expect(r.truth[0].text).toMatch(/一鸣/)
    expect(r.truth.length).toBeGreaterThanOrEqual(5)
    expect(r.accuseReview.map(q => q.prompt)).not.toContain(ACCUSE.find(q => q.id === 'frame')!.prompt)
    expect(r.accuseReview[0].picks.P1).toMatch(/隐藏者.*小米/)
  })

  test('隐藏者躲过投票：守住秘密的侦探多 2 分，被冤枉的扣分；隐藏者按没投中的比例得分', () => {
    let s = until(start(3), 'accuse', () => 'keep')
    s = ok(s, 'P1', { type: 'accuse', answers: { frame: 'xiaomi' } })
    s = ok(s, 'P2', { type: 'accuse', answers: { ...CORRECT, who: 'dazhuang' } })
    s = ok(s, 'P3', { type: 'accuse', answers: { ...CORRECT, who: 'xiaomi', where: 'backpack' } })
    const r = E.viewFor(s, 'P1', now).result!
    expect(r.headline).toMatch(/躲过了投票/)
    const sc = (name: string) => r.scores.find(x => x.roleName === name)!
    // 隐藏者：两个侦探都没投中 6；一个找错了蛋 3 × 1/2 ≈ 2；"为什么"都对了 0
    expect(sc('一鸣').items.slice(0, 3).map(i => i.points)).toEqual([CULPRIT_POINTS.who, Math.round(CULPRIT_POINTS.where / 2), 0])
    expect(sc('小米').items.find(i => i.label.startsWith('守住秘密'))).toMatchObject({ points: SECRET_KEPT, got: true })
    // 小米守着秘密，被大壮和一鸣各投了一票
    expect(sc('小米').items.find(i => i.label.startsWith('守着秘密被怀疑'))).toMatchObject({ points: -2 * SUSPECT_PENALTY, got: true })
    expect(sc('大壮').items.find(i => i.label.startsWith('守着秘密被怀疑'))).toMatchObject({ points: -SUSPECT_PENALTY })
    for (const x of r.scores) expect(x.total).toBeGreaterThanOrEqual(0)
    expect(sc('大壮').items.find(i => i.label.startsWith('团队奖'))!.got).toBe(false)
    expect(r.endings.find(e => e.roleName === '一鸣')!.title).toBe('没被认出来的护蛋人')
    expect(r.endings.find(e => e.roleName === '一鸣')!.text).toMatch(/没有一个侦探投中你/)
  })

  test('有侦探中途放弃：不算在"侦探们"里，剩下的人照样能打完', () => {
    let s = until(start(3), 'search1')
    s = E.abandonSeat(s, 'P3', now)
    for (let guard = 0; stepId(s) !== 'ending'; guard++) {
      if (guard > 40) throw new Error('卡住了')
      const k = E.scenario.flow[s.stepIndex].kind
      const at = s.stepIndex
      for (const seat of ['P1', 'P2'] as Seat[]) {
        if (s.stepIndex !== at) break
        const a: MysteryAction = k === 'auction' && !s.auction?.results ? { type: 'bid', bids: {} }
          : k === 'choice' ? { type: 'choose', optionId: 'keep' }
            : k === 'accuse' ? { type: 'accuse', answers: seat === 'P1' ? { frame: 'xiaomi' } : CORRECT }
              : { type: 'ready', value: true }
        if (k === 'choice' && s.seats[seat].choices.secret) continue
        s = ok(s, seat, a)
      }
    }
    const r = E.viewFor(s, 'P1', now).result!
    expect(r.headline).toMatch(/识破/)
    expect(r.scores.find(x => x.roleName === '小米')!.items.find(i => i.label.startsWith('团队奖'))!.got).toBe(true)
  })
})
