// 《摇摆州》整局流程 + 终局机制测试（直接驱动服务器端引擎）
// 默认三人局：P1 = 曼迪，P2 = 伊森，P3 = 乔安；四人局再加 P4 = 普雷斯顿。
import { makeEngine } from '../core'
import { swingState } from '../scenarios/swing-state'
import { CASE_FILES, ACCUSE } from '../scenarios/swing-state/content'
import { CONFESS_MARKS, DEAL_MARKS, EMPTY_ORDER, FINALE_CARDS, LAWYER_BONUS, LINES, VOUCH_BONUS, priceLineFor } from '../scenarios/swing-state/finale'
import type { FinaleState } from '../scenarios/swing-state/finale'
import { buildResult } from '../scenarios/swing-state/result'
import type { FinaleView, FinaleOrder, Who } from '../scenarios/swing-state/finaleTypes'
import type { GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(swingState)

/** 测试用：线索 id → 本局的搜查点编号；搜查点 → 线索 id */
const search = (st: GameState, clueId: string): MysteryAction => ({ type: 'search', spotId: E.spotIdOf(st, clueId) })
const spotClue = (st: GameState, x: { spotId: string }) => E.helpers.clueOfSpot(st, x.spotId)?.id
let now = 1_700_000_000_000

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
const allReady = (s: GameState) => s.roster.reduce((st, seat) => ok(st, seat, { type: 'ready', value: true }), s)

const CAST: [Seat, string][] = [['P1', 'mandy'], ['P2', 'ethan'], ['P3', 'joan'], ['P4', 'preston']]

/** n 人局开局：P1 曼迪、P2 伊森、P3 乔安、（P4 普雷斯顿） */
function start(n: 3 | 4 = 3): GameState {
  let s = E.createGame('TEST', 7, now)
  const cast = CAST.slice(0, n)
  for (const [seat] of cast) s = E.joinSeat(s, seat, seat, now)
  for (const [seat, role] of cast) s = ok(s, seat, { type: 'pickRole', roleId: role })
  for (const [seat] of cast) s = ok(s, seat, { type: 'ready', value: true })
  return s
}

function until(s: GameState, id: string): GameState {
  let guard = 0
  while (stepId(s) !== id) {
    if (++guard > 40) throw new Error(`没能到达 ${id}`)
    const k = E.scenario.flow[s.stepIndex].kind
    if (k === 'auction') {
      if (!s.auction?.results) {
        s = ok(s, 'P1', { type: 'bid', bids: { lot_lawyer: 1500, lot_headline: 0, lot_recount: 500, lot_yacht: 0 } })
        s = ok(s, 'P2', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 1200, lot_recount: 0, lot_yacht: 600 } })
        for (const seat of s.roster.slice(2)) s = ok(s, seat, { type: 'bid', bids: {} })
      }
      s = allReady(s)
    } else if (k === 'accuse') {
      for (const seat of s.roster) {
        const answers = Object.fromEntries(ACCUSE.map(q => [q.id, q.answer]))
        s = ok(s, seat, { type: 'accuse', answers })
      }
    } else {
      s = allReady(s)
    }
  }
  return s
}

function searchAll(s: GameState, seat: Seat): GameState {
  for (let i = 0; i < 40; i++) {
    const v = E.viewFor(s, seat, now)
    const spot = v.spots.find(x => x.status === 'open' && x.cost <= v.me.ap)
    if (spot) { s = ok(s, seat, { type: 'search', spotId: spot.spotId }); continue }
    const q = v.npcs.flatMap(n => n.questions.filter(x => !x.asked && x.cost <= v.me.ap).map(x => ({ n: n.id, q: x.id })))[0]
    if (q) { s = ok(s, seat, { type: 'ask', npcId: q.n, questionId: q.q }); continue }
    break
  }
  return s
}

const fv = (s: GameState, seat: Seat) => E.viewFor(s, seat, now).finale as FinaleView
function order(s: GameState, seat: Seat, o: Partial<FinaleOrder>) {
  return ok(s, seat, { type: 'finale', payload: { type: 'order', order: { ...EMPTY_ORDER, ...o } } })
}
function deal(s: GameState, seat: Seat, choice: 'accept' | 'refuse', target?: string) {
  return ok(s, seat, { type: 'finale', payload: { type: 'deal', choice, ...(target ? { target } : {}) } })
}

