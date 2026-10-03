// 《摇摆州》· 终局大机制「黎明计票」（服务器端专用）
//
// 三场"计票"：R1 罗丝之死 / R2 吉迪恩之死 / R3 2000 年林梅之死。
// 每场是「真相」对「普莱斯的说法」。玩家手里带终局标记的线索就是选票。
// 共 3 轮（05:00 / 05:20 / 05:40）：同时秘密下令 → 揭晓 → 普莱斯反击。
// 第 1 轮后插入"未知剧情"：普莱斯的交易（囚徒困境），改写规则。
// 06:00 警长搜身：手里仍持有的、牵连你自己的物证会被搜出。

import type { ClueKind, GameState, Seat } from '../../types'
import { SEATS, otherSeat } from '../../types'
import type { FinaleModule } from '../../runtime'
import { appendLog } from '../../log'
import { CLUES } from './clues'
import { ETHAN, MANDY } from './roles'
import type { FinaleCopy, FinaleOrder, FinaleOutcome, FinaleView, RaceId } from './finaleTypes'

export type Race = RaceId
export type Who = 'mandy' | 'ethan' | 'price'
export type Order = FinaleOrder
export type Outcome = FinaleOutcome
export type Charge = Outcome['mandy']
export const RACES: Race[] = ['R1', 'R2', 'R3']

export const RACE_INFO: Record<Race, { title: string; cover: string }> = {
  R1: { title: '罗丝之死', cover: '"心源性猝死"' },
  R2: { title: '吉迪恩之死', cover: '"醉酒失足"' },
  R3: { title: '2000 年 · 林梅之死', cover: '"意外，已结案 16 年"' },
}

export const PRICE_BASE: Record<Race, number> = { R1: 6, R2: 6, R3: 9 }
export const ROUND_SECONDS = 300
export const DEAL_SECONDS = 150
export const PR_COST = 2000
export const MAX_CAST = 2
export const REACTION = 2

export type CardMeta = { race: Race; weight: number; implicates: Who[] }

/** 带终局标记的线索（选票）。遗嘱原件 'will' 另行处理。 */
export const FINALE_CARDS: Record<string, CardMeta> = {
  // R1 罗丝之死
  flutes: { race: 'R1', weight: 2, implicates: [] },
  pills: { race: 'R1', weight: 1, implicates: [] },
  rose_notes: { race: 'R1', weight: 1, implicates: [] },
  body_r: { race: 'R1', weight: 1, implicates: [] },
  photo: { race: 'R1', weight: 1, implicates: [] },
  pbx: { race: 'R1', weight: 1, implicates: [] },
  joan_rose: { race: 'R1', weight: 1, implicates: [] },
  hector_rose: { race: 'R1', weight: 1, implicates: [] },
  hector_right: { race: 'R1', weight: 1, implicates: [] },
  voicemail: { race: 'R1', weight: 1, implicates: [] },
  hector_tray: { race: 'R1', weight: 1, implicates: ['mandy'] },
  b_saw: { race: 'R1', weight: 2, implicates: ['mandy'] },
  clutch: { race: 'R1', weight: 2, implicates: ['mandy', 'price'] },
  hector_corridor: { race: 'R1', weight: 1, implicates: ['mandy', 'price'] },
  a_confess: { race: 'R1', weight: 3, implicates: ['mandy', 'price'] },
  med_bag: { race: 'R1', weight: 2, implicates: ['price'] },
  rx_pad: { race: 'R1', weight: 1, implicates: ['price'] },
  med_record: { race: 'R1', weight: 1, implicates: ['price'] },
  golf_card: { race: 'R1', weight: 2, implicates: ['price'] },
  // R2 吉迪恩之死
  body_g: { race: 'R2', weight: 1, implicates: [] },
  cufflink: { race: 'R2', weight: 1, implicates: [] },
  preston_thud: { race: 'R2', weight: 1, implicates: [] },
  joan_notes: { race: 'R2', weight: 1, implicates: [] },
  g_pockets: { race: 'R2', weight: 1, implicates: [] },
  mike_alibi: { race: 'R2', weight: 1, implicates: [] },
  earpiece: { race: 'R2', weight: 2, implicates: ['ethan'] },
  door_log: { race: 'R2', weight: 2, implicates: ['ethan'] },
  mike_door: { race: 'R2', weight: 1, implicates: ['ethan'] },
  cctv_log: { race: 'R2', weight: 1, implicates: ['ethan'] },
  mike_codes: { race: 'R2', weight: 1, implicates: ['ethan'] },
  radio_log: { race: 'R2', weight: 1, implicates: ['ethan'] },
  joan_ethan: { race: 'R2', weight: 1, implicates: ['ethan'] },
  price_scratch: { race: 'R2', weight: 1, implicates: ['ethan'] },
  a_saw: { race: 'R2', weight: 2, implicates: ['ethan'] },
  note: { race: 'R2', weight: 2, implicates: ['ethan', 'price'] },
  b_confess: { race: 'R2', weight: 3, implicates: ['ethan', 'price'] },
  printer_log: { race: 'R2', weight: 1, implicates: ['price'] },
  pc_bin: { race: 'R2', weight: 1, implicates: ['price'] },
  // R3 2000 年
  frank_letter: { race: 'R3', weight: 2, implicates: ['price'] },
  frank_log: { race: 'R3', weight: 2, implicates: ['price'] },
  rose_letter: { race: 'R3', weight: 2, implicates: ['price'] },
  confession: { race: 'R3', weight: 3, implicates: ['price'] },
  mei_diary: { race: 'R3', weight: 2, implicates: ['price'] },
  joan_2000: { race: 'R3', weight: 1, implicates: ['price'] },
  price_suit: { race: 'R3', weight: 1, implicates: ['price'] },
  police_2000: { race: 'R3', weight: 1, implicates: [] },
}

