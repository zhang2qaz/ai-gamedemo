// 《摇摆州》整局流程 + 终局机制测试（直接驱动服务器端引擎）
import { makeEngine } from '../core'
import { swingState } from '../scenarios/swing-state'
import { CASE_FILES, ACCUSE } from '../scenarios/swing-state/content'
import { EMPTY_ORDER, PRICE_BASE } from '../scenarios/swing-state/finale'
import type { FinaleView, FinaleOrder } from '../scenarios/swing-state/finaleTypes'
import type { GameState, MysteryAction, Seat } from '../types'

const E = makeEngine(swingState)
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
    if (spot) { s = ok(s, seat, { type: 'search', clueId: spot.clueId }); continue }
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
    const spotsA = E.viewFor(s, 'P1', now).spots.map(x => x.clueId)
    const spotsB = E.viewFor(s, 'P2', now).spots.map(x => x.clueId)
    expect(spotsA).not.toContain('door_log')
    expect(spotsB).toContain('door_log')
    s = until(s, 'search2')
    // 曼迪有信但没有钥匙
    expect(E.viewFor(s, 'P1', now).spots.map(x => x.clueId)).not.toContain('will')
    // 伊森把钥匙交给曼迪
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key' })
    expect(E.viewFor(s, 'P1', now).spots.map(x => x.clueId)).toContain('will')
    s = ok(s, 'P1', { type: 'search', clueId: 'will' })
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