describe('《摇摆州》流程', () => {
  test('三人才能开局；普雷斯顿可以没人演（电脑替他回答问话）；第四个人来了他就由玩家扮演', () => {
    let s = E.createGame('TEST', 7, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
    expect(err(s, 'P1', { type: 'ready', value: true })).toMatch(/至少 3 个人/)
    s = E.joinSeat(s, 'P3', 'C', now)
    const lobbyReady = (st: GameState) => (['P1', 'P2', 'P3'] as Seat[]).reduce((x, seat) => ok(x, seat, { type: 'ready', value: true }), st)
    // 乔安是必选角色：三个人里不能缺她
    s = ok(s, 'P3', { type: 'pickRole', roleId: 'preston' })
    s = lobbyReady(s)
    expect(s.stepIndex).toBe(-1)
    s = ok(s, 'P3', { type: 'pickRole', roleId: 'joan' })
    s = lobbyReady(s)
    expect(s.stepIndex).toBe(0)
    expect(s.roster).toEqual(['P1', 'P2', 'P3'])
    const npcs3 = until(s, 'search1')
    expect(E.viewFor(npcs3, 'P1', now).npcs.map(n => n.id)).toContain('preston')
    expect(E.viewFor(npcs3, 'P1', now).npcs.map(n => n.id)).not.toContain('joan')
    const s4 = until(start(4), 'search1')
    expect(s4.roster).toEqual(['P1', 'P2', 'P3', 'P4'])
    expect(E.viewFor(s4, 'P1', now).npcs.map(n => n.id)).not.toContain('preston')
  })

  test('开局发放：每个人第一、二幕各自拿到自己的目击、自白与证词', () => {
    let s = start(4)
    expect(stepId(s)).toBe('prologue')
    s = allReady(s)
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toContain('frank_letter')
    expect(E.viewFor(s, 'P3', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['joan_2000', 'police_2000']))
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).not.toContain('frank_letter')
    s = until(s, 'act2')
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['a_saw', 'a_confess']))
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['b_saw', 'b_confess', 'frank_letter']))
    expect(E.viewFor(s, 'P3', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['joan_rose', 'joan_notes', 'joan_ethan']))
    expect(E.viewFor(s, 'P4', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['preston_thud', 'preston_safe']))
    // 私密剧本互不可见
    expect(E.viewFor(s, 'P1', now).me.chapters.some(c => c.text.includes('我叫伊森'))).toBe(false)
    expect(E.viewFor(s, 'P1', now).me.chapters.some(c => c.text.includes('我叫乔安·默瑟'))).toBe(false)
    expect(E.viewFor(s, 'P3', now).me.chapters.some(c => c.text.includes('我叫乔安·默瑟'))).toBe(true)
  })

  test('拍卖：价高者得、付自己的出价；最高价有人一样就被维克多截走', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_lawyer: 1500, lot_headline: 800, lot_recount: 0, lot_yacht: 0 } })
    expect(err(s, 'P1', { type: 'bid', bids: {} })).toBe('你已经提交了出价')
    expect(err(s, 'P2', { type: 'bid', bids: { lot_lawyer: 50 } })).toMatch(/最低出价/)
    expect(err(s, 'P2', { type: 'bid', bids: { lot_lawyer: 7000 } })).toBe('总出价超过了你的现金')
    s = ok(s, 'P2', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 800, lot_recount: 0, lot_yacht: 600 } })
    expect(s.auction?.results).toBeNull()
    expect(E.viewFor(s, 'P3', now).auction!.submitted).toEqual(['P1', 'P2'])
    s = ok(s, 'P3', { type: 'bid', bids: { lot_recount: 700, lot_yacht: 500 } })
    expect(s.auction?.results).toBeTruthy()
    expect(s.seats.P1.money).toBe(6000 - 1500)
    expect(s.seats.P2.money).toBe(6000 - 600)
    expect(s.seats.P3.money).toBe(6000 - 700)
    expect(s.clues.item_lawyer.owner).toBe('P1')
    expect(s.clues.item_yacht.owner).toBe('P2')
    expect(s.clues.item_recount.owner).toBe('P3')
    expect(s.clues.item_headline).toBeUndefined() // 平局 → 维克多
    const r = E.viewFor(s, 'P1', now).auction!.results!
    expect(r.find(x => x.lot === 'lot_recount')!.bids).toEqual({ P1: 0, P2: 0, P3: 700 })
  })

  test('目标随剧情解锁', () => {
    let s = until(start(), 'act1')
    expect(E.viewFor(s, 'P1', now).me.goals.map(g => g.id)).toEqual(['m_truth'])
    expect(E.viewFor(s, 'P3', now).me.goals.map(g => g.id)).toEqual(['j_story'])
    s = until(s, 'act3')
    expect(E.viewFor(s, 'P1', now).me.goals.map(g => g.id)).toEqual(['m_truth', 'm_free', 'm_tower', 'm_inherit'])
    expect(E.viewFor(s, 'P3', now).me.goals.map(g => g.id)).toEqual(['j_story', 'j_free', 'j_rose', 'j_headline'])
  })

  test('安保系统只有伊森能查；保险箱需要钥匙＋罗丝的信；交线索要选交给谁', () => {
    let s = until(start(), 'search1')
    const spotsA = E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))
    const spotsB = E.viewFor(s, 'P2', now).spots.map(x => spotClue(s, x))
    expect(spotsA).not.toContain('door_log')
    expect(spotsB).toContain('door_log')
    s = until(s, 'search2')
    // 曼迪有信但没有钥匙
    expect(E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))).not.toContain('will')
    // 三个人时，交出线索必须说交给谁
    expect(err(s, 'P2', { type: 'give', clueId: 'safe_key' })).toBe('请选择交给谁')
    expect(err(s, 'P2', { type: 'give', clueId: 'safe_key', to: 'P2' })).toBe('请选择交给谁')
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key', to: 'P1' })
    expect(s.clues.safe_key.owner).toBe('P1')
    expect(E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))).toContain('will')
    s = ok(s, 'P1', search(s, 'will'))
    expect(s.clues.will.owner).toBe('P1')
  })

  test('案卷：标准答案能领酬金', () => {
    let s = until(start(), 'search2')
    const before = s.seats.P1.money
    for (const cf of CASE_FILES) {
      const answers = Object.fromEntries(cf.questions.map(q => [q.id, q.answer]))
      s = ok(s, 'P1', { type: 'caseFile', caseId: cf.id, answers })
    }
    expect(s.seats.P1.money - before).toBe(3000 + 3000 + 4000)
  })

  test('盘凶全对：每题 $1,000 酬金', () => {
    let s = until(start(), 'accuse')
    const before = s.seats.P1.money
    s = until(s, 'finale')
    expect(s.seats.P1.money - before).toBe(ACCUSE.length * 1000)
  })
})

function toFinale(opts: { cooperative?: boolean; n?: 3 | 4 } = {}) {
  let s = until(start(opts.n ?? 3), 'search1')
  s = searchAll(s, 'P1')
  s = searchAll(s, 'P2')
  s = until(s, 'search2')
  if (opts.cooperative) {
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key', to: 'P1' })
  }
  s = searchAll(s, 'P1')
  s = searchAll(s, 'P2')
  s = until(s, 'finale')
  return s
}

const orderAction = (o: Partial<FinaleOrder>, round?: number): MysteryAction =>
  ({ type: 'finale', payload: { type: 'order', ...(round !== undefined ? { round } : {}), order: { ...EMPTY_ORDER, ...o } } })
const ready = (s: GameState, seat: Seat) => ok(s, seat, { type: 'finale', payload: { type: 'ready' } })
/** 还没选的人这一轮都不交（名单按开始时算：最后一个人交完就揭晓了，不能落到下一轮） */
const pass = (s: GameState) => {
  const f = s.finale as FinaleState
  return s.roster.filter(seat => !f.orders[seat]).reduce((st, seat) => order(st, seat, {}), s)
}
/** 还没回复的人都拒绝交易 */
const refuseAll = (s: GameState) => {
  const f = s.finale as FinaleState
  return s.roster.filter(seat => !f.deal[seat]).reduce((st, seat) => deal(st, seat, 'refuse'), s)
}
const person = (s: GameState, seat: Seat, who: Who) => fv(s, seat).people.find(p => p.who === who)!
const outcome = (s: GameState) => fv(s, 'P1').outcome!
/** 只指向普莱斯的证据（交出去不会牵连交的人） */
const priceCards = (s: GameState, seat: Seat) => fv(s, seat).hand.filter(c => !c.confessor && c.points.length === 1 && c.points[0] === 'price').map(c => c.id)
/** 测试用：直接把一条线索放到某人手里 */
function own(s: GameState, seat: Seat, id: string): GameState {
  const st = structuredClone(s)
  st.clues[id] = { ...(st.clues[id] ?? { public: false, seenBy: [], foundAt: now, foundBy: seat }), owner: seat, seenBy: [seat] }
  return st
}
function toRound1(opts: { cooperative?: boolean; n?: 3 | 4 } = {}) {
  const s = toFinale(opts)
  return s.roster.reduce((st, seat) => ready(st, seat), s)
}
const scoreOf = (s: GameState, role: string, prefix: string) =>
  E.viewFor(s, 'P1', now).result!.scores.find(x => x.roleName === role)!.items.find(i => i.label.startsWith(prefix))!
const ending = (s: GameState, role: string) => E.viewFor(s, 'P1', now).result!.endings.find(e => e.roleName === role)!

