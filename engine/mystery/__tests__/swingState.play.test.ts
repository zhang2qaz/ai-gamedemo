// 《摇摆州》整局流程 + 终局机制测试（直接驱动服务器端引擎）
import { makeEngine } from '../core'
import { swingState } from '../scenarios/swing-state'
import { CASE_FILES, ACCUSE } from '../scenarios/swing-state/content'
import { DEAL_MARKS, EMPTY_ORDER, FINALE_CARDS, LAWYER_BONUS, LINES } from '../scenarios/swing-state/finale'
import type { FinaleState } from '../scenarios/swing-state/finale'
import { buildResult } from '../scenarios/swing-state/result'
import type { FinaleView, FinaleOrder } from '../scenarios/swing-state/finaleTypes'
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
const bothReady = (s: GameState) => ok(ok(s, 'P1', { type: 'ready', value: true }), 'P2', { type: 'ready', value: true })

/** P1 = 曼迪，P2 = 伊森 */
function start(): GameState {
  let s = E.createGame('TEST', 7, now)
  s = E.joinSeat(s, 'P1', 'A', now)
  s = E.joinSeat(s, 'P2', 'B', now)
  s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
  s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
  s = ok(s, 'P1', { type: 'ready', value: true })
  s = ok(s, 'P2', { type: 'ready', value: true })
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
      }
      s = bothReady(s)
    } else if (k === 'accuse') {
      for (const seat of ['P1', 'P2'] as Seat[]) {
        const answers = Object.fromEntries(ACCUSE.map(q => [q.id, q.answer]))
        s = ok(s, seat, { type: 'accuse', answers })
      }
    } else {
      s = bothReady(s)
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
function deal(s: GameState, seat: Seat, choice: 'accept' | 'refuse') {
  return ok(s, seat, { type: 'finale', payload: { type: 'deal', choice } })
}

describe('《摇摆州》流程', () => {
  test('开局发放：伊森第一幕持有弗兰克的信；第二幕双方各得目击与自白', () => {
    let s = start()
    expect(stepId(s)).toBe('prologue')
    s = bothReady(s)
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toContain('frank_letter')
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).not.toContain('frank_letter')
    s = until(s, 'act2')
    expect(E.viewFor(s, 'P1', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['a_saw', 'a_confess']))
    expect(E.viewFor(s, 'P2', now).clues.map(c => c.id)).toEqual(expect.arrayContaining(['b_saw', 'b_confess', 'frank_letter']))
    // 私密剧本互不可见
    expect(E.viewFor(s, 'P1', now).me.chapters.some(c => c.text.includes('我叫伊森'))).toBe(false)
  })

  test('拍卖：价高者得、付自己的出价；平局被维克多截走', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_lawyer: 1500, lot_headline: 800, lot_recount: 0, lot_yacht: 0 } })
    expect(err(s, 'P1', { type: 'bid', bids: {} })).toBe('你已经提交了出价')
    expect(err(s, 'P2', { type: 'bid', bids: { lot_lawyer: 50 } })).toMatch(/最低出价/)
    expect(err(s, 'P2', { type: 'bid', bids: { lot_lawyer: 7000 } })).toBe('总出价超过了你的现金')
    s = ok(s, 'P2', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 800, lot_recount: 0, lot_yacht: 600 } })
    expect(s.auction?.results).toBeTruthy()
    expect(s.seats.P1.money).toBe(6000 - 1500)
    expect(s.seats.P2.money).toBe(6000 - 600)
    expect(s.clues.item_lawyer.owner).toBe('P1')
    expect(s.clues.item_yacht.owner).toBe('P2')
    expect(s.clues.item_headline).toBeUndefined() // 平局 → 维克多
  })

  test('目标随剧情解锁', () => {
    let s = until(start(), 'act1')
    expect(E.viewFor(s, 'P1', now).me.goals.map(g => g.id)).toEqual(['m_truth'])
    s = until(s, 'act3')
    expect(E.viewFor(s, 'P1', now).me.goals.map(g => g.id)).toEqual(['m_truth', 'm_free', 'm_tower', 'm_inherit'])
  })

  test('安保系统只有伊森能查；保险箱需要钥匙＋罗丝的信', () => {
    let s = until(start(), 'search1')
    const spotsA = E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))
    const spotsB = E.viewFor(s, 'P2', now).spots.map(x => spotClue(s, x))
    expect(spotsA).not.toContain('door_log')
    expect(spotsB).toContain('door_log')
    s = until(s, 'search2')
    // 曼迪有信但没有钥匙
    expect(E.viewFor(s, 'P1', now).spots.map(x => spotClue(s, x))).not.toContain('will')
    // 伊森把钥匙交给曼迪
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key' })
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