export const WILL = 'will'
export const ITEMS = { lawyer: 'item_lawyer', headline: 'item_headline', recount: 'item_recount', yacht: 'item_yacht' } as const

/** 警长搜身时能被搜出的线索类型（口供与证人证词是记忆，搜不出来） */
const SEARCHABLE_KINDS: ClueKind[] = ['physical', 'document', 'digital', 'media']

const clueById = new Map(CLUES.map(c => [c.id, c]))
const title = (id: string) => clueById.get(id)?.title ?? id
const WHO_LABEL: Record<Who, string> = { mandy: '曼迪', ethan: '伊森', price: '普莱斯' }

export type CastRecord = { seat: Seat; card: string; race: Race; weight: number; round: number; headline: boolean; voided: boolean; found?: boolean }
export type DealChoice = 'accept' | 'refuse'
export type DealResult = 'both_refuse' | 'mandy_only' | 'ethan_only' | 'both_accept'

export type FinaleState = {
  round: number
  phase: 'orders' | 'deal' | 'done'
  deadline: number
  orders: Partial<Record<Seat, Order>>
  deal: Partial<Record<Seat, DealChoice>>
  dealResult: DealResult | null
  truth: Record<Race, number>
  price: Record<Race, number>
  extraExposed: Record<Race, Who[]>
  immune: Who[]
  casts: CastRecord[]
  burned: { seat: Seat; card: string; round: number }[]
  /** 用过的"限一次"道具（按道具记，不按人记：转手后不能再用） */
  usedItems: string[]
  fled: Seat[]
  will: { state: 'none' | 'executed' | 'burned'; by: Seat | null }
  history: { round: number; lines: string[] }[]
  secrets: string[]
  outcome: Outcome | null
}

export const EMPTY_ORDER: Order = { cast: [], burn: null, will: null, pr: null, headline: null, recount: false, flee: false }

function fs(state: GameState): FinaleState {
  return state.finale as FinaleState
}

function whoOfSeat(state: GameState, seat: Seat): 'mandy' | 'ethan' {
  return state.seats[seat].roleId === MANDY ? 'mandy' : 'ethan'
}

function seatOfWho(state: GameState, who: 'mandy' | 'ethan'): Seat | null {
  const role = who === 'mandy' ? MANDY : ETHAN
  return SEATS.find(s => state.seats[s].roleId === role) ?? null
}

function nameOf(state: GameState, seat: Seat) {
  return WHO_LABEL[whoOfSeat(state, seat)]
}

export function ownRace(who: 'mandy' | 'ethan'): Race {
  return who === 'mandy' ? 'R1' : 'R2'
}

function isSpent(f: FinaleState, card: string) {
  return f.casts.some(c => c.card === card)
}

/** 某座位手里还能用的选票（不含遗嘱） */
export function handOf(state: GameState, seat: Seat): string[] {
  const f = fs(state)
  const out: string[] = []
  for (const [id, c] of Object.entries(state.clues)) {
    if (c.owner !== seat || c.destroyed || !(id in FINALE_CARDS)) continue
    if (f && isSpent(f, id)) continue
    out.push(id)
  }
  const key = (id: string) => FINALE_CARDS[id].race + String(9 - FINALE_CARDS[id].weight)
  return out.sort((a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b))
}

function holdsWill(state: GameState, seat: Seat) {
  const c = state.clues[WILL]
  return !!c && c.owner === seat && !c.destroyed && fs(state).will.state === 'none'
}