describe('《摇摆州》终局「警长的名单」', () => {
  test('开场：先看规则，所有人都点「我看懂了」才开始第一轮', () => {
    let s = toFinale()
    expect(fv(s, 'P1').phase).toBe('intro')
    expect(err(s, 'P1', orderAction({}))).toMatch(/不是交证据/)
    s = ready(s, 'P1')
    expect(fv(s, 'P1').phase).toBe('intro')
    expect(fv(s, 'P2').waitingFor).toEqual(['乔安'])
    expect(fv(s, 'P1').waitingFor).toEqual(['伊森', '乔安'])
    s = ready(s, 'P2')
    expect(fv(s, 'P1').phase).toBe('intro')
    s = ready(s, 'P3')
    expect(fv(s, 'P1').phase).toBe('orders')
    expect(fv(s, 'P1').round).toBe(1)
  })

  test('开场说明到点自动开始', () => {
    let s = toFinale()
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(fv(s, 'P1').phase).toBe('orders')
  })

  test('名单：每位玩家角色加普莱斯医生；人越多普莱斯要的格子越多；律师名片多一格', () => {
    const s = toRound1()
    const v = fv(s, 'P1')
    expect(v.people.map(p => p.who)).toEqual(['mandy', 'ethan', 'joan', 'price'])
    // P1（曼迪）在拍卖里拿到了律师名片
    expect(v.people.map(p => p.line)).toEqual([LINES.mandy + LAWYER_BONUS, LINES.ethan, LINES.joan, priceLineFor(3)])
    expect(priceLineFor(3)).toBe(7)
    expect(priceLineFor(4)).toBe(8)
    expect(v.people[0].lineParts).toEqual({ base: LINES.mandy, lawyer: LAWYER_BONUS, vouch: 0 })
    expect(v.people.every(p => p.count === 0 && !p.confessed)).toBe(true)
    expect(v.people.find(p => p.isMe)!.who).toBe('mandy')
    expect(fv(s, 'P3').people.find(p => p.isMe)!.who).toBe('joan')
    const s4 = toRound1({ n: 4 })
    expect(fv(s4, 'P4').people.map(p => p.who)).toEqual(['mandy', 'ethan', 'joan', 'preston', 'price'])
    expect(fv(s4, 'P4').people.at(-1)!.line).toBe(8)
  })

  test('手里只有指向名单上的人的证据，每份都说明为什么；自白标成认罪；别人手里的看不到', () => {
    let s = toRound1()
    // 三人局没有普雷斯顿：只指向他的证据、他的自白都用不上
    s = own(s, 'P1', 'v_preston')
    s = own(s, 'P1', 'preston_safe')
    const v1 = fv(s, 'P1')
    const v2 = fv(s, 'P2')
    const v3 = fv(s, 'P3')
    for (const c of [...v1.hand, ...v2.hand, ...v3.hand]) {
      expect(c.id in FINALE_CARDS).toBe(true)
      expect(c.points.length).toBeGreaterThan(0)
      expect(c.points.every(w => ['mandy', 'ethan', 'joan', 'price'].includes(w))).toBe(true)
      expect(c.why.length).toBeGreaterThan(5)
      expect(c.text).not.toMatch(/代价/)
    }
    expect(v1.hand.map(h => h.id)).not.toContain('v_preston')
    expect(v1.hand.map(h => h.id)).not.toContain('preston_safe')
    expect(v1.hand.find(h => h.id === 'a_confess')!.confessor).toBe('mandy')
    expect(v2.hand.find(h => h.id === 'b_confess')!.confessor).toBe('ethan')
    expect(v3.hand.find(h => h.id === 'joan_rose')!.confessor).toBe('joan')
    expect(v3.hand.map(h => h.id)).toEqual(expect.arrayContaining(['joan_2000', 'joan_ethan']))
    expect(v2.hand.map(h => h.id)).toContain('b_saw')
    expect(JSON.stringify(v1)).not.toContain('b_confess')
    expect(JSON.stringify(v1)).not.toContain('joan_rose')
    // 四人局：指向普雷斯顿的证据可以交；他自己的坦白只有他能交
    let s4 = toRound1({ n: 4 })
    s4 = own(s4, 'P1', 'v_preston')
    expect(fv(s4, 'P1').hand.find(h => h.id === 'v_preston')!.points).toEqual(['preston'])
    expect(fv(s4, 'P4').hand.find(h => h.id === 'preston_safe')!.confessor).toBe('preston')
    expect(fv(s4, 'P4').hand.find(h => h.id === 'preston_thud')!.points).toEqual(['ethan'])
  })

  test('别人的自白交不了：曼迪把自白塞给伊森，伊森也没法替她"认罪"', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P1', { type: 'give', clueId: 'a_confess', to: 'P2' })
    s = until(s, 'finale')
    s = s.roster.reduce((st, seat) => ready(st, seat), s)
    expect(fv(s, 'P2').hand.map(h => h.id)).not.toContain('a_confess')
    expect(err(s, 'P2', orderAction({ card: 'a_confess' }))).toBe('只能交出你手里的证据')
  })

  test('交证据的规则：只能交自己的；头版要配一份证据；出海只在第三轮；没有的道具不能用', () => {
    const s = toRound1()
    expect(err(s, 'P1', orderAction({ card: 'b_saw' }))).toBe('只能交出你手里的证据')
    expect(err(s, 'P1', orderAction({ card: 'a_saw', headline: true }))).toMatch(/没有可用的「头版」/)
    expect(err(s, 'P2', orderAction({ headline: true }))).toMatch(/要配合一份证据/)
    expect(err(s, 'P2', orderAction({ flee: true }))).toMatch(/第三轮/)
    expect(err(s, 'P2', orderAction({ recount: true }))).toMatch(/放大镜/)
  })

  test('揭晓：所有人都选好才揭晓；证据指向谁就给谁填一格，同时指向两个人的各一格', () => {
    let s = toRound1()
    s = own(s, 'P2', 'hector_corridor')
    s = order(s, 'P1', { card: 'a_saw' })
    s = order(s, 'P2', { card: 'hector_corridor' })
    expect(fv(s, 'P1').round).toBe(1)
    expect(fv(s, 'P1').waitingFor).toEqual(['乔安'])
    s = order(s, 'P3', { card: 'joan_ethan' })
    expect(fv(s, 'P1').phase).toBe('orders')
    expect(fv(s, 'P1').round).toBe(2)
    expect(person(s, 'P1', 'ethan').count).toBe(2)
    expect(person(s, 'P1', 'mandy').count).toBe(1)
    expect(person(s, 'P1', 'price').count).toBe(1)
    expect(person(s, 'P1', 'joan').count).toBe(0)
    expect(fv(s, 'P1').reveals.at(-1)!.lines.join('\n')).toMatch(/曼迪的目击.*伊森 \+1 格/)
    expect(fv(s, 'P1').reveals.at(-1)!.lines.at(-1)).toMatch(/乔安 0 格/)
    // 交过的证据离开手里；格子标明是谁交的
    expect(fv(s, 'P1').hand.map(h => h.id)).not.toContain('a_saw')
    expect(person(s, 'P2', 'ethan').marks.map(m => [m.by, m.from])).toEqual([['other', '曼迪'], ['other', '乔安']])
    expect(person(s, 'P2', 'mandy').marks[0]).toMatchObject({ by: 'me', from: '伊森' })
  })

  test('认罪：交出自己的自白，普莱斯 +2，06:00 自己一定被带走（哪怕格子没满）', () => {
    let s = toRound1()
    s = pass(order(s, 'P1', { card: 'a_confess' }))
    expect(person(s, 'P1', 'price').count).toBe(CONFESS_MARKS)
    expect(person(s, 'P1', 'mandy').count).toBe(0)
    expect(person(s, 'P1', 'mandy').confessed).toBe(true)
    s = pass(refuseAll(pass(s)))
    const o = outcome(s)
    expect(o.confessed.mandy).toBe(true)
    expect(o.taken.mandy).toBe(true)
    expect(o.taken.price).toBe(false)
    // 伊森"让毒死母亲的人付出代价"达成；曼迪被带走、普莱斯没被带走：自身 0 分
    expect(scoreOf(s, '伊森', '让毒死母亲的人').got).toBe(true)
    expect(scoreOf(s, '曼迪', '自身').got).toBe(false)
    expect(ending(s, '曼迪').title).toBe('一个人的认罪')
  })

  test('乔安的坦白：她认罪，普莱斯 +2；她被带走不从轻（自身 0 分）', () => {
    let s = toRound1()
    s = pass(order(s, 'P3', { card: 'joan_rose' }))
    expect(person(s, 'P1', 'joan').confessed).toBe(true)
    expect(person(s, 'P1', 'price').count).toBe(CONFESS_MARKS)
    s = pass(refuseAll(pass(s)))
    expect(outcome(s).taken.joan).toBe(true)
    expect(scoreOf(s, '乔安', '自身').got).toBe(false)
    expect(ending(s, '乔安').title).toBe('迟到的报道')
  })

  test('头版：一份证据算两份；按道具记，用过就不能再用', () => {
    let s = toRound1()
    s = pass(order(s, 'P2', { card: 'b_saw', headline: true }))
    expect(person(s, 'P1', 'mandy').count).toBe(2)
    expect(fv(s, 'P2').items.find(i => i.kind === 'headline')!.used).toBe(true)
    expect((s.finale as FinaleState).usedItems).toContain('item_headline')
    const card = fv(s, 'P2').hand[0].id
    expect(err(s, 'P2', orderAction({ card, headline: true }))).toMatch(/头版/)
  })

  test('放大镜：这一轮别人交出的证据里，给自己填的格全部作废；同一份证据给别人填的格照算；没人给你填格就不消耗', () => {
    let s = toRound1()
    // 第 1 轮没人给曼迪填格：不消耗
    s = pass(order(order(s, 'P1', { recount: true }), 'P2', { card: 'b_confess' }))
    expect(fv(s, 'P1').items.find(i => i.kind === 'recount')!.used).toBe(false)
    // 别人的认罪不受影响
    expect(person(s, 'P1', 'ethan').confessed).toBe(true)
    expect(person(s, 'P1', 'price').count).toBe(CONFESS_MARKS)
    // 第 2 轮：伊森和乔安都给曼迪填格
    s = own(s, 'P2', 'hector_corridor')
    s = own(s, 'P3', 'hector_tray')
    s = order(s, 'P1', { recount: true })
    s = order(s, 'P2', { card: 'hector_corridor' })
    s = order(s, 'P3', { card: 'hector_tray' })
    const m = person(s, 'P1', 'mandy')
    expect(m.count).toBe(0)
    expect(m.marks.filter(x => x.void)).toHaveLength(2)
    expect(person(s, 'P1', 'price').count).toBe(CONFESS_MARKS + 1)
    expect(fv(s, 'P1').items.find(i => i.kind === 'recount')!.used).toBe(true)
    expect(fv(s, 'P2').reveals.at(-1)!.lines.join('\n')).toMatch(/给曼迪填的 2 格作废/)
  })

  test('交易在第二轮之后：所有人都拒绝 → 普莱斯慌了，他 +2；谁也不保', () => {
    let s = pass(toRound1())
    expect(fv(s, 'P1').phase).toBe('orders')
    s = pass(s)
    expect(fv(s, 'P1').phase).toBe('deal')
    expect(fv(s, 'P1').deal!.targets.map(t => t.who)).toEqual(['ethan', 'joan'])
    s = refuseAll(s)
    expect(person(s, 'P1', 'price').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'price').marks.every(m => m.kind === 'panic')).toBe(true)
    expect(fv(s, 'P1').people.some(p => p.lineParts.vouch > 0)).toBe(false)
    expect(fv(s, 'P1').phase).toBe('orders')
    expect(fv(s, 'P1').round).toBe(3)
    expect(outcome).toBeTruthy()
  })

  test('交易：接受时必须点名，而且不能点自己', () => {
    const s = pass(pass(toRound1()))
    const act = (target?: string): MysteryAction => ({ type: 'finale', payload: { type: 'deal', choice: 'accept', ...(target ? { target } : {}) } })
    expect(err(s, 'P1', act())).toMatch(/让他去告谁/)
    expect(err(s, 'P1', act('mandy'))).toMatch(/让他去告谁/)
    expect(err(s, 'P1', act('preston'))).toMatch(/让他去告谁/) // 三人局没有普雷斯顿
    expect(err(s, 'P1', act('price'))).toMatch(/让他去告谁/)
  })

  test('交易：只有一个人接受 → 普莱斯保他（多 2 格才会被带走），并告他点名的人 +2', () => {
    let s = pass(pass(toRound1()))
    s = refuseAll(deal(s, 'P1', 'accept', 'joan'))
    expect(person(s, 'P1', 'mandy').lineParts.vouch).toBe(VOUCH_BONUS)
    expect(person(s, 'P1', 'mandy').line).toBe(LINES.mandy + LAWYER_BONUS + VOUCH_BONUS)
    expect(person(s, 'P1', 'joan').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'joan').marks.every(m => m.kind === 'accused')).toBe(true)
    expect(person(s, 'P1', 'ethan').count).toBe(0)
    expect(person(s, 'P1', 'price').count).toBe(0)
    expect(fv(s, 'P2').deal!.result).toEqual({ accepted: ['mandy'], vouched: 'mandy', accused: ['joan'], panic: false })
    expect((s.finale as FinaleState).secrets.join()).toMatch(/曼迪接受了普莱斯的交易，点名让他去告乔安/)
  })

  test('交易：不止一个人接受 → 普莱斯把接受的人全告了，谁也不保；拒绝的人没事', () => {
    let s = pass(pass(toRound1()))
    s = deal(deal(s, 'P1', 'accept', 'ethan'), 'P2', 'accept', 'mandy')
    s = deal(s, 'P3', 'refuse')
    expect(person(s, 'P1', 'mandy').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'ethan').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'joan').count).toBe(0)
    expect(fv(s, 'P1').people.some(p => p.lineParts.vouch > 0)).toBe(false)
    expect(fv(s, 'P3').deal!.result).toMatchObject({ accepted: ['mandy', 'ethan'], vouched: null, accused: ['mandy', 'ethan'] })
  })

  test('普莱斯被带走：他保的不算，告的格子全部擦掉', () => {
    let s = toRound1()
    for (const id of ['med_bag', 'rx_pad', 'golf_card']) s = own(s, 'P1', id)
    for (const id of ['printer_log', 'frank_log', 'mei_diary']) s = own(s, 'P2', id)
    s = order(order(order(s, 'P1', { card: 'med_bag' }), 'P2', { card: 'printer_log' }), 'P3', { card: 'joan_2000' })
    s = pass(order(order(s, 'P1', { card: 'rx_pad' }), 'P2', { card: 'frank_log' }))
    s = refuseAll(deal(s, 'P2', 'accept', 'mandy'))
    expect(person(s, 'P1', 'mandy').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'ethan').lineParts.vouch).toBe(VOUCH_BONUS)
    s = pass(order(order(s, 'P1', { card: 'golf_card' }), 'P2', { card: 'mei_diary' }))
    expect(stepId(s)).toBe('ending')
    const o = outcome(s)
    expect(o.counts.price).toBe(7)
    expect(o.taken.price).toBe(true)
    expect(o.counts.mandy).toBe(0)
    expect(o.taken.mandy).toBe(false)
    expect(o.lines.ethan).toBe(LINES.ethan)
    expect(person(s, 'P1', 'mandy').marks.every(m => m.void)).toBe(true)
    expect(person(s, 'P1', 'ethan').lineParts.vouch).toBe(0)
    expect(fv(s, 'P1').reveals.at(-1)!.lines.join('\n')).toMatch(/全部擦掉/)
  })

  test('普莱斯没被带走：他的"保"算数，曼迪多扛 2 格；被告的伊森满格被带走', () => {
    let s = toRound1()
    s = own(s, 'P2', 'hector_tray')
    s = own(s, 'P2', 'hector_corridor')
    s = pass(order(s, 'P2', { card: 'hector_corridor' }))
    s = pass(order(s, 'P2', { card: 'b_saw', headline: true }))
    s = refuseAll(deal(s, 'P1', 'accept', 'ethan'))
    s = pass(order(order(s, 'P1', { card: 'a_saw' }), 'P2', { card: 'hector_tray' }))
    const o = outcome(s)
    expect(o.taken.price).toBe(false)
    expect(o.counts.mandy).toBe(4)
    expect(o.lines.mandy).toBe(LINES.mandy + LAWYER_BONUS + VOUCH_BONUS)
    expect(o.taken.mandy).toBe(false)
    expect(o.savedByVouch.mandy).toBe(true)
    // 伊森：普莱斯告的 2 格 + 曼迪的目击 1 格 = 3 格，满了
    expect(o.counts.ethan).toBe(3)
    expect(o.taken.ethan).toBe(true)
    expect(ending(s, '曼迪').title).toBe('欠下的人情')
  })

  test('06:00：满格的人被带走；律师名片让曼迪多扛一格', () => {
    let s = toRound1()
    s = own(s, 'P1', 'earpiece')
    s = own(s, 'P1', 'joan_ethan')
    s = own(s, 'P2', 'hector_tray')
    s = pass(order(order(s, 'P1', { card: 'a_saw' }), 'P2', { card: 'b_saw', headline: true }))
    s = pass(order(order(s, 'P1', { card: 'earpiece' }), 'P2', { card: 'hector_tray' }))
    s = refuseAll(s)
    s = pass(order(s, 'P1', { card: 'joan_ethan' }))
    const o = outcome(s)
    expect(o.counts.mandy).toBe(3)
    expect(o.lines.mandy).toBe(LINES.mandy + LAWYER_BONUS)
    expect(o.taken.mandy).toBe(false)
    expect(o.counts.ethan).toBe(3)
    expect(o.taken.ethan).toBe(true)
    expect(scoreOf(s, '伊森', '自身').got).toBe(false)
    expect(scoreOf(s, '曼迪', '让灯塔上那个人').got).toBe(true)
    // 伊森被带走：杀人者不得继承
    expect(o.ethanInherits).toBe(false)
  })

  test('整局打完：合作路线（交出钥匙开保险箱、都拒绝交易、一起把证据交给警长指证普莱斯）', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', search(s, 'frank_log'))
    s = ok(s, 'P3', search(s, 'med_bag'))
    s = until(s, 'search2')
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key', to: 'P1' })
    for (const id of ['will', 'confession', 'mei_diary', 'dna']) s = ok(s, 'P1', search(s, id))
    s = ok(s, 'P2', search(s, 'price_suit'))
    s = until(s, 'finale')
    s = s.roster.reduce((st, seat) => ready(st, seat), s)

    s = order(order(order(s, 'P1', { card: 'confession' }), 'P2', { card: 'frank_log' }), 'P3', { card: 'joan_2000' })
    s = order(order(order(s, 'P1', { card: 'mei_diary' }), 'P2', { card: 'price_suit' }), 'P3', { card: 'med_bag' })
    s = refuseAll(s)
    expect(person(s, 'P1', 'price').count).toBe(6 + DEAL_MARKS)
    s = pass(order(order(s, 'P1', { card: 'rose_letter' }), 'P2', { card: 'frank_letter' }))
    expect(stepId(s)).toBe('ending')
    const o = outcome(s)
    expect(o.cast).toEqual(['mandy', 'ethan', 'joan'])
    expect(o.taken).toEqual({ mandy: false, ethan: false, joan: false, preston: false, price: true })
    expect(o.meiReopened).toBe(true)
    expect(o.will).toBe('executed')
    expect(o.mandyInherits).toBe(true)
    expect(o.ethanInherits).toBe(true)
    const v = E.viewFor(s, 'P1', now)
    expect(v.result!.headline).toMatch(/2000 年谋杀/)
    const missedOf = (role: string) => v.result!.scores.find(x => x.roleName === role)!.items.filter(i => !i.got && !i.label.startsWith('剩余现金')).map(i => i.label)
    // 曼迪、伊森：指认全对 + 真相、平安、遗产；"让对方付出代价"是唯一没拿到的——合作就意味着原谅
    for (const role of ['曼迪', '伊森']) {
      expect(missedOf(role)).toHaveLength(1)
      expect(missedOf(role)[0]).toMatch(/付出代价/)
    }
    // 乔安：稿子、平安、罗丝、头版全拿到
    expect(missedOf('乔安')).toEqual([])
    expect(v.result!.endings.map(e => e.roleName).sort()).toEqual(['乔安', '伊森', '曼迪'].sort())
    expect(ending(s, '乔安').title).toBe('十六年后的头版')
    expect(E.viewFor(s, 'P2', now).result!.truth.length).toBeGreaterThan(3)
  })

  test('两难是真的：一个人背叛、另外两人合作——合作的人可以用认罪把普莱斯拉下来，但会被带走', () => {
    const setup = () => {
      let s = toRound1()
      for (const id of ['med_bag', 'rx_pad']) s = own(s, 'P1', id)
      for (const id of ['hector_tray', 'hector_corridor']) s = own(s, 'P2', id)
      // 曼迪、乔安交指向普莱斯的证据；伊森两轮都交指向曼迪的证据
      s = order(order(order(s, 'P1', { card: 'med_bag' }), 'P2', { card: 'b_saw' }), 'P3', { card: 'joan_2000' })
      s = pass(order(order(s, 'P1', { card: 'rx_pad' }), 'P2', { card: 'hector_tray' }))
      return refuseAll(s)
    }
    // 第三轮再交一份普莱斯的证据：1+1+1+说漏嘴 2+1=6，不够 7——光靠证据扳不倒他
    let a = setup()
    a = pass(order(a, 'P1', { card: 'rose_letter' }))
    const oa = outcome(a)
    expect(oa.counts.price).toBe(6)
    expect(oa.taken.price).toBe(false)
    // 曼迪第三轮认罪：普莱斯 3+2+2=7，被带走；曼迪也被带走（从轻），伊森"付出代价"达成
    let b = setup()
    b = pass(order(b, 'P1', { card: 'a_confess' }))
    const ob = outcome(b)
    expect(ob.taken.price).toBe(true)
    expect(ob.taken.mandy).toBe(true)
    expect(scoreOf(b, '曼迪', '自身').points).toBe(10)
    expect(scoreOf(b, '伊森', '让毒死母亲的人').got).toBe(true)
    // 也可以是乔安替大家认罪：普莱斯被带走，她自己被带走（不从轻）
    let c = setup()
    c = pass(order(c, 'P3', { card: 'joan_rose' }))
    const oc = outcome(c)
    expect(oc.taken.price).toBe(true)
    expect(oc.taken.joan).toBe(true)
    expect(oc.taken.mandy).toBe(false)
    expect(scoreOf(c, '乔安', '自身').got).toBe(false)
    expect(scoreOf(c, '乔安', '写完十六年前').got).toBe(true)
    // 曼迪、伊森互相背叛（都只交指向对方的证据）：普莱斯只有说漏嘴的 2 格 + 空瓶 1 格，逍遥法外
    let d = toRound1()
    for (const id of ['earpiece', 'joan_ethan']) d = own(d, 'P1', id)
    for (const id of ['hector_tray', 'clutch']) d = own(d, 'P2', id)
    d = pass(order(order(d, 'P1', { card: 'a_saw' }), 'P2', { card: 'b_saw' }))
    d = pass(order(order(d, 'P1', { card: 'earpiece' }), 'P2', { card: 'hector_tray' }))
    d = refuseAll(d)
    d = pass(order(order(d, 'P1', { card: 'joan_ethan' }), 'P2', { card: 'clutch' }))
    const od = outcome(d)
    expect(od.taken).toEqual({ mandy: false, ethan: true, joan: false, preston: false, price: false })
    expect(od.counts.mandy).toBe(3) // 律师名片：曼迪要 4 格
    expect(od.meiReopened).toBe(false)
  })

  test('超时：没交视为这一轮不交，没回复交易视为拒绝，整局仍能结束', () => {
    let s = toFinale()
    for (let i = 0; i < 8 && stepId(s) === 'finale'; i++) {
      now = E.nextDeadline(s)! + 1
      s = E.tick(s, now)
    }
    expect(stepId(s)).toBe('ending')
    expect(outcome(s).deal).toEqual({ accepted: [], vouched: null, accused: [], panic: true })
  })
})