function toFinale(opts: { cooperative?: boolean } = {}) {
  let s = until(start(), 'search1')
  s = searchAll(s, 'P1')
  s = searchAll(s, 'P2')
  s = until(s, 'search2')
  if (opts.cooperative) {
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key' })
  }
  s = searchAll(s, 'P1')
  s = searchAll(s, 'P2')
  s = until(s, 'finale')
  return s
}

const orderAction = (o: Partial<FinaleOrder>, round?: number): MysteryAction =>
  ({ type: 'finale', payload: { type: 'order', ...(round !== undefined ? { round } : {}), order: { ...EMPTY_ORDER, ...o } } })
const ready = (s: GameState, seat: Seat) => ok(s, seat, { type: 'finale', payload: { type: 'ready' } })
const pass = (s: GameState) => order(order(s, 'P1', {}), 'P2', {})
const refuseBoth = (s: GameState) => deal(deal(s, 'P1', 'refuse'), 'P2', 'refuse')
const person = (s: GameState, seat: Seat, who: 'mandy' | 'ethan' | 'price') => fv(s, seat).people.find(p => p.who === who)!
const outcome = (s: GameState) => fv(s, 'P1').outcome!
/** 只指向普莱斯的证据（交出去不会牵连交的人） */
const priceCards = (s: GameState, seat: Seat) => fv(s, seat).hand.filter(c => c.points.length === 1 && c.points[0] === 'price').map(c => c.id)
/** 测试用：直接把一条线索放到某人手里 */
function own(s: GameState, seat: Seat, id: string): GameState {
  const st = structuredClone(s)
  st.clues[id] = { ...(st.clues[id] ?? { public: false, seenBy: [], foundAt: now, foundBy: seat }), owner: seat, seenBy: [seat] }
  return st
}
function toRound1(opts: { cooperative?: boolean } = {}) {
  return ready(ready(toFinale(opts), 'P1'), 'P2')
}