function hasItem(state: GameState, seat: Seat, item: string) {
  const c = state.clues[item]
  return !!c && c.owner === seat && !c.destroyed
}

function itemAvailable(state: GameState, seat: Seat, item: string) {
  return hasItem(state, seat, item) && !fs(state).usedItems.includes(item)
}

function validateOrder(state: GameState, seat: Seat, raw: unknown): Order | string {
  const f = fs(state)
  if (!raw || typeof raw !== 'object') return '命令格式不对'
  const o = raw as Partial<Order>
  const hand = new Set(handOf(state, seat))
  const cast = Array.isArray(o.cast) ? [...new Set(o.cast.filter((x): x is string => typeof x === 'string'))] : []
  if (cast.length > MAX_CAST) return `每轮最多递交 ${MAX_CAST} 份证据`
  for (const c of cast) if (!hand.has(c)) return '只能递交你手里的证据'
  const burn = typeof o.burn === 'string' ? o.burn : null
  if (burn && !hand.has(burn)) return '只能销毁你手里的证据'
  if (burn && cast.includes(burn)) return '同一份证据不能既递交又销毁'
  let will: Order['will'] = null
  if (o.will === 'submit' || o.will === 'burn') {
    if (!holdsWill(state, seat)) return '你手里没有遗嘱原件'
    will = o.will
  }
  let pr: Order['pr'] = null
  if (o.pr && typeof o.pr === 'object') {
    const race = (o.pr as { race?: unknown }).race
    const side = (o.pr as { side?: unknown }).side
    if (!RACES.includes(race as Race) || (side !== 'truth' && side !== 'claim')) return '舆论操作无效'
    if (state.seats[seat].money < PR_COST) return `舆论操作需要现金 $${PR_COST.toLocaleString('en-US')}`
    pr = { race: race as Race, side }
  }
  const headline = typeof o.headline === 'string' ? o.headline : null
  if (headline) {
    if (!itemAvailable(state, seat, ITEMS.headline)) return '你没有可用的「头版」'
    if (!cast.includes(headline)) return '「头版」只能用在本轮递交的证据上'
  }
  const recount = !!o.recount
  if (recount && !itemAvailable(state, seat, ITEMS.recount)) return '你没有可用的「重新计票」'
  const flee = !!o.flee
  if (flee) {
    if (f.round !== 3) return '只有第三轮才能出海'
    if (!hasItem(state, seat, ITEMS.yacht)) return '你没有游艇钥匙'
  }
  return { cast, burn, will, pr, headline, recount, flee }
}

function castCard(state: GameState, f: FinaleState, seat: Seat, card: string, headline: boolean, lines: string[], gains: Record<Race, number>) {
  const meta = FINALE_CARDS[card]
  const weight = meta.weight * (headline ? 2 : 1)
  f.truth[meta.race] += weight
  gains[meta.race] += weight
  f.casts.push({ seat, card, race: meta.race, weight, round: f.round, headline, voided: false })
  const imp = meta.implicates.length ? `（指向：${meta.implicates.map(w => WHO_LABEL[w]).join('、')}）` : ''
  lines.push(`🗳️ ${nameOf(state, seat)} 递交「${title(card)}」→ ${RACE_INFO[meta.race].title} 真相 +${weight}${headline ? '（头版 ×2）' : ''}${imp}`)
}