describe('《摇摆州》四人局：普雷斯顿', () => {
  test('普雷斯顿的坦白、指向他的证据、他点名的交易；他的计分和结局', () => {
    let s = toRound1({ n: 4 })
    s = own(s, 'P1', 'v_preston')
    // 第 1 轮：曼迪交维克多的证词（普雷斯顿 +1），普雷斯顿交闷响（伊森 +1）
    s = pass(order(order(s, 'P1', { card: 'v_preston' }), 'P4', { card: 'preston_thud' }))
    expect(person(s, 'P4', 'preston').count).toBe(1)
    expect(person(s, 'P4', 'ethan').count).toBe(1)
    s = pass(s)
    // 只有普雷斯顿接受交易，点名伊森
    s = refuseAll(deal(s, 'P4', 'accept', 'ethan'))
    expect(person(s, 'P1', 'preston').lineParts.vouch).toBe(VOUCH_BONUS)
    expect(person(s, 'P1', 'ethan').count).toBe(1 + DEAL_MARKS)
    s = pass(s)
    const o = outcome(s)
    expect(o.cast).toEqual(['mandy', 'ethan', 'joan', 'preston'])
    expect(o.taken.ethan).toBe(true)
    expect(o.taken.preston).toBe(false)
    expect(o.lines.price).toBe(8)
    expect(scoreOf(s, '普雷斯顿', '让推父亲下塔的人').got).toBe(true)
    expect(scoreOf(s, '普雷斯顿', '守住万斯家的名声').got).toBe(true)
    // 没人开保险箱：新遗嘱没拿出来
    expect(o.will).toBe('missing')
    expect(scoreOf(s, '普雷斯顿', '拿回本该属于你的一切').got).toBe(true)
    // 他只有 1 格，不靠普莱斯保也不会被带走：不算"欠下的人情"
    expect(o.savedByVouch.preston).toBe(false)
    expect(ending(s, '普雷斯顿').title).toBe('万斯这个姓')
    expect(E.viewFor(s, 'P1', now).result!.endings).toHaveLength(4)
  })

  test('普雷斯顿认罪：普莱斯 +2；他被带走', () => {
    let s = toRound1({ n: 4 })
    s = pass(order(s, 'P4', { card: 'preston_safe' }))
    expect(person(s, 'P1', 'preston').confessed).toBe(true)
    expect(person(s, 'P1', 'price').count).toBe(CONFESS_MARKS)
    s = pass(refuseAll(pass(s)))
    expect(outcome(s).taken.preston).toBe(true)
    expect(ending(s, '普雷斯顿').title).toBe('儿子的坦白')
  })
})