describe('《摇摆州》终局「警长的名单」', () => {
  test('开场：先看规则，两人都点「我看懂了」才开始第一轮', () => {
    let s = toFinale()
    expect(fv(s, 'P1').phase).toBe('intro')
    expect(err(s, 'P1', orderAction({}))).toMatch(/不是交证据/)
    s = ready(s, 'P1')
    expect(fv(s, 'P1').phase).toBe('intro')
    expect(fv(s, 'P2').otherSubmitted).toBe(true)
    s = ready(s, 'P2')
    expect(fv(s, 'P1').phase).toBe('orders')
    expect(fv(s, 'P1').round).toBe(1)
  })

  test('开场说明到点自动开始', () => {
    let s = toFinale()
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(fv(s, 'P1').phase).toBe('orders')
  })

  test('名单：三个人、各自几格；律师名片多一格', () => {
    const s = toRound1()
    const v = fv(s, 'P1')
    expect(v.people.map(p => p.who)).toEqual(['mandy', 'ethan', 'price'])
    // P1（曼迪）在拍卖里拿到了律师名片
    expect(v.people.map(p => p.line)).toEqual([LINES.mandy + LAWYER_BONUS, LINES.ethan, LINES.price])
    expect(v.people.every(p => p.count === 0)).toBe(true)
    expect(v.people.find(p => p.isMe)!.who).toBe('mandy')
    expect(fv(s, 'P2').people.find(p => p.isMe)!.who).toBe('ethan')
  })

  test('手里只有指向人的证据；对方手里的看不到', () => {
    const s = toRound1()
    const v1 = fv(s, 'P1')
    const v2 = fv(s, 'P2')
    for (const c of [...v1.hand, ...v2.hand]) {
      expect(c.id in FINALE_CARDS).toBe(true)
      expect(c.points.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
    }
    expect(v1.hand.map(h => h.id)).toContain('a_confess')
    expect(v2.hand.map(h => h.id)).toContain('b_saw')
    expect(JSON.stringify(v1)).not.toContain('b_confess')
  })

  test('交证据的规则：只能交自己的；头版要配一份证据；出海只在第三轮；没有的道具不能用', () => {
    const s = toRound1()
    expect(err(s, 'P1', orderAction({ card: 'b_saw' }))).toBe('只能交出你手里的证据')
    expect(err(s, 'P1', orderAction({ card: 'a_confess', headline: true }))).toMatch(/没有可用的「头版」/)
    expect(err(s, 'P2', orderAction({ headline: true }))).toMatch(/要配合一份证据/)
    expect(err(s, 'P2', orderAction({ flee: true }))).toMatch(/第三轮/)
    expect(err(s, 'P2', orderAction({ recount: true }))).toMatch(/放大镜/)
  })

  test('揭晓：证据指向谁就给谁填一格，同时指向两个人的各一格', () => {
    let s = toRound1()
    s = order(s, 'P1', { card: 'a_confess' })
    s = order(s, 'P2', { card: 'b_saw' })
    expect(fv(s, 'P1').phase).toBe('deal')
    expect(person(s, 'P1', 'mandy').count).toBe(2)
    expect(person(s, 'P1', 'price').count).toBe(1)
    expect(person(s, 'P1', 'ethan').count).toBe(0)
    expect(fv(s, 'P1').reveals.at(-1)!.lines.join('\n')).toContain('曼迪的自白')
    // 交过的证据离开手里；格子标明是谁交的
    expect(fv(s, 'P1').hand.map(h => h.id)).not.toContain('a_confess')
    const m = person(s, 'P2', 'mandy').marks
    expect(m.find(x => x.label === '曼迪的自白')!.by).toBe('other')
    expect(m.find(x => x.label === '伊森的目击')!.by).toBe('me')
  })

  test('头版：一份证据算两份；按道具记，用过就不能再用', () => {
    let s = toRound1()
    s = order(s, 'P1', {})
    s = order(s, 'P2', { card: 'b_saw', headline: true })
    expect(person(s, 'P1', 'mandy').count).toBe(2)
    expect(fv(s, 'P2').items.find(i => i.kind === 'headline')!.used).toBe(true)
    expect((s.finale as FinaleState).usedItems).toContain('item_headline')
    s = refuseBoth(s)
    const card = fv(s, 'P2').hand[0].id
    expect(err(s, 'P2', orderAction({ card, headline: true }))).toMatch(/头版/)
  })

  test('放大镜：对方这一轮交出的证据作废；对方没交就不消耗', () => {
    let s = toRound1()
    s = order(s, 'P1', { recount: true })
    s = order(s, 'P2', {})
    expect(fv(s, 'P1').items.find(i => i.kind === 'recount')!.used).toBe(false)
    s = refuseBoth(s)
    s = order(s, 'P1', { recount: true })
    s = order(s, 'P2', { card: 'b_saw' })
    const m = person(s, 'P1', 'mandy')
    expect(m.count).toBe(0)
    expect(m.marks.some(x => x.void)).toBe(true)
    expect(fv(s, 'P1').items.find(i => i.kind === 'recount')!.used).toBe(true)
    expect(fv(s, 'P2').reveals.at(-1)!.lines.join('\n')).toMatch(/作废/)
  })

  test('交易：两人都拒绝 → 普莱斯慌了，他 +2；谁也没有担保', () => {
    const s = refuseBoth(pass(toRound1()))
    expect(person(s, 'P1', 'price').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'price').marks.every(m => m.kind === 'panic')).toBe(true)
    expect(fv(s, 'P1').people.some(p => p.vouched)).toBe(false)
    expect(fv(s, 'P1').phase).toBe('orders')
    expect(fv(s, 'P1').round).toBe(2)
  })

  test('交易：一方接受 → 普莱斯替他作证，并指证另一个人 +2', () => {
    let s = pass(toRound1())
    s = deal(deal(s, 'P1', 'accept'), 'P2', 'refuse')
    expect(person(s, 'P1', 'mandy').vouched).toBe(true)
    expect(person(s, 'P1', 'ethan').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'ethan').marks.every(m => m.kind === 'testimony')).toBe(true)
    expect(person(s, 'P1', 'price').count).toBe(0)
  })

  test('交易：两人都接受 → 普莱斯把两个人都卖了，谁也没有担保', () => {
    let s = pass(toRound1())
    s = deal(deal(s, 'P1', 'accept'), 'P2', 'accept')
    expect(person(s, 'P1', 'mandy').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'ethan').count).toBe(DEAL_MARKS)
    expect(fv(s, 'P1').people.some(p => p.vouched)).toBe(false)
  })

  test('普莱斯被带走：他替人作的证、对人的指证全部作废', () => {
    let s = toRound1()
    for (const id of ['med_bag', 'rx_pad', 'golf_card']) s = own(s, 'P1', id)
    for (const id of ['printer_log', 'frank_log']) s = own(s, 'P2', id)
    const p1 = ['med_bag', 'rx_pad', 'golf_card']
    const p2 = ['printer_log', 'frank_log']
    for (const id of p1) expect(priceCards(s, 'P1')).toContain(id)
    for (const id of p2) expect(priceCards(s, 'P2')).toContain(id)
    s = order(order(s, 'P1', { card: p1[0] }), 'P2', { card: p2[0] })
    s = deal(deal(s, 'P1', 'refuse'), 'P2', 'accept')
    expect(person(s, 'P1', 'mandy').count).toBe(DEAL_MARKS)
    expect(person(s, 'P1', 'ethan').vouched).toBe(true)
    s = order(order(s, 'P1', { card: p1[1] }), 'P2', { card: p2[1] })
    s = order(order(s, 'P1', { card: p1[2] }), 'P2', {})
    expect(stepId(s)).toBe('ending')
    const o = outcome(s)
    expect(o.taken.price).toBe(true)
    expect(o.vouched.ethan).toBe(false)
    expect(o.counts.mandy).toBe(0)
    expect(o.taken.mandy).toBe(false)
    expect(person(s, 'P1', 'mandy').marks.every(m => m.void)).toBe(true)
    expect(fv(s, 'P1').reveals.at(-1)!.lines.join('\n')).toMatch(/全部作废/)
  })

  test('普莱斯没被带走：他的担保算数，被担保的人满了格也不会被带走', () => {
    let s = toRound1()
    s = own(s, 'P1', 'earpiece')
    s = own(s, 'P2', 'hector_tray')
    s = own(s, 'P2', 'hector_corridor')
    s = order(order(s, 'P1', {}), 'P2', { card: 'hector_corridor' })
    s = deal(deal(s, 'P1', 'accept'), 'P2', 'refuse')
    s = order(order(s, 'P1', { card: 'a_saw' }), 'P2', { card: 'b_saw', headline: true })
    s = order(order(s, 'P1', {}), 'P2', { card: 'hector_tray' })
    const o = outcome(s)
    expect(o.taken.price).toBe(false)
    expect(o.vouched.mandy).toBe(true)
    expect(o.counts.mandy).toBe(o.lines.mandy)
    expect(o.taken.mandy).toBe(false)
    // 伊森：普莱斯的指证 2 格 + 曼迪的目击 1 格 = 3 格，满了
    expect(o.counts.ethan).toBe(3)
    expect(o.taken.ethan).toBe(true)
  })

  test('06:00：满格的人被带走；律师名片让曼迪多扛一格', () => {
    let s = toRound1()
    s = own(s, 'P1', 'earpiece')
    s = own(s, 'P1', 'joan_ethan')
    s = own(s, 'P2', 'hector_tray')
    s = order(order(s, 'P1', { card: 'a_saw' }), 'P2', { card: 'b_saw', headline: true })
    s = refuseBoth(s)
    s = order(order(s, 'P1', { card: 'earpiece' }), 'P2', { card: 'hector_tray' })
    s = order(order(s, 'P1', { card: 'joan_ethan' }), 'P2', {})
    const o = outcome(s)
    expect(o.counts.mandy).toBe(3)
    expect(o.lines.mandy).toBe(LINES.mandy + LAWYER_BONUS)
    expect(o.taken.mandy).toBe(false)
    expect(o.counts.ethan).toBe(3)
    expect(o.taken.ethan).toBe(true)
    const r = E.viewFor(s, 'P1', now).result!
    const ethanScore = r.scores.find(x => x.roleName === '伊森')!
    expect(ethanScore.items.find(i => i.label.startsWith('自身'))!.got).toBe(false)
    const mandyScore = r.scores.find(x => x.roleName === '曼迪')!
    expect(mandyScore.items.find(i => i.label.startsWith('让灯塔上那个人'))!.got).toBe(true)
  })

  test('整局打完：合作路线（交出钥匙开保险箱、都拒绝交易、一起把证据交给警长指证普莱斯）', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', search(s, 'frank_log'))
    s = ok(s, 'P1', { type: 'ask', npcId: 'joan', questionId: 'j_why' })
    s = ok(s, 'P1', { type: 'ask', npcId: 'joan', questionId: 'j_2000' })
    s = until(s, 'search2')
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key' })
    for (const id of ['will', 'confession', 'mei_diary', 'dna']) s = ok(s, 'P1', search(s, id))
    s = ok(s, 'P2', search(s, 'price_suit'))
    s = until(s, 'finale')
    s = ready(ready(s, 'P1'), 'P2')

    s = order(s, 'P1', { card: 'confession' })
    s = order(s, 'P2', { card: 'frank_log' })
    s = refuseBoth(s)
    expect(person(s, 'P1', 'price').count).toBe(2 + DEAL_MARKS)
    s = order(s, 'P1', { card: 'mei_diary' })
    s = order(s, 'P2', { card: 'price_suit' })
    // 第三轮：各自交出一份牵连自己、也指向普莱斯的证据（自白），换对方的"付出代价"
    s = order(s, 'P1', { card: 'a_confess' })
    s = order(s, 'P2', { card: 'b_confess' })
    expect(stepId(s)).toBe('ending')
    const o = outcome(s)
    expect(o.taken).toEqual({ mandy: false, ethan: false, price: true })
    expect(o.meiReopened).toBe(true)
    expect(o.will).toBe('executed')
    expect(o.mandyInherits).toBe(true)
    expect(o.ethanInherits).toBe(true)
    const v = E.viewFor(s, 'P1', now)
    expect(v.result!.headline).toMatch(/2000 年谋杀/)
    for (const sc of v.result!.scores) {
      // 七道指认全对 + 四个目标全中
      expect(sc.items.filter(i => !i.label.startsWith('剩余现金')).every(i => i.got)).toBe(true)
    }
    expect(v.result!.endings.map(e => e.roleName).sort()).toEqual(['伊森', '曼迪'])
    // 复盘对双方完全公开
    expect(E.viewFor(s, 'P2', now).result!.truth.length).toBeGreaterThan(3)
  })

  test('超时：没交视为这一轮不交，没回复交易视为拒绝，整局仍能结束', () => {
    let s = toFinale()
    for (let i = 0; i < 8 && stepId(s) === 'finale'; i++) {
      now = E.nextDeadline(s)! + 1
      s = E.tick(s, now)
    }
    expect(stepId(s)).toBe('ending')
    expect(outcome(s).deal).toBe('both_refuse')
  })
})