function resolveRound(state: GameState, now: number) {
  const f = fs(state)
  const lines: string[] = []
  const gains: Record<Race, number> = { R1: 0, R2: 0, R3: 0 }
  const orders: Record<Seat, Order> = { P1: f.orders.P1 ?? EMPTY_ORDER, P2: f.orders.P2 ?? EMPTY_ORDER }

  // 1. 销毁、遗嘱、递交、舆论、出海
  for (const seat of SEATS) {
    const o = orders[seat]
    const who = nameOf(state, seat)
    const hand = new Set(handOf(state, seat))
    if (o.burn && hand.has(o.burn)) {
      const c = state.clues[o.burn]
      if (c) c.destroyed = true
      f.burned.push({ seat, card: o.burn, round: f.round })
      f.secrets.push(`第 ${f.round} 轮，${who} 烧掉了「${title(o.burn)}」。`)
      appendLog(state, now, 'DM', seat, `🔥 你烧掉了「${title(o.burn)}」。这件事只有你知道。`, 'dm')
    }
    if (o.will && holdsWill(state, seat)) {
      if (o.will === 'submit') {
        f.will = { state: 'executed', by: seat }
        lines.push(`📜 ${who} 把吉迪恩的遗嘱原件交给了律师。`)
      } else {
        f.will = { state: 'burned', by: seat }
        const c = state.clues[WILL]
        if (c) c.destroyed = true
        f.secrets.push(`第 ${f.round} 轮，${who} 烧掉了吉迪恩的遗嘱原件。`)
        appendLog(state, now, 'DM', seat, '🔥 你烧掉了遗嘱原件。', 'dm')
      }
    }
    const headlineOk = !!o.headline && itemAvailable(state, seat, ITEMS.headline)
    for (const card of o.cast) {
      if (!hand.has(card) || isSpent(f, card) || card === o.burn) continue
      const useHeadline = headlineOk && o.headline === card
      if (useHeadline) f.usedItems.push(ITEMS.headline)
      castCard(state, f, seat, card, useHeadline, lines, gains)
    }
    if (o.pr && state.seats[seat].money >= PR_COST) {
      state.seats[seat].money -= PR_COST
      if (o.pr.side === 'truth') { f.truth[o.pr.race] += 1; gains[o.pr.race] += 1 } else f.price[o.pr.race] += 1
      lines.push(`📣 ${who} 花 $${PR_COST.toLocaleString('en-US')} 放风：${RACE_INFO[o.pr.race].title}「${o.pr.side === 'truth' ? '真相' : '普莱斯'}」+1`)
    }
    if (o.flee && f.round === 3 && hasItem(state, seat, ITEMS.yacht)) {
      f.fled.push(seat)
      lines.push(`🛥️ ${who} 没有回到大厅。码头方向传来游艇引擎的声音。`)
      f.secrets.push(`${who} 在 05:40 驾驶"第二次机会号"出海逃亡。`)
    }
  }

  // 2. 重新计票：作废对方本轮递交的最强一张（优先牵连自己的），卡牌作废
  for (const seat of SEATS) {
    const o = orders[seat]
    if (!o.recount || !itemAvailable(state, seat, ITEMS.recount)) continue
    const me = whoOfSeat(state, seat)
    const targets = f.casts.filter(c => c.seat === otherSeat(seat) && c.round === f.round && !c.voided)
    if (targets.length === 0) {
      appendLog(state, now, 'DM', seat, '🔍 对方这一轮什么也没交，你的「重新计票」没有用上（之后仍可使用）。', 'dm')
      continue
    }
    targets.sort((a, b) => {
      const ia = FINALE_CARDS[a.card].implicates.includes(me) ? 1 : 0
      const ib = FINALE_CARDS[b.card].implicates.includes(me) ? 1 : 0
      return ib - ia || b.weight - a.weight
    })
    const t = targets[0]
    t.voided = true
    f.truth[t.race] -= t.weight
    gains[t.race] -= t.weight
    const c = state.clues[t.card]
    if (c) c.destroyed = true
    f.usedItems.push(ITEMS.recount)
    lines.push(`🔍 ${nameOf(state, seat)} 当场要求重新计票：${nameOf(state, otherSeat(seat))} 递交的「${title(t.card)}」被判无效（−${t.weight}）。`)
  }

  // 3. 普莱斯的反击：本轮真相增长最多的一案 +2（平局优先 R3 > R1 > R2；都没增长则不动）
  const prio: Race[] = ['R3', 'R1', 'R2']
  let best: Race | null = null
  let bestGain = 0
  for (const r of prio) {
    if (gains[r] > bestGain) { best = r; bestGain = gains[r] }
  }
  if (best) {
    f.price[best] += REACTION
    lines.push(`🩺 普莱斯医生打了一个电话。${RACE_INFO[best].title}：「普莱斯」+${REACTION}。`)
  } else {
    lines.push('🩺 普莱斯医生只是笑了笑，什么也没做。')
  }

  f.history.push({ round: f.round, lines })
  appendLog(state, now, 'DM', 'all', `🗳️ 第 ${f.round} 轮计票揭晓（${roundClock(f.round)}）\n${lines.join('\n')}\n比分：${RACES.map(r => `${RACE_INFO[r].title} ${f.truth[r]}:${f.price[r]}`).join('　')}`, 'event')
  f.orders = {}
}

function roundClock(round: number) {
  return ['05:00', '05:20', '05:40'][round - 1] ?? ''
}