describe('代码审查修复（回归测试）', () => {
  test('别人的现金不下发（会泄露案卷对错与指认得分），结局后才公开', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'cf_rose', answers: { cause: 'heart', vehicle: 'dinner', claim: 'possible' } })
    const v1 = E.viewFor(s, 'P1', now)
    expect(v1.players.P2!.money).toBeUndefined()
    expect(v1.players.P3!.money).toBeUndefined()
    expect(v1.players.P1!.money).toBe(v1.me.money)
    // 别人的失败不会以任何形式出现在我的报文里
    expect(JSON.stringify(v1)).not.toContain('判定不通过')
  })

  test('案卷：带着旧的剩余次数重复提交会被拒绝（双击不会扣两次钱）', () => {
    let s = until(start(), 'search1')
    const wrong = { cause: 'heart', vehicle: 'dinner', claim: 'possible' }
    s = ok(s, 'P1', { type: 'caseFile', caseId: 'cf_rose', answers: wrong, attemptsLeft: 2 })
    expect(err(s, 'P1', { type: 'caseFile', caseId: 'cf_rose', answers: wrong, attemptsLeft: 2 })).toMatch(/已经递交过/)
    expect(E.viewFor(s, 'P1', now).caseFiles.find(c => c.id === 'cf_rose')!.attemptsLeft).toBe(1)
  })

  test('搜查点只给不透明编号；别人搜走的专属点不会出现在你的列表里', () => {
    let s = until(start(), 'search1')
    const ids = new Set(E.scenario.clues.map(c => c.id))
    for (const seat of s.roster) {
      for (const sp of E.viewFor(s, seat, now).spots) expect(ids.has(sp.spotId)).toBe(false)
    }
    s = ok(s, 'P2', search(s, 'door_log'))
    s = ok(s, 'P2', search(s, 'earpiece'))
    const mine = E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))
    expect(mine).not.toContain('door_log')
    // 公共点被搜走仍显示"已被搜走"，但报文里没有线索 id
    const v = E.viewFor(s, 'P1', now)
    expect(v.spots.find(x => spotClue(s, x) === 'earpiece')?.status).toBe('taken')
    expect(JSON.stringify(v.spots)).not.toContain('earpiece')
    // 编号按房间散列：换一局就不一样
    const other = E.createGame('ZZZZ', 99, now)
    expect(E.spotIdOf(other, 'earpiece')).not.toBe(E.spotIdOf(s, 'earpiece'))
  })

  test('重选自己已选的角色不会取消别人的准备', () => {
    let s = E.createGame('TEST', 7, now)
    for (const seat of ['P1', 'P2', 'P3', 'P4'] as Seat[]) s = E.joinSeat(s, seat, seat, now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
    s = ok(s, 'P3', { type: 'pickRole', roleId: 'joan' })
    s = ok(s, 'P2', { type: 'ready', value: true })
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    expect(s.seats.P2.ready).toBe(true)
  })

  test('拍卖平局的文案来自剧本（维克多·奥利维拉）', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 0, lot_recount: 0, lot_yacht: 0 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 0, lot_recount: 0, lot_yacht: 0 } })
    s = ok(s, 'P3', { type: 'bid', bids: { lot_lawyer: 900 } })
    const v = E.viewFor(s, 'P1', now)
    expect(v.log.some(e => e.text.includes('维克多·奥利维拉以更高的价钱截走'))).toBe(true)
    expect(v.auction!.tieLabel).toContain('维克多')
    expect(s.clues.item_lawyer).toBeUndefined()
  })

  test('指认环节有时限：有人提交、有人不来，到点照样进入终局', () => {
    let s = until(start(), 'accuse')
    expect(E.nextDeadline(s)).not.toBeNull()
    s = ok(s, 'P1', { type: 'accuse', answers: Object.fromEntries(ACCUSE.map(q => [q.id, q.answer])) })
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(stepId(s)).toBe('finale')
    expect(s.seats.P2.accuse).toEqual({})
    expect(s.seats.P3.accuse).toEqual({})
  })

  test('终局里证据封存：不能交给别人（道具转手再用、把物证塞给别人躲搜身都不行）', () => {
    const s = toFinale()
    const item = Object.entries(s.clues).find(([id, c]) => c.owner === 'P2' && id.startsWith('item_'))![0]
    expect(err(s, 'P2', { type: 'give', clueId: item, to: 'P1' })).toMatch(/封存/)
    const card = fv(s, 'P2').hand[0].id
    expect(err(s, 'P2', { type: 'give', clueId: card, to: 'P3' })).toMatch(/封存/)
  })

  test('"限一次"的道具按道具记：用过的放大镜不能再用', () => {
    let s = toRound1()
    s = pass(order(order(s, 'P1', { recount: true }), 'P2', { card: 'b_saw' }))
    expect((s.finale as FinaleState).usedItems).toContain('item_recount')
    expect(err(s, 'P1', orderAction({ recount: true }))).toMatch(/放大镜/)
  })
  test('命令带轮次：上一轮的重复命令不会落到下一轮', () => {
    let s = toRound1()
    // 第 1 轮：别人先选好，我方双击
    s = order(order(s, 'P2', {}), 'P3', {})
    const dup = orderAction({}, 1)
    s = ok(s, 'P1', dup)
    expect(fv(s, 'P1').round).toBe(2)
    expect(err(s, 'P1', dup)).toMatch(/已经揭晓/)
    expect(fv(s, 'P1').mySubmitted).toBe(false)
  })
  test('不在这一局的座位不能操作终局', () => {
    const s = toRound1()
    expect(err(s, 'P4', orderAction({}))).toMatch(/不在这一局/)
  })
  test('持有遗嘱的人出海：遗嘱带不走，06:00 照样交给律师；出海的人放弃遗产', () => {
    let s = toRound1()
    expect(fv(s, 'P2').items.some(i => i.kind === 'yacht')).toBe(true)
    s = own(s, 'P2', 'will')
    s = refuseAll(pass(pass(s)))
    s = pass(order(s, 'P2', { flee: true }))
    const o = outcome(s)
    expect(o.fled.ethan).toBe(true)
    expect(o.taken.ethan).toBe(false)
    expect(o.will).toBe('executed')
    expect(o.ethanInherits).toBe(false)
    expect(o.mandyInherits).toBe(true)
    expect(scoreOf(s, '伊森', '自身').points).toBe(5)
    expect(scoreOf(s, '伊森', '"弗兰克').got).toBe(false)
  })
  test('终局界面文案全部由服务器下发', () => {
    const s = toFinale()
    const v = fv(s, 'P1')
    expect(v.copy.rules.length).toBeGreaterThanOrEqual(7)
    expect(v.copy.deal.terms).toHaveLength(5)
    expect(v.copy.deal.pickTarget.length).toBeGreaterThan(5)
    expect(v.copy.goals).toHaveLength(4)
    expect(fv(s, 'P3').copy.goals.map(g => g.text).join()).toMatch(/稿子/)
    expect(v.copy.intro.length).toBeGreaterThan(20)
    expect(v.copy.rules[0]).toMatch(/名单上有 4 个人/)
    expect(v.people.map(p => p.name)).toEqual(['曼迪', '伊森', '乔安', '普莱斯医生'])
    expect(v.actions[0].payload).toEqual({ type: 'ready' })
    // 只列自己的道具
    expect(v.copy.rules.join()).toContain('律师名片')
    expect(fv(s, 'P2').copy.rules.join()).not.toContain('律师名片')
    // 普莱斯对乔安不叫"孩子"
    expect(fv(s, 'P3').copy.deal.intro).toMatch(/默瑟小姐/)
  })
  test('头条、结局与官方结论一致', () => {
    let s = toRound1()
    s = pass(refuseAll(pass(pass(s))))
    const base = (s.finale as FinaleState).outcome!
    const withOutcome = (o: Partial<typeof base>) => {
      const st = structuredClone(s)
      ;(st.finale as FinaleState).outcome = { ...base, ...o }
      return buildResult(st)
    }
    const none = { mandy: false, ethan: false, joan: false, preston: false, price: false }
    const no = { rose: false, gideon: false, mei: false, will: false }
    // 普莱斯因 2000 年的证据被带走：头条写翻案，不能写"双尸案真相大白"
    const r3 = withOutcome({ taken: { ...none, price: true }, meiReopened: true, raised: { ...no, mei: true }, priceFor: { ...no, mei: true } })
    expect(r3.headline).toMatch(/2000 年谋杀/)
    expect(r3.headline).not.toMatch(/双尸案/)
    // 普莱斯被带走，但没人交 2000 年的证据：不能写翻案
    const rp = withOutcome({ taken: { ...none, price: true }, raised: { ...no, rose: true }, priceFor: { ...no, rose: true } })
    expect(rp.headline).toMatch(/私人医生被捕/)
    for (const e of rp.endings) expect(e.text).not.toMatch(/重新立案/)
    // 罗丝之死的证据交了、没人被带走：不能写"猝死"
    const r1 = withOutcome({ raised: { ...no, rose: true } })
    expect(r1.headline).not.toMatch(/猝死/)
    expect(r1.endings[0].text).not.toMatch(/签完了两份死亡证明/)
    // 三个人都被带走：头条写"三人"
    const r4 = withOutcome({ taken: { ...none, mandy: true, ethan: true, joan: true } })
    expect(r4.headline).toMatch(/三人被警方带走/)
    // 曼迪被带走、普莱斯也被带走，但没有一份关于罗丝的证据指向普莱斯：不能说"陪审团听完了他如何骗你"
    const red = withOutcome({ taken: { ...none, mandy: true, price: true }, raised: { ...no, mei: true }, priceFor: { ...no, mei: true }, meiReopened: true })
    const mEnd = red.endings.find(e => e.roleName === '曼迪')!
    expect(mEnd.title).toBe('被欺骗的手')
    expect(mEnd.text).not.toMatch(/如何骗你/)
    // 认罪的人：结局写认罪，不能写"证据还不够把你带走"
    const conf = withOutcome({ taken: { ...none, mandy: true, price: true }, confessed: { mandy: true, ethan: false, joan: false, preston: false } })
    const cEnd = conf.endings.find(e => e.roleName === '曼迪')!
    expect(cEnd.title).toBe('说出一切')
    expect(cEnd.text).not.toMatch(/证据还不够/)
    // 普莱斯保下来的人：结局是"欠下的人情"
    const v = withOutcome({ savedByVouch: { mandy: true, ethan: false, joan: false, preston: false } })
    expect(v.endings.find(e => e.roleName === '曼迪')!.title).toBe('欠下的人情')
    // 乔安：罗丝的证据指向普莱斯且他被带走，才写"罗丝没有白死"
    const jr = withOutcome({ taken: { ...none, price: true }, raised: { ...no, rose: true }, priceFor: { ...no, rose: true } })
    expect(jr.endings.find(e => e.roleName === '乔安')!.text).toMatch(/罗丝没有白死/)
    expect(r1.endings.find(e => e.roleName === '乔安')!.text).not.toMatch(/罗丝没有白死/)
  })
})