describe('代码审查修复（回归测试）', () => {
  test('对方的现金不下发（会泄露案卷对错与指认得分），结局后才公开', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'cf_rose', answers: { cause: 'heart', vehicle: 'dinner', claim: 'possible' } })
    const v1 = E.viewFor(s, 'P1', now)
    expect(v1.players.P2.money).toBeUndefined()
    expect(v1.players.P1.money).toBe(v1.me.money)
    // 对方的失败不会以任何形式出现在我的报文里
    expect(JSON.stringify(v1)).not.toContain('判定不通过')
  })

  test('案卷：带着旧的剩余次数重复提交会被拒绝（双击不会扣两次钱）', () => {
    let s = until(start(), 'search1')
    const wrong = { cause: 'heart', vehicle: 'dinner', claim: 'possible' }
    s = ok(s, 'P1', { type: 'caseFile', caseId: 'cf_rose', answers: wrong, attemptsLeft: 2 })
    expect(err(s, 'P1', { type: 'caseFile', caseId: 'cf_rose', answers: wrong, attemptsLeft: 2 })).toMatch(/已经递交过/)
    expect(E.viewFor(s, 'P1', now).caseFiles.find(c => c.id === 'cf_rose')!.attemptsLeft).toBe(1)
  })

  test('搜查点只给不透明编号；对方搜走的专属点不会出现在你的列表里', () => {
    let s = until(start(), 'search1')
    const ids = new Set(E.scenario.clues.map(c => c.id))
    for (const seat of ['P1', 'P2'] as Seat[]) {
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

  test('重选自己已选的角色不会取消对方的准备', () => {
    let s = E.createGame('TEST', 7, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
    s = ok(s, 'P2', { type: 'ready', value: true })
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    expect(s.seats.P2.ready).toBe(true)
  })

  test('拍卖平局的文案来自剧本（维克多·奥利维拉）', () => {
    let s = until(start(), 'auction')
    s = ok(s, 'P1', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 0, lot_recount: 0, lot_yacht: 0 } })
    s = ok(s, 'P2', { type: 'bid', bids: { lot_lawyer: 1000, lot_headline: 0, lot_recount: 0, lot_yacht: 0 } })
    const v = E.viewFor(s, 'P1', now)
    expect(v.log.some(e => e.text.includes('维克多·奥利维拉以更高的价钱截走'))).toBe(true)
    expect(v.auction!.tieLabel).toContain('维克多')
  })

  test('指认环节有时限：一方提交、另一方不来，到点照样进入终局', () => {
    let s = until(start(), 'accuse')
    expect(E.nextDeadline(s)).not.toBeNull()
    s = ok(s, 'P1', { type: 'accuse', answers: Object.fromEntries(ACCUSE.map(q => [q.id, q.answer])) })
    now = E.nextDeadline(s)! + 1
    s = E.tick(s, now)
    expect(stepId(s)).toBe('finale')
    expect(s.seats.P2.accuse).toEqual({})
  })

  test('终局里证据封存：不能交给对方（道具转手再用、把物证塞给对方躲搜身都不行）', () => {
    const s = toFinale()
    const item = Object.entries(s.clues).find(([id, c]) => c.owner === 'P2' && id.startsWith('item_'))![0]
    expect(err(s, 'P2', { type: 'give', clueId: item })).toMatch(/封存/)
    const card = fv(s, 'P2').hand[0].id
    expect(err(s, 'P2', { type: 'give', clueId: card })).toMatch(/封存/)
  })

  test('"限一次"的道具按道具记：用过的放大镜不能再用', () => {
    let s = toRound1()
    s = order(s, 'P1', { recount: true })
    s = order(s, 'P2', { card: 'b_saw' })
    expect((s.finale as FinaleState).usedItems).toContain('item_recount')
    s = refuseBoth(s)
    expect(err(s, 'P1', orderAction({ recount: true }))).toMatch(/放大镜/)
  })

  test('命令带轮次：上一轮的重复命令不会落到下一轮', () => {
    let s = toRound1()
    s = refuseBoth(pass(s))
    // 第 2 轮：对方先选好，我方双击
    s = order(s, 'P2', {})
    const dup = orderAction({}, 2)
    s = ok(s, 'P1', dup)
    expect(fv(s, 'P1').round).toBe(3)
    expect(err(s, 'P1', dup)).toMatch(/已经揭晓/)
    expect(fv(s, 'P1').mySubmitted).toBe(false)
  })

  test('持有遗嘱的人出海：遗嘱带不走，06:00 照样交给律师；出海的人放弃遗产', () => {
    let s = toRound1()
    expect(fv(s, 'P2').items.some(i => i.kind === 'yacht')).toBe(true)
    s = own(s, 'P2', 'will')
    s = refuseBoth(pass(s))
    s = pass(s)
    s = order(order(s, 'P1', {}), 'P2', { flee: true })
    const o = outcome(s)
    expect(o.fled.ethan).toBe(true)
    expect(o.taken.ethan).toBe(false)
    expect(o.will).toBe('executed')
    expect(o.ethanInherits).toBe(false)
    expect(o.mandyInherits).toBe(true)
    const r = E.viewFor(s, 'P1', now).result!
    expect(r.scores.find(x => x.roleName === '伊森')!.items.find(i => i.label.startsWith('自身'))!.points).toBe(5)
  })

  test('终局界面文案全部由服务器下发', () => {
    const s = toFinale()
    const v = fv(s, 'P1')
    expect(v.copy.rules.length).toBeGreaterThanOrEqual(7)
    expect(v.copy.deal.terms).toHaveLength(4)
    expect(v.copy.intro.length).toBeGreaterThan(20)
    expect(v.people.map(p => p.name)).toEqual(['曼迪', '伊森', '普莱斯医生'])
    expect(v.actions[0].payload).toEqual({ type: 'ready' })
  })

  test('头条、结局与官方结论一致', () => {
    let s = toRound1()
    s = pass(refuseBoth(pass(s)))
    s = pass(s)
    const base = (s.finale as FinaleState).outcome!
    const withOutcome = (o: Partial<typeof base>) => {
      const st = structuredClone(s)
      ;(st.finale as FinaleState).outcome = { ...base, ...o }
      return buildResult(st)
    }
    const none = { mandy: false, ethan: false, price: false }
    const no = { rose: false, gideon: false, mei: false }
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
    // 曼迪被带走、普莱斯也被带走，但没有一份关于罗丝的证据指向普莱斯：不能说"陪审团听完了他如何骗你"
    const red = withOutcome({ taken: { mandy: true, ethan: false, price: true }, raised: { ...no, mei: true }, priceFor: { ...no, mei: true }, meiReopened: true })
    const mEnd = red.endings.find(e => e.roleName === '曼迪')!
    expect(mEnd.title).toBe('被欺骗的手')
    expect(mEnd.text).not.toMatch(/如何骗你/)
    // 普莱斯担保过的人：结局是"欠下的人情"
    const v = withOutcome({ vouched: { mandy: true, ethan: false } })
    expect(v.endings.find(e => e.roleName === '曼迪')!.title).toBe('欠下的人情')
  })
})