function resolveDeal(state: GameState, now: number) {
  const f = fs(state)
  const ms = seatOfWho(state, 'mandy')
  const es = seatOfWho(state, 'ethan')
  const m = (ms && f.deal[ms]) ?? 'refuse'
  const e = (es && f.deal[es]) ?? 'refuse'
  const lines: string[] = []
  if (m === 'refuse' && e === 'refuse') {
    f.dealResult = 'both_refuse'
    f.price.R3 -= 4
    lines.push('普莱斯的交易，你们谁都没有接。乔安看着你们并肩站在大厅里，在本子上写下了什么。普莱斯第一次乱了阵脚：2000 年一案「普莱斯」−4。')
  } else if (m === 'accept' && e === 'refuse') {
    f.dealResult = 'mandy_only'
    f.immune.push('mandy')
    f.truth.R2 += 3
    f.extraExposed.R2.push('ethan')
    f.price.R3 += 2
    lines.push('普莱斯医生走到众人面前："我必须说出来——两点半以后，我看见保镖伊森上了灯塔。"吉迪恩之死「真相」+3，指向伊森；2000 年一案「普莱斯」+2。')
  } else if (m === 'refuse' && e === 'accept') {
    f.dealResult = 'ethan_only'
    f.immune.push('ethan')
    f.truth.R1 += 3
    f.extraExposed.R1.push('mandy')
    f.price.R3 += 2
    lines.push('普莱斯医生叹了口气，对众人说："我本不想说——曼迪那孩子从我药箱里偷过东西。"罗丝之死「真相」+3，指向曼迪；2000 年一案「普莱斯」+2。')
  } else {
    f.dealResult = 'both_accept'
    f.truth.R1 += 2
    f.extraExposed.R1.push('mandy')
    f.truth.R2 += 2
    f.extraExposed.R2.push('ethan')
    f.price.R3 += 3
    lines.push('普莱斯医生分别向你们两人许了诺——然后当着所有人的面，把你们两个都卖了："曼迪偷了我的药，伊森上了灯塔。"罗丝之死、吉迪恩之死「真相」各 +2，分别指向曼迪、伊森；2000 年一案他说得滴水不漏：「普莱斯」+3。')
  }
  for (const s of SEATS) f.secrets.push(`${nameOf(state, s)} ${f.deal[s] === 'accept' ? '接受' : '拒绝'}了普莱斯的交易。`)
  f.history.push({ round: 1.5, lines })
  appendLog(state, now, 'DM', 'all', `🤝 05:20 · 普莱斯的交易\n${lines.join('\n')}`, 'event')
}

/** 06:00 警长搜身：未逃亡者手里仍持有的、牵连自己的物证/文件被搜出（各计 1 票）；遗嘱若在谁手里，交给律师 */
function sheriffSearch(state: GameState, now: number) {
  const f = fs(state)
  const lines: string[] = []
  for (const seat of SEATS) {
    const who = whoOfSeat(state, seat)
    // 遗嘱原件在谁手里都会被找到并交给律师——出海的人也带不走它（它锁在庄园的书房里）
    if (holdsWill(state, seat)) {
      f.will = { state: 'executed', by: seat }
      lines.push(f.fled.includes(seat)
        ? `📜 ${WHO_LABEL[who]}没有带走遗嘱原件。警长在书房找到了它，交给了律师。`
        : `📜 警长在${WHO_LABEL[who]}身上找到了遗嘱原件，交给了律师。`)
    }
    if (f.fled.includes(seat)) continue
    for (const card of handOf(state, seat)) {
      const meta = FINALE_CARDS[card]
      const kind = clueById.get(card)?.kind
      if (!meta.implicates.includes(who) || !kind || !SEARCHABLE_KINDS.includes(kind)) continue
      f.truth[meta.race] += 1
      f.casts.push({ seat, card, race: meta.race, weight: 1, round: 4, headline: false, voided: false, found: true })
      lines.push(`🚔 警长从${WHO_LABEL[who]}身上搜出了「${title(card)}」→ ${RACE_INFO[meta.race].title} 真相 +1`)
    }
  }
  if (lines.length === 0) lines.push('🚔 警长搜了你们的身，什么也没找到。')
  f.history.push({ round: 4, lines })
  appendLog(state, now, 'DM', 'all', `🚔 06:00 · 警长到了\n${lines.join('\n')}`, 'event')
}