describe('第二轮审查修复（回归测试）', () => {
  test('日志按座位各自编号：别人收到私信，你这边的编号也不会缺号', () => {
    let s = toRound1()
    s = pass(order(s, 'P1', { recount: true }))
    for (const seat of s.roster) {
      const ids = E.viewFor(s, seat, now).log.map(e => e.id)
      for (let i = 1; i < ids.length; i++) expect(ids[i]).toBe(ids[i - 1] + 1)
      expect(JSON.stringify(E.viewFor(s, seat, now).log)).not.toContain('"seq"')
    }
  })

  test('搜证播报：别人够不着的点（专属 / 未解锁）只说地点，不说具体搜查点', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', search(s, 'door_log'))
    const last = E.viewFor(s, 'P1', now).log.filter(e => e.kind === 'dm').at(-1)!.text
    const def = E.scenario.clues.find(c => c.id === 'door_log')!
    expect(last).not.toContain(def.spot!)
    expect(last).toMatch(/里的某处/)
    // 公共点照常说清楚位置
    s = ok(s, 'P2', search(s, 'earpiece'))
    const pub = E.viewFor(s, 'P1', now).log.filter(e => e.kind === 'dm').at(-1)!.text
    expect(pub).toContain(E.scenario.clues.find(c => c.id === 'earpiece')!.spot!)
  })

  test('普莱斯结局句：有证据指向他但不够时，不能说"没有一份证据指向他"', () => {
    let s = toRound1()
    s = pass(order(s, 'P1', { card: priceCards(s, 'P1')[0] }))
    s = pass(refuseAll(pass(s)))
    expect(outcome(s).taken.price).toBe(false)
    const r = buildResult(s)
    for (const e of r.endings) {
      expect(e.text).not.toMatch(/没有一份证据指向他/)
      expect(e.text).toMatch(/还差一点/)
    }
  })
})