describe('《摇摆州》终局「黎明计票」', () => {
  test('初始比分与手牌', () => {
    const s = toFinale()
    const v = fv(s, 'P1')
    expect(v.phase).toBe('orders')
    expect(v.races.map(r => r.price)).toEqual([PRICE_BASE.R1, PRICE_BASE.R2, PRICE_BASE.R3])
    expect(v.hand.length).toBeGreaterThan(2)
    expect(fv(s, 'P2').hand.map(h => h.id)).toContain('b_saw')
    // 对方手牌不可见
    expect(JSON.stringify(fv(s, 'P1'))).not.toContain('b_confess')
  })

  test('递交规则：最多 2 张、只能交自己的、不能既交又烧', () => {
    const s = toFinale()
    const hand = fv(s, 'P1').hand.map(h => h.id)
    expect(err(s, 'P1', { type: 'finale', payload: { type: 'order', order: { ...EMPTY_ORDER, cast: hand.slice(0, 3) } } })).toMatch(/最多递交/)
    expect(err(s, 'P1', { type: 'finale', payload: { type: 'order', order: { ...EMPTY_ORDER, cast: ['b_saw'] } } })).toBe('只能递交你手里的证据')
    expect(err(s, 'P1', { type: 'finale', payload: { type: 'order', order: { ...EMPTY_ORDER, cast: [hand[0]], burn: hand[0] } } })).toMatch(/既递交又销毁/)
  })

  test('囚徒困境：两人都拒绝 → 2000 年一案「普莱斯」−4，且你们各自的案子不受影响', () => {
    let s = toFinale()
    s = order(s, 'P1', {})
    s = order(s, 'P2', {})
    expect(fv(s, 'P1').phase).toBe('deal')
    s = deal(s, 'P1', 'refuse')
    s = deal(s, 'P2', 'refuse')
    const races = fv(s, 'P1').races
    expect(races.find(r => r.id === 'R3')!.price).toBe(PRICE_BASE.R3 - 4)
    expect(races.find(r => r.id === 'R1')!.price).toBe(PRICE_BASE.R1)
    expect(races.find(r => r.id === 'R2')!.price).toBe(PRICE_BASE.R2)
  })

  test('囚徒困境：一方接受 → 自己豁免，对方被指证', () => {
    let s = toFinale()
    s = order(s, 'P1', {})
    s = order(s, 'P2', {})
    s = deal(s, 'P1', 'accept')
    s = deal(s, 'P2', 'refuse')
    const v = fv(s, 'P1')
    expect(v.immune).toBe(true)
    expect(v.races.find(r => r.id === 'R2')!.truth).toBe(3)
    expect(fv(s, 'P2').immune).toBe(false)
  })

  test('囚徒困境：两人都接受 → 普莱斯两头都骗', () => {
    let s = toFinale()
    s = order(s, 'P1', {})
    s = order(s, 'P2', {})
    s = deal(s, 'P1', 'accept')
    s = deal(s, 'P2', 'accept')
    const v = fv(s, 'P1')
    expect(v.immune).toBe(false)
    expect(v.races.map(r => r.truth)).toEqual([2, 2, 0])
    expect(v.races.find(r => r.id === 'R3')!.price).toBe(PRICE_BASE.R3 + 3)
  })

  test('普莱斯在每一轮（含第 3 轮）都会对真相增长最多的一案反击', () => {
    let s = toFinale()
    const r1card = fv(s, 'P1').hand.find(h => h.race === 'R1' && h.implicates.length === 0)!
    s = order(s, 'P1', { cast: [r1card.id] })
    s = order(s, 'P2', {})
    expect(fv(s, 'P1').races.find(r => r.id === 'R1')!.price).toBe(PRICE_BASE.R1 + 2)
    s = deal(deal(s, 'P1', 'refuse'), 'P2', 'refuse')
    s = order(order(s, 'P1', {}), 'P2', {})
    const r2card = fv(s, 'P2').hand.find(h => h.race === 'R2' && h.implicates.length === 0)
    if (r2card) {
      s = order(s, 'P2', { cast: [r2card.id] })
      s = order(s, 'P1', {})
      expect(fv(s, 'P1').races.find(r => r.id === 'R2')!.price).toBe(PRICE_BASE.R2 + 2)
    }
  })

  test('整局打完：合作路线（交出钥匙开保险箱、都拒绝交易、集中递交 2000 年证据、遗嘱交律师）', () => {
    let s = until(start(), 'search1')
    s = ok(s, 'P2', { type: 'search', clueId: 'frank_log' })
    s = ok(s, 'P1', { type: 'ask', npcId: 'joan', questionId: 'j_why' })
    s = ok(s, 'P1', { type: 'ask', npcId: 'joan', questionId: 'j_2000' })
    s = ok(s, 'P1', { type: 'ask', npcId: 'joan', questionId: 'j_police' })
    s = ok(s, 'P1', { type: 'search', clueId: 'flutes' })
    s = ok(s, 'P1', { type: 'search', clueId: 'pills' })
    s = until(s, 'search2')
    s = ok(s, 'P2', { type: 'give', clueId: 'safe_key' })
    for (const id of ['will', 'confession', 'mei_diary', 'dna']) s = ok(s, 'P1', { type: 'search', clueId: id })
    s = ok(s, 'P2', { type: 'search', clueId: 'price_suit' })
    s = until(s, 'finale')

    // 第 1 轮：用罗丝之死的中立证据做诱饵，把普莱斯的反击引过去
    s = order(s, 'P1', { cast: ['flutes', 'pills'], will: 'submit' })
    s = order(s, 'P2', { cast: ['frank_letter'] })
    expect(fv(s, 'P1').races.find(r => r.id === 'R1')!.price).toBe(PRICE_BASE.R1 + 2)
    s = deal(deal(s, 'P1', 'refuse'), 'P2', 'refuse')
    s = order(s, 'P1', { cast: ['confession', 'mei_diary'] })
    s = order(s, 'P2', { cast: ['frank_log', 'price_suit'] })
    s = order(s, 'P1', { cast: ['rose_letter', 'joan_2000'] })
    s = order(s, 'P2', {})
    expect(stepId(s)).toBe('ending')
    const v = E.viewFor(s, 'P1', now)
    const out = fv(s, 'P1').outcome!
    expect(out.prevails.R3).toBe(true)
    expect(out.priceArrested).toBe(true)
    expect(out.will).toBe('executed')
    expect(out.mandyInherits).toBe(true)
    expect(v.result!.scores).toHaveLength(2)
    expect(v.result!.endings.map(e => e.roleName).sort()).toEqual(['伊森', '曼迪'])
    expect(v.result!.headline).toMatch(/2000 年谋杀/)
    const m = v.result!.scores.find(x => x.roleName === '曼迪')!
    expect(m.items.filter(i => i.label.startsWith('指认')).every(i => i.got)).toBe(true)
    // 复盘对双方完全公开
    expect(E.viewFor(s, 'P2', now).result!.truth.length).toBeGreaterThan(3)
  })

  test('背叛路线：伊森接受交易、曼迪拒绝 → 伊森豁免，曼迪被普莱斯指证', () => {
    let s = toFinale()
    s = order(s, 'P1', {})
    s = order(s, 'P2', {})
    s = deal(deal(s, 'P1', 'refuse'), 'P2', 'accept')
    // 伊森继续交出指向曼迪的目击
    s = order(s, 'P1', {})
    s = order(s, 'P2', { cast: ['b_saw'] })
    s = order(s, 'P1', {})
    const extra = fv(s, 'P2').hand.filter(h => h.race === 'R1' && h.implicates.length === 0).slice(0, 2).map(h => h.id)
    s = order(s, 'P2', { cast: extra })
    const out = fv(s, 'P1').outcome!
    expect(out.ethan).toBe('none')
    if (out.prevails.R1) expect(['full', 'reduced']).toContain(out.mandy)
  })

  test('超时：没下令视为不出手，没回复交易视为拒绝，整局仍能结束', () => {
    let s = toFinale()
    for (let i = 0; i < 6 && stepId(s) === 'finale'; i++) {
      const d = E.nextDeadline(s)!
      now = d + 1
      s = E.tick(s, now)
    }
    expect(stepId(s)).toBe('ending')
    expect(fv(s, 'P1').outcome).toBeTruthy()
  })

  test('警长搜身：留在手里、牵连自己的物证会被搜出', () => {
    let s = toFinale()
    const mine = fv(s, 'P2').hand.filter(h => h.searchable)
    for (let i = 0; i < 6 && stepId(s) === 'finale'; i++) {
      const v = fv(s, 'P1')
      if (v.phase === 'deal') s = deal(deal(s, 'P1', 'refuse'), 'P2', 'refuse')
      else s = order(order(s, 'P1', {}), 'P2', {})
    }
    const found = fv(s, 'P2').myCast.filter(c => c.found).map(c => c.id).sort()
    expect(found).toEqual(mine.map(h => h.id).sort())
  })
})