describe('第二轮审查修复（回归测试）', () => {
  test('日志按座位各自编号：对方收到私信，你这边的编号也不会缺号', () => {
    let s = toRound1()
    s = order(s, 'P1', { recount: true })
    s = order(s, 'P2', {})
    for (const seat of ['P1', 'P2'] as Seat[]) {
      const ids = E.viewFor(s, seat, now).log.map(e => e.id)
      for (let i = 1; i < ids.length; i++) expect(ids[i]).toBe(ids[i - 1] + 1)
      expect(JSON.stringify(E.viewFor(s, seat, now).log)).not.toContain('"seq"')
    }
  })

  test('搜证播报：对方够不着的点（专属 / 未解锁）只说地点，不说具体搜查点', () => {
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
    s = order(s, 'P1', { card: priceCards(s, 'P1')[0] })
    s = order(s, 'P2', {})
    s = refuseBoth(s)
    s = pass(pass(s))
    expect(outcome(s).taken.price).toBe(false)
    const r = buildResult(s)
    for (const e of r.endings) {
      expect(e.text).not.toMatch(/没有一份证据指向他/)
      expect(e.text).toMatch(/还差一点/)
    }
  })
})

describe('第三轮审查修复（回归测试）', () => {
  test('探测不出对方私下拿到了什么：没人拿到 / 被对方私下拿到的线索，公开与交出的报错一样', () => {
    let s = until(start(), 'search1')
    const before = { pub: err(s, 'P1', { type: 'publish', clueId: 'door_log' }), give: err(s, 'P1', { type: 'give', clueId: 'door_log' }) }
    s = ok(s, 'P2', search(s, 'door_log'))
    s = ok(s, 'P2', { type: 'ask', npcId: 'hector', questionId: 'h_tray' })
    for (const id of ['door_log', 'hector_tray']) {
      expect(err(s, 'P1', { type: 'publish', clueId: id })).toBe(before.pub)
      expect(err(s, 'P1', { type: 'give', clueId: id })).toBe(before.give)
    }
  })

  test('日志按受众分桶裁剪：公共记录刷满之后，对方的私信也不会改变你看到的记录', () => {
    let s = until(start(), 'search1')
    // 把公共记录刷到上限
    for (let i = 0; i < 650; i++) s = E.setPresence(E.setPresence(s, 'P1', false, now), 'P1', true, now)
    const before = JSON.stringify(E.viewFor(s, 'P1', now).log)
    s = ok(s, 'P2', { type: 'caseFile', caseId: 'cf_rose', answers: { cause: 'heart', vehicle: 'dinner', claim: 'possible' } })
    expect(JSON.stringify(E.viewFor(s, 'P1', now).log)).toBe(before)
  })
})