describe('第三轮审查修复（回归测试）', () => {
  test('探测不出别人私下拿到了什么：没人拿到 / 被别人私下拿到的线索，公开与交出的报错一样', () => {
    let s = until(start(), 'search1')
    const before = { pub: err(s, 'P1', { type: 'publish', clueId: 'door_log' }), give: err(s, 'P1', { type: 'give', clueId: 'door_log', to: 'P3' }) }
    s = ok(s, 'P2', search(s, 'door_log'))
    s = ok(s, 'P2', { type: 'ask', npcId: 'hector', questionId: 'h_tray' })
    for (const id of ['door_log', 'hector_tray']) {
      expect(err(s, 'P1', { type: 'publish', clueId: id })).toBe(before.pub)
      expect(err(s, 'P1', { type: 'give', clueId: id, to: 'P3' })).toBe(before.give)
    }
  })

  test('日志按受众分桶裁剪：公共记录刷满之后，别人的私信也不会改变你看到的记录', () => {
    let s = until(start(), 'search1')
    // 把公共记录刷到上限
    for (let i = 0; i < 650; i++) s = E.setPresence(E.setPresence(s, 'P1', false, now), 'P1', true, now)
    const before = JSON.stringify(E.viewFor(s, 'P1', now).log)
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'cf_rose', answers: { cause: 'heart', vehicle: 'dinner', claim: 'possible' } })
    expect(JSON.stringify(E.viewFor(s, 'P1', now).log)).toBe(before)
  })
})

describe('第四轮审查修复（回归测试）', () => {
  test('大厅里掉线的座位自动取消准备，别人不能一键开局', () => {
    let s = E.createGame('TEST', 7, now)
    for (const seat of ['P1', 'P2', 'P3'] as Seat[]) s = E.joinSeat(s, seat, seat, now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
    s = ok(s, 'P3', { type: 'pickRole', roleId: 'joan' })
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = E.setPresence(s, 'P1', false, now)
    expect(s.seats.P1.ready).toBe(false)
    s = ok(s, 'P2', { type: 'ready', value: true })
    s = ok(s, 'P3', { type: 'ready', value: true })
    expect(s.stepIndex).toBe(-1)
  })

  test('搜证探测不出别人搜了什么：够不着的点，别人搜没搜走，报错都一样', () => {
    let s = until(start(), 'search1')
    const probe = () => E.reduce(s, 'P1', search(s, 'door_log'), now).error
    const before = probe()
    s = ok(s, 'P2', search(s, 'door_log'))
    expect(probe()).toBe(before)
    // 编号是带房间密钥的 SHA-256：看不出规律
    expect(E.spotIdOf(s, 'door_log')).toMatch(/^[\w-]{12}$/)
  })
})