export function computeOutcome(state: GameState): Outcome {
  const f = fs(state)
  const prevails = { R1: f.truth.R1 >= f.price.R1, R2: f.truth.R2 >= f.price.R2, R3: f.truth.R3 >= f.price.R3 }
  const exposed: Record<Race, Who[]> = { R1: [], R2: [], R3: [] }
  for (const r of RACES) {
    const set = new Set<Who>(f.extraExposed[r])
    for (const c of f.casts) {
      if (c.voided || c.race !== r) continue
      for (const w of FINALE_CARDS[c.card].implicates) set.add(w)
    }
    exposed[r] = [...set]
  }
  let lawyerUsedBy: Seat | null = null
  function charge(who: 'mandy' | 'ethan'): Charge {
    const race = ownRace(who)
    const seat = seatOfWho(state, who)
    if (seat && f.fled.includes(seat)) return 'fled'
    if (!prevails[race] || !exposed[race].includes(who) || f.immune.includes(who)) return 'none'
    let level: Charge = exposed[race].includes('price') ? 'reduced' : 'full'
    if (level === 'full' && seat && hasItem(state, seat, ITEMS.lawyer)) {
      level = 'reduced'
      lawyerUsedBy = seat
    }
    return level
  }
  const mandy = charge('mandy')
  const ethan = charge('ethan')
  const priceArrested = prevails.R3 || (prevails.R1 && exposed.R1.includes('price')) || (prevails.R2 && exposed.R2.includes('price'))
  const will = f.will.state === 'executed' ? 'executed' : f.will.state === 'burned' ? 'burned' : 'missing'
  return {
    prevails,
    exposed,
    mandy,
    ethan,
    priceArrested,
    will,
    mandyInherits: will === 'executed' && mandy !== 'fled',
    ethanInherits: will === 'executed' && ethan === 'none',
    lawyerUsedBy,
  }
}

function startOrders(state: GameState, now: number, round: number) {
  const f = fs(state)
  f.round = round
  f.phase = 'orders'
  f.orders = {}
  f.deadline = now + ROUND_SECONDS * 1000
  appendLog(state, now, 'DM', 'all', `⏰ ${roundClock(round)} · 第 ${round} 轮：请秘密下令（最多递交 ${MAX_CAST} 份、销毁 1 份、舆论 1 次）。`, 'system')
}

function advanceAfterOrders(state: GameState, now: number) {
  const f = fs(state)
  resolveRound(state, now)
  if (f.round === 1) {
    f.phase = 'deal'
    f.deal = {}
    f.deadline = now + DEAL_SECONDS * 1000
    appendLog(state, now, 'DM', 'all', '📞 05:20 · 未知剧情：普莱斯医生分别把你们叫到了走廊尽头……（请在「终局」中回复他）', 'system')
  } else if (f.round === 2) {
    startOrders(state, now, 3)
  } else {
    sheriffSearch(state, now)
    f.phase = 'done'
    f.outcome = computeOutcome(state)
  }
}

/**
 * 终局界面上所有带剧情的文字。客户端包里不能出现任何人物关系与真相
 * （指认环节在终局之前，前端 JS 是任何人都能打开看的），所以统一由服务器下发。
 */