describe('第四轮审查修复（回归测试）', () => {
  test('大厅里掉线的座位自动取消准备，对方不能一键开局', () => {
    let s = E.createGame('TEST', 7, now)
    s = E.joinSeat(s, 'P1', 'A', now)
    s = E.joinSeat(s, 'P2', 'B', now)
    s = ok(s, 'P1', { type: 'pickRole', roleId: 'mandy' })
    s = ok(s, 'P2', { type: 'pickRole', roleId: 'ethan' })
    s = ok(s, 'P1', { type: 'ready', value: true })
    s = E.setPresence(s, 'P1', false, now)
    expect(s.seats.P1.ready).toBe(false)
    s = ok(s, 'P2', { type: 'ready', value: true })
    expect(s.stepIndex).toBe(-1)
  })

  test('搜证探测不出对方搜了什么：够不着的点，对方搜没搜走，报错都一样', () => {
    let s = until(start(), 'search1')
    const probe = () => E.reduce(s, 'P1', search(s, 'door_log'), now).error
    const before = probe()
    s = ok(s, 'P2', search(s, 'door_log'))
    expect(probe()).toBe(before)
    // 编号是带房间密钥的 SHA-256：看不出规律
    expect(E.spotIdOf(s, 'door_log')).toMatch(/^[\w-]{12}$/)
  })
})