function finaleCopy(state: GameState, seat: Seat, f: FinaleState): FinaleCopy {
  const me = whoOfSeat(state, seat)
  const myRace = RACE_INFO[ownRace(me)].title
  const otherRace = RACE_INFO[ownRace(me === 'mandy' ? 'ethan' : 'mandy')].title
  const o = f.outcome
  return {
    tag: 'RECOUNT',
    title: '黎明计票',
    clocks: ['05:00', '05:20', '05:40'],
    dealClock: '05:20 · 普莱斯的交易',
    doneClock: '06:00 · 计票结束',
    truthLabel: '真相',
    claimLabel: '普莱斯',
    claimTextLabel: '普莱斯的说法',
    handHint: `你手里的证据（选票）· 每轮最多递交 ${MAX_CAST} 份、销毁 1 份。标「会被搜出」的若留到 06:00，会被警长从你身上搜出来。`,
    searchableTag: '会被搜出',
    waiting: '等待对方下令……（你们可以在记录里谈判）',
    immune: '普莱斯答应过：在你的案子里，你是清白的（豁免）。',
    will: {
      title: '📜 吉迪恩的遗嘱原件在你手里',
      hint: '交给律师即生效（不占递交名额）。留到 06:00 也会被警长找到并交给律师——出海也带不走它；烧掉，遗产就归普雷斯顿。',
      keep: '先留着',
      submit: '交给律师',
      burn: '烧掉',
      submitted: '把遗嘱交给律师',
      burned: '烧掉遗嘱',
    },
    items: {
      lawyer: '⚖️ 律师名片：结算时自动生效——一级谋杀降为较轻的罪名（只降一级，降不到不起诉）。',
      headline: '🗞️ 头版（限一次）：',
      recount: '🔍 布置重新计票（限一次）：揭晓时作废对方本轮递交的最强一张（优先指向你的），那张证据随之作废',
      yacht: '🛥️ 出海逃亡：不再被起诉，但放弃遗产（本轮的其他命令照常执行）',
    },
    deal: {
      intro: '走廊尽头，普莱斯医生压低声音，像所有人的好外公：\n"孩子，你我都知道今晚发生了什么。只要你点头，我会告诉警长**你**是清白的。至于另一个人……我会说出我\u2018看到\u2019的。"',
      terms: [
        `**接受**：你在「${myRace}」里豁免；普莱斯会在「${otherRace}」里指证对方（真相 +3，指向对方）；2000 年一案「普莱斯」+2。`,
        '**拒绝**：如果你们两个都拒绝，普莱斯会乱了阵脚——2000 年一案「普莱斯」−4。',
        '**但如果你们都接受**——他会把你们两个都卖掉：各自的案子真相 +2 并指向你们，2000 年一案「普莱斯」+3，谁也不豁免。',
      ],
      note: '对方收到的是同样的提议。你们可以先商量——但对方最后选什么，只有揭晓时才知道。',
    },
    historyLabels: { deal: '05:20 · 交易', sheriff: '06:00 · 警长' },
    done: o
      ? `计票结束。${o.prevails.R3 ? '2000 年一案重新立案。' : '2000 年一案维持"意外"。'}${o.priceArrested ? '普莱斯医生被捕。' : '普莱斯医生全身而退。'}（结局即将揭晓）`
      : null,
    rules: [
      '三场计票：罗丝之死、吉迪恩之死、2000 年林梅之死。每场「真相」≥「普莱斯」即真相成立，否则按普莱斯的说法结案。',
      '你**手里持有**的带终局标记的线索就是选票（公开过、但仍在你手里的也算）。终局开始后证据封存，不能再交给对方。',
      `每轮同时秘密下令：最多递交 ${MAX_CAST} 份、销毁 1 份、舆论 1 次（$${PR_COST.toLocaleString('en-US')}，任一案件任一方 +1）。递交的证据会公开它指向谁；销毁是秘密的，结局时才公开。`,
      `每轮揭晓后，普莱斯在「真相」增长最多的一案 +${REACTION}（平局优先 2000 年、罗丝、吉迪恩；都没增长则不动）。`,
      '05:20 普莱斯的交易：见交易说明。',
      '06:00 警长搜身：你手里仍持有的、牵连你自己的物证/文件/电子/媒体证据会被搜出（各计 1 票）。口供与证人证词搜不出来。出海的人不会被搜身。',
      '起诉：你的案子（曼迪＝罗丝之死，伊森＝吉迪恩之死）真相成立、你被某张证据指向、且未被豁免 → 被起诉。若普莱斯也被指向，罪名减轻（过失致死 / 二级谋杀）。律师名片只降一级。',
      '普莱斯被捕：2000 年一案真相成立，或你们的案子真相成立且指向了他。',
      '遗嘱：交给律师，或在 06:00 被警长找到（谁拿着都一样，出海也带不走）即生效；烧掉则作废。伊森若因吉迪恩之死被起诉，依佛州"杀人者不得继承"规定失去份额；出海的人放弃遗产。',
    ],
  }
}

export const finaleModule: FinaleModule = {
  init(state, now) {
    const f: FinaleState = {
      round: 1,
      phase: 'orders',
      deadline: now + ROUND_SECONDS * 1000,
      orders: {},
      deal: {},
      dealResult: null,
      truth: { R1: 0, R2: 0, R3: 0 },
      price: { ...PRICE_BASE },
      extraExposed: { R1: [], R2: [], R3: [] },
      immune: [],
      casts: [],
      burned: [],
      usedItems: [],
      fled: [],
      will: { state: 'none', by: null },
      history: [],
      secrets: [],
      outcome: null,
    }
    state.finale = f
    startOrders(state, now, 1)
  },

  act(state, seat, payload, now) {
    const f = fs(state)
    if (!payload || typeof payload !== 'object') return '无效操作'
    const p = payload as { type?: string; order?: unknown; choice?: unknown; round?: unknown }
    if (f.phase === 'done') return '计票已经结束'
    if (p.type === 'order') {
      if (f.phase !== 'orders') return '现在不是下令的时候'
      // 带了轮次就必须是当前轮：双击或网络重发的旧命令不能落到下一轮
      if (p.round !== undefined && p.round !== f.round) return '那一轮已经结算了，命令没有生效'
      if (f.orders[seat]) return '你本轮已经锁定了命令'
      const o = validateOrder(state, seat, p.order)
      if (typeof o === 'string') return o
      f.orders[seat] = o
      appendLog(state, now, 'DM', otherSeat(seat), `${nameOf(state, seat)} 已锁定第 ${f.round} 轮的命令。`, 'dm')
      if (SEATS.every(s => f.orders[s])) advanceAfterOrders(state, now)
      return
    }
    if (p.type === 'deal') {
      if (f.phase !== 'deal') return '现在没有交易'
      if (f.deal[seat]) return '你已经回复了普莱斯'
      if (p.choice !== 'accept' && p.choice !== 'refuse') return '请选择接受或拒绝'
      f.deal[seat] = p.choice
      appendLog(state, now, 'DM', otherSeat(seat), `${nameOf(state, seat)} 已经回复了普莱斯。`, 'dm')
      if (SEATS.every(s => f.deal[s])) {
        resolveDeal(state, now)
        startOrders(state, now, 2)
      }
      return
    }
    return '未知操作'
  },

  tick(state, now) {
    const f = fs(state)
    if (!f || f.phase === 'done' || now < f.deadline) return false
    if (f.phase === 'orders') {
      for (const s of SEATS) {
        if (!f.orders[s]) {
          f.orders[s] = EMPTY_ORDER
          appendLog(state, now, 'DM', s, '时间到，你本轮没有下令。', 'dm')
        }
      }
      advanceAfterOrders(state, now)
      return true
    }
    if (f.phase === 'deal') {
      for (const s of SEATS) if (!f.deal[s]) f.deal[s] = 'refuse'
      resolveDeal(state, now)
      startOrders(state, now, 2)
      return true
    }
    return false
  },

  deadline(state) {
    const f = fs(state)
    if (!f || f.phase === 'done') return null
    return f.deadline
  },

  isDone(state) {
    const f = fs(state)
    return !!f && f.phase === 'done'
  },

  view(state, seat): FinaleView | null {
    const f = fs(state)
    if (!f) return null
    const me = whoOfSeat(state, seat)
    const hand = handOf(state, seat).map(id => {
      const meta = FINALE_CARDS[id]
      const kind = clueById.get(id)?.kind
      return {
        id,
        title: title(id),
        icon: clueById.get(id)?.icon ?? '📄',
        race: meta.race,
        weight: meta.weight,
        implicates: meta.implicates.map(w => WHO_LABEL[w]),
        searchable: meta.implicates.includes(me) && !!kind && SEARCHABLE_KINDS.includes(kind),
      }
    })
    const items = (Object.values(ITEMS) as string[])
      .filter(it => hasItem(state, seat, it))
      .map(it => ({ id: it, title: title(it), icon: clueById.get(it)?.icon ?? '🎁', used: f.usedItems.includes(it) }))
    const other = otherSeat(seat)
    const mapCast = (c: CastRecord) => ({ id: c.card, title: title(c.card), race: c.race, weight: c.weight, round: c.round, voided: c.voided, found: !!c.found })
    const myRace = ownRace(me)
    const otherRace = ownRace(me === 'mandy' ? 'ethan' : 'mandy')
    const showDeal = f.phase === 'deal' || !!f.dealResult
    return {
      round: f.round,
      phase: f.phase,
      deadline: f.phase === 'done' ? null : f.deadline,
      races: RACES.map(r => ({ id: r, title: RACE_INFO[r].title, claimText: RACE_INFO[r].cover, truth: f.truth[r], claim: f.price[r] })),
      hand,
      holdsWill: holdsWill(state, seat),
      items,
      money: state.seats[seat].money,
      prCost: PR_COST,
      maxCast: MAX_CAST,
      mySubmitted: f.phase === 'orders' ? !!f.orders[seat] : f.phase === 'deal' ? !!f.deal[seat] : true,
      otherSubmitted: f.phase === 'orders' ? !!f.orders[other] : f.phase === 'deal' ? !!f.deal[other] : true,
      myCast: f.casts.filter(c => c.seat === seat).map(mapCast),
      otherCast: f.casts.filter(c => c.seat === other).map(mapCast),
      history: f.history,
      deal: showDeal
        ? {
            myRaceTitle: RACE_INFO[myRace].title,
            otherRaceTitle: RACE_INFO[otherRace].title,
            myChoice: f.deal[seat] ?? null,
            result: f.dealResult,
          }
        : null,
      immune: f.immune.includes(me),
      fled: f.fled.includes(seat),
      outcome: f.outcome,
      copy: finaleCopy(state, seat, f),
      actions: f.phase === 'orders' && !f.orders[seat]
        ? [{ id: 'pass', label: '本轮不出手', payload: { type: 'order', round: f.round, order: EMPTY_ORDER } }]
        : f.phase === 'deal' && !f.deal[seat]
          ? [{ id: 'refuse', label: '拒绝交易', payload: { type: 'deal', choice: 'refuse' } }]
          : [],
    }
  },
}
