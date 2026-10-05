// 《摇摆州》· 终局大机制「警长的名单」（服务器端专用）
//
// 06:00 警长到。名单上有三个人：曼迪、伊森、普莱斯医生，每人一排格子。
// 一共三轮（05:00 / 05:20 / 05:40）：两人同时秘密交出一份证据，证据指向谁就给谁填一格。
// 第 1 轮之后插入"未知剧情"：普莱斯的交易（囚徒困境）。
// 06:00 结算：格子满了的人被带走。普莱斯的话（担保与指证）只在他自己没被带走时才算数。

import type { GameState, Seat } from '../../types'
import { SEATS, otherSeat } from '../../types'
import type { FinaleModule } from '../../runtime'
import { appendLog } from '../../log'
import { CLUES } from './clues'
import { NPCS } from './npcs'
import { ETHAN, MANDY, ROLES } from './roles'
import { FINALE_TEXT } from './content'
import type { FinaleCard, FinaleCopy, FinaleItem, FinaleMark, FinaleOrder, FinaleOutcome, FinalePerson, FinaleReveal, FinaleView, Who } from './finaleTypes'

export type { Who }
export type Order = FinaleOrder
export type Outcome = FinaleOutcome
export type CaseId = 'rose' | 'gideon' | 'mei'
type Player = 'mandy' | 'ethan'

export const CASE_TITLE: Record<CaseId, string> = { rose: '罗丝之死', gideon: '吉迪恩之死', mei: '2000 年 · 林梅之死' }

/** 满几格会被带走 */
export const LINES: Record<Who, number> = { mandy: 3, ethan: 3, price: 5 }
/** 律师名片：多一格 */
export const LAWYER_BONUS = 1
/** 普莱斯指证 / 慌了说漏嘴：各填几格 */
export const DEAL_MARKS = 2
export const INTRO_SECONDS = 300
export const ROUND_SECONDS = 240
export const DEAL_SECONDS = 150
export const ROUNDS = 3

export type CardMeta = { about: CaseId; implicates: Who[] }

/**
 * 能交给警长的证据：都指向至少一个人。
 * 只证明"发生了什么"、不指向任何人的线索（尸体、杯子、电话记录……）在推理里用，警长用不上。
 */
export const FINALE_CARDS: Record<string, CardMeta> = {
  // 罗丝之死
  hector_tray: { about: 'rose', implicates: ['mandy'] },
  b_saw: { about: 'rose', implicates: ['mandy'] },
  clutch: { about: 'rose', implicates: ['mandy', 'price'] },
  hector_corridor: { about: 'rose', implicates: ['mandy', 'price'] },
  a_confess: { about: 'rose', implicates: ['mandy', 'price'] },
  med_bag: { about: 'rose', implicates: ['price'] },
  rx_pad: { about: 'rose', implicates: ['price'] },
  med_record: { about: 'rose', implicates: ['price'] },
  golf_card: { about: 'rose', implicates: ['price'] },
  // 吉迪恩之死
  earpiece: { about: 'gideon', implicates: ['ethan'] },
  door_log: { about: 'gideon', implicates: ['ethan'] },
  mike_door: { about: 'gideon', implicates: ['ethan'] },
  cctv_log: { about: 'gideon', implicates: ['ethan'] },
  mike_codes: { about: 'gideon', implicates: ['ethan'] },
  radio_log: { about: 'gideon', implicates: ['ethan'] },
  joan_ethan: { about: 'gideon', implicates: ['ethan'] },
  price_scratch: { about: 'gideon', implicates: ['ethan'] },
  a_saw: { about: 'gideon', implicates: ['ethan'] },
  note: { about: 'gideon', implicates: ['ethan', 'price'] },
  b_confess: { about: 'gideon', implicates: ['ethan', 'price'] },
  printer_log: { about: 'gideon', implicates: ['price'] },
  pc_bin: { about: 'gideon', implicates: ['price'] },
  // 2000 年
  frank_letter: { about: 'mei', implicates: ['price'] },
  frank_log: { about: 'mei', implicates: ['price'] },
  rose_letter: { about: 'mei', implicates: ['price'] },
  confession: { about: 'mei', implicates: ['price'] },
  mei_diary: { about: 'mei', implicates: ['price'] },
  joan_2000: { about: 'mei', implicates: ['price'] },
  price_suit: { about: 'mei', implicates: ['price'] },
}

export const WILL = 'will'
export const ITEMS = { lawyer: 'item_lawyer', headline: 'item_headline', recount: 'item_recount', yacht: 'item_yacht' } as const
type ItemKind = keyof typeof ITEMS

const ITEM_TEXT: Record<ItemKind, string> = {
  lawyer: '你的格子多一格：警长要多一份证据才会带走你。一直有效，不用操作。',
  headline: '这一轮你交出的证据算两份（限一次）。',
  recount: '对方这一轮交出的证据作废，不算数（限一次；对方这一轮没交就不消耗）。',
  yacht: '第三轮可以出海：06:00 时你已经不在庄园，警长带不走你；但遗嘱里你的那份就不要了。出海这一轮，你仍然可以交出一份证据。',
}

const clueById = new Map(CLUES.map(c => [c.id, c]))
const title = (id: string) => clueById.get(id)?.title ?? id
const WHO_LABEL: Record<Who, string> = { mandy: '曼迪', ethan: '伊森', price: '普莱斯医生' }
const ROLE_OF: Record<Player, string> = { mandy: MANDY, ethan: ETHAN }

export type DealChoice = 'accept' | 'refuse'
export type DealResult = NonNullable<FinaleOutcome['deal']>

export type MarkRecord = {
  target: Who
  kind: FinaleMark['kind']
  label: string
  /** 交出这一格的座位；普莱斯说的为 null */
  seat: Seat | null
  /** 来自哪份证据（证据格才有） */
  card?: string
  round: number
  double: boolean
  voided: boolean
}

export type Handed = { seat: Seat; card: string; round: number; headline: boolean; voided: boolean }

export type FinaleState = {
  phase: 'intro' | 'orders' | 'deal' | 'done'
  round: number
  deadline: number
  introReady: Seat[]
  orders: Partial<Record<Seat, Order>>
  deal: Partial<Record<Seat, DealChoice>>
  dealResult: DealResult | null
  handed: Handed[]
  marks: MarkRecord[]
  /** 普莱斯答应替谁作证 */
  vouched: Player[]
  /** 用过的"限一次"道具（按道具记） */
  usedItems: string[]
  fled: Seat[]
  reveals: FinaleReveal[]
  secrets: string[]
  outcome: Outcome | null
}

export const EMPTY_ORDER: Order = { card: null, headline: false, recount: false, flee: false }

function fs(state: GameState): FinaleState {
  return state.finale as FinaleState
}

function whoOfSeat(state: GameState, seat: Seat): Player {
  return state.seats[seat].roleId === MANDY ? 'mandy' : 'ethan'
}

function seatOfWho(state: GameState, who: Player): Seat | null {
  return SEATS.find(s => state.seats[s].roleId === ROLE_OF[who]) ?? null
}

function nameOf(state: GameState, seat: Seat) {
  return WHO_LABEL[whoOfSeat(state, seat)]
}

/** 某座位手里还能交的证据 */
export function handOf(state: GameState, seat: Seat): string[] {
  const f = fs(state)
  const out: string[] = []
  for (const [id, c] of Object.entries(state.clues)) {
    if (c.owner !== seat || c.destroyed || !(id in FINALE_CARDS)) continue
    if (f && f.handed.some(h => h.card === id)) continue
    out.push(id)
  }
  return out.sort()
}

function hasItem(state: GameState, seat: Seat, kind: ItemKind) {
  const c = state.clues[ITEMS[kind]]
  return !!c && c.owner === seat && !c.destroyed
}

function itemAvailable(state: GameState, seat: Seat, kind: ItemKind) {
  return hasItem(state, seat, kind) && !fs(state).usedItems.includes(ITEMS[kind])
}

function lineOf(state: GameState, who: Who) {
  if (who === 'price') return LINES.price
  const seat = seatOfWho(state, who)
  return LINES[who] + (seat && hasItem(state, seat, 'lawyer') ? LAWYER_BONUS : 0)
}

function countOf(f: FinaleState, who: Who) {
  return f.marks.filter(m => m.target === who && !m.voided).length
}

function roundClock(round: number) {
  return ['05:00', '05:20', '05:40'][round - 1] ?? ''
}

function validateOrder(state: GameState, seat: Seat, raw: unknown): Order | string {
  const f = fs(state)
  if (!raw || typeof raw !== 'object') return '命令格式不对'
  const o = raw as Partial<Order>
  const card = typeof o.card === 'string' ? o.card : null
  if (card && !handOf(state, seat).includes(card)) return '只能交出你手里的证据'
  const headline = !!o.headline
  if (headline) {
    if (!itemAvailable(state, seat, 'headline')) return '你没有可用的「头版」'
    if (!card) return '「头版」要配合一份证据使用'
  }
  const recount = !!o.recount
  if (recount && !itemAvailable(state, seat, 'recount')) return '你没有可用的「放大镜」'
  const flee = !!o.flee
  if (flee) {
    if (f.round !== ROUNDS) return '只有第三轮才能出海'
    if (!hasItem(state, seat, 'yacht')) return '你没有游艇钥匙'
  }
  return { card, headline, recount, flee }
}

function summaryLine(state: GameState, f: FinaleState) {
  return '现在：' + (['mandy', 'ethan', 'price'] as Who[]).map(w => `${WHO_LABEL[w]} ${countOf(f, w)} 格（满 ${lineOf(state, w)} 格带走）`).join('，')
}

function resolveRound(state: GameState, now: number) {
  const f = fs(state)
  const lines: string[] = []
  const orders: Record<Seat, Order> = { P1: f.orders.P1 ?? EMPTY_ORDER, P2: f.orders.P2 ?? EMPTY_ORDER }

  // 1. 交出证据
  for (const seat of SEATS) {
    const o = orders[seat]
    const who = nameOf(state, seat)
    if (!o.card || !handOf(state, seat).includes(o.card)) {
      lines.push(`🤐 ${who}这一轮没有交出证据。`)
      continue
    }
    const meta = FINALE_CARDS[o.card]
    const headline = o.headline && itemAvailable(state, seat, 'headline')
    if (headline) f.usedItems.push(ITEMS.headline)
    f.handed.push({ seat, card: o.card, round: f.round, headline, voided: false })
    for (const target of meta.implicates) {
      f.marks.push({ target, kind: 'card', label: title(o.card), seat, card: o.card, round: f.round, double: false, voided: false })
      if (headline) f.marks.push({ target, kind: 'card', label: `${title(o.card)}（头版）`, seat, card: o.card, round: f.round, double: true, voided: false })
    }
    const gain = headline ? 2 : 1
    lines.push(`🗂️ ${who}交出「${title(o.card)}」（${CASE_TITLE[meta.about]}）→ ${meta.implicates.map(w => `${WHO_LABEL[w]} +${gain}`).join('、')}${headline ? '（🗞️ 登上头版，算两份）' : ''}`)
  }

  // 2. 放大镜：对方这一轮交出的证据作废
  for (const seat of SEATS) {
    if (!orders[seat].recount || !itemAvailable(state, seat, 'recount')) continue
    const target = f.handed.find(h => h.seat === otherSeat(seat) && h.round === f.round && !h.voided)
    if (!target) {
      appendLog(state, now, 'DM', seat, '🔍 对方这一轮什么也没交，你的放大镜没有用上（之后还能用）。', 'dm')
      continue
    }
    target.voided = true
    for (const m of f.marks) if (m.card === target.card) m.voided = true
    f.usedItems.push(ITEMS.recount)
    lines.push(`🔍 ${nameOf(state, seat)}拿出放大镜，指出「${title(target.card)}」有问题——这份证据作废，不算数。`)
  }

  // 3. 出海
  if (f.round === ROUNDS) {
    for (const seat of SEATS) {
      if (!orders[seat].flee || !hasItem(state, seat, 'yacht')) continue
      f.fled.push(seat)
      lines.push(`🛥️ ${nameOf(state, seat)}没有回到大厅。码头方向传来游艇引擎的声音。`)
      f.secrets.push(`${nameOf(state, seat)}在 05:40 驾驶"第二次机会号"出海逃亡。`)
    }
  }

  lines.push(summaryLine(state, f))
  f.reveals.push({ round: f.round, title: `第 ${f.round} 轮揭晓（${roundClock(f.round)}）`, lines })
  appendLog(state, now, 'DM', 'all', `🚨 第 ${f.round} 轮揭晓（${roundClock(f.round)}）\n${lines.join('\n')}`, 'event')
  f.orders = {}
}

function resolveDeal(state: GameState, now: number) {
  const f = fs(state)
  const ms = seatOfWho(state, 'mandy')
  const es = seatOfWho(state, 'ethan')
  const m = (ms && f.deal[ms]) ?? 'refuse'
  const e = (es && f.deal[es]) ?? 'refuse'
  const lines: string[] = []
  const accuse = (target: Player, label: string) => {
    for (let i = 0; i < DEAL_MARKS; i++) f.marks.push({ target, kind: 'testimony', label, seat: null, round: 1.5, double: false, voided: false })
  }
  const ACCUSE_ETHAN = '普莱斯的指证：「我看见伊森上了灯塔」'
  const ACCUSE_MANDY = '普莱斯的指证：「曼迪偷过我的药」'
  if (m === 'refuse' && e === 'refuse') {
    f.dealResult = 'both_refuse'
    for (let i = 0; i < DEAL_MARKS; i++) f.marks.push({ target: 'price', kind: 'panic', label: '他慌了，当众说漏了嘴', seat: null, round: 1.5, double: false, voided: false })
    lines.push('普莱斯的交易，你们谁都没有接。乔安看着你们并肩站在大厅里，在本子上写下了什么。')
    lines.push(`普莱斯第一次乱了阵脚，当着众人说漏了嘴：普莱斯医生 +${DEAL_MARKS}。`)
  } else if (m === 'accept' && e === 'refuse') {
    f.dealResult = 'mandy_only'
    f.vouched.push('mandy')
    accuse('ethan', ACCUSE_ETHAN)
    lines.push('普莱斯医生走到众人面前："曼迪整晚都和我在一起，她什么也没做。"')
    lines.push(`接着他压低声音："可我必须说出来——两点半以后，我看见保镖伊森上了灯塔。"伊森 +${DEAL_MARKS}。`)
  } else if (m === 'refuse' && e === 'accept') {
    f.dealResult = 'ethan_only'
    f.vouched.push('ethan')
    accuse('mandy', ACCUSE_MANDY)
    lines.push('普莱斯医生走到众人面前："伊森两点以后一直在我旁边，他什么也没做。"')
    lines.push(`接着他叹了口气："我本不想说——曼迪那孩子从我药箱里偷过东西。"曼迪 +${DEAL_MARKS}。`)
  } else {
    f.dealResult = 'both_accept'
    accuse('mandy', ACCUSE_MANDY)
    accuse('ethan', ACCUSE_ETHAN)
    lines.push('普莱斯医生分别向你们两人许了诺——然后当着所有人的面，把你们两个都卖了："曼迪偷了我的药，伊森上了灯塔。"')
    lines.push(`曼迪 +${DEAL_MARKS}，伊森 +${DEAL_MARKS}。他替谁作证？谁也没有。`)
  }
  lines.push('（记住：普莱斯的话只在他自己没被带走时才算数。）')
  lines.push(summaryLine(state, f))
  for (const s of SEATS) f.secrets.push(`${nameOf(state, s)}${f.deal[s] === 'accept' ? '接受' : '拒绝'}了普莱斯的交易。`)
  f.reveals.push({ round: 1.5, title: '05:20 · 普莱斯的交易', lines })
  appendLog(state, now, 'DM', 'all', `🤝 05:20 · 普莱斯的交易\n${lines.join('\n')}`, 'event')
}

/** 06:00 警长到：先看普莱斯，再看你们俩 */
function sheriffArrives(state: GameState, now: number) {
  const f = fs(state)
  const lines: string[] = ['🚔 06:00，警长到了。他拿着你们交上去的证据，一个一个看过去。']
  const priceTaken = countOf(f, 'price') >= LINES.price
  if (priceTaken) {
    lines.push(`🩺 普莱斯医生：${countOf(f, 'price')} 格，满了 ${LINES.price} 格。警长给他戴上了手铐。`)
    const said = f.marks.filter(m => m.kind === 'testimony' && !m.voided)
    if (said.length > 0 || f.vouched.length > 0) {
      for (const m of said) m.voided = true
      lines.push('他被带走了，他说过的话也就不算数了：他替谁作的证、指证过谁，全部作废。')
    }
  } else {
    lines.push(`🩺 普莱斯医生：${countOf(f, 'price')} 格，不够 ${LINES.price} 格。警长和他握了握手。`)
  }
  const vouchedOk = (w: Player) => f.vouched.includes(w) && !priceTaken
  for (const w of ['mandy', 'ethan'] as Player[]) {
    const seat = seatOfWho(state, w)
    const n = countOf(f, w)
    const line = lineOf(state, w)
    const ta = w === 'mandy' ? '她' : '他'
    if (seat && f.fled.includes(seat)) lines.push(`🛥️ ${WHO_LABEL[w]}已经出海了，不在庄园里。`)
    else if (vouchedOk(w)) lines.push(`🤝 ${WHO_LABEL[w]}：普莱斯医生说${ta}整晚都和自己在一起。警长点点头，没有带走${ta}。`)
    else if (n >= line) lines.push(`🚨 ${WHO_LABEL[w]}：${n} 格，满了 ${line} 格。警长把${ta}带走了。`)
    else lines.push(`✅ ${WHO_LABEL[w]}：${n} 格，不够 ${line} 格。${ta}可以走了。`)
  }
  const willOk = !!state.clues[WILL] && !state.clues[WILL]!.destroyed
  lines.push(willOk ? '📜 律师宣读了吉迪恩昨晚签下的新遗嘱。' : '📜 吉迪恩的新遗嘱始终没有找到。')
  f.reveals.push({ round: 4, title: '06:00 · 警长到了', lines })
  appendLog(state, now, 'DM', 'all', lines.join('\n'), 'event')
}

export function computeOutcome(state: GameState): Outcome {
  const f = fs(state)
  const counts = { mandy: countOf(f, 'mandy'), ethan: countOf(f, 'ethan'), price: countOf(f, 'price') }
  const lines = { mandy: lineOf(state, 'mandy'), ethan: lineOf(state, 'ethan'), price: lineOf(state, 'price') }
  const priceTaken = counts.price >= lines.price
  const fledOf = (w: Player) => {
    const seat = seatOfWho(state, w)
    return !!seat && f.fled.includes(seat)
  }
  const fled = { mandy: fledOf('mandy'), ethan: fledOf('ethan') }
  const vouched = { mandy: f.vouched.includes('mandy') && !priceTaken, ethan: f.vouched.includes('ethan') && !priceTaken }
  // 普莱斯被带走时，他的指证不算（sheriffArrives 已把这些格作废；这里按规则再算一遍，不依赖调用顺序）
  const countFor = (w: Player) => f.marks.filter(m => m.target === w && !m.voided && !(priceTaken && m.kind === 'testimony')).length
  const takenOf = (w: Player) => !fled[w] && !vouched[w] && countFor(w) >= lines[w]
  const taken = { mandy: takenOf('mandy'), ethan: takenOf('ethan'), price: priceTaken }
  const raised = { rose: false, gideon: false, mei: false }
  const priceFor = { rose: false, gideon: false, mei: false }
  for (const h of f.handed) {
    if (h.voided) continue
    const meta = FINALE_CARDS[h.card]
    raised[meta.about] = true
    if (meta.implicates.includes('price')) priceFor[meta.about] = true
  }
  const will = state.clues[WILL] && !state.clues[WILL]!.destroyed ? 'executed' : 'missing'
  return {
    taken,
    fled,
    vouched,
    counts: { mandy: countFor('mandy'), ethan: countFor('ethan'), price: counts.price },
    lines,
    raised,
    priceFor,
    meiReopened: priceTaken && priceFor.mei,
    will,
    mandyInherits: will === 'executed' && !fled.mandy,
    // 佛州"杀人者不得继承"：伊森因吉迪恩之死被带走，就失去份额；出海也拿不到
    ethanInherits: will === 'executed' && !fled.ethan && !taken.ethan,
    deal: f.dealResult,
  }
}

function startOrders(state: GameState, now: number, round: number) {
  const f = fs(state)
  f.round = round
  f.phase = 'orders'
  f.orders = {}
  f.deadline = now + ROUND_SECONDS * 1000
  appendLog(state, now, 'DM', 'all', `⏰ ${roundClock(round)} · 第 ${round} 轮：挑一份证据交给警长（也可以不交）。`, 'system')
}

function advanceAfterOrders(state: GameState, now: number) {
  const f = fs(state)
  resolveRound(state, now)
  if (f.round === 1) {
    f.phase = 'deal'
    f.deal = {}
    f.deadline = now + DEAL_SECONDS * 1000
    appendLog(state, now, 'DM', 'all', '📞 05:20 · 未知剧情：普莱斯医生分别把你们叫到了走廊尽头……（请在「终局」里回复他）', 'system')
  } else if (f.round < ROUNDS) {
    startOrders(state, now, f.round + 1)
  } else {
    sheriffArrives(state, now)
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
  const other: Player = me === 'mandy' ? 'ethan' : 'mandy'
  const o = f.outcome
  return {
    tag: 'SHERIFF',
    title: '警长的名单',
    intro: FINALE_TEXT,
    clocks: ['05:00', '05:20', '05:40'],
    introClock: '05:00 · 天亮之前',
    dealClock: '05:20 · 普莱斯的交易',
    doneClock: '06:00 · 警长到了',
    rules: [
      '06:00 警长就到。名单上有三个人：曼迪、伊森、普莱斯医生。每个人下面有一排格子。',
      '一共三轮。每一轮，你从手里挑**一份**证据交给警长，也可以不交。',
      '证据指向谁，就给谁填上一格；同时指向两个人的，两个人各填一格。',
      '你们两个人同时偷偷选，都选好了才一起揭晓。',
      '第一轮之后，普莱斯医生会私下找你谈一笔交易。',
      `06:00 警长到了：谁的格子填满了，谁就会被带走。曼迪和伊森各 ${LINES.mandy} 格；普莱斯医生是有身份的人，要 ${LINES.price} 格。`,
      '普莱斯的话只在他自己没被带走时才算数：他要是被带走了，他替谁作的证、指证过谁，全部作废。',
      '拍卖得到的道具在这里用：⚖️ 律师名片——你的格子多一格；🗞️ 头版——一份证据算两份（限一次）；🔍 放大镜——对方这一轮交出的证据作废（限一次）；🛥️ 游艇钥匙——第三轮可以出海，警长带不走你，但遗嘱里你的那份就不要了。',
      '只证明"发生了什么"、不指向任何人的线索，警长用不上，所以不会出现在你的证据里。',
    ],
    pickHint: '点一份证据，再点「交给警长」。不想交，就点「这一轮不交」。',
    waiting: '你已经选好了，等对方……（你们可以在记录里商量）',
    noCards: '你手里已经没有能交给警长的证据了。',
    deal: {
      intro: '走廊尽头，普莱斯医生压低声音，像所有人的好外公：\n"孩子，你我都知道今晚发生了什么。只要你点头，我就告诉警长**你**整晚都和我在一起。至于另一个人……我会说出我‘看到’的。"',
      terms: [
        `**接受**：普莱斯替你作证，警长不会带走你；同时他当众指证${WHO_LABEL[other]}——${WHO_LABEL[other]} +${DEAL_MARKS} 格。`,
        `**拒绝**：如果你们两个都拒绝，普莱斯会慌，当众说漏嘴——普莱斯医生 +${DEAL_MARKS} 格。`,
        `**但如果你们两个都接受**：他会把你们两个都卖掉——你们各 +${DEAL_MARKS} 格，谁的担保都不算数。`,
        '**还要记住**：普莱斯的话只在他自己没被带走时才算数。他要是被带走了，他的担保和指证全部作废。',
      ],
      note: `${WHO_LABEL[other]}收到的是同样的提议。你们可以先商量——但对方最后选什么，只有揭晓时才知道。`,
      accept: '接受交易',
      refuse: '拒绝交易',
    },
    vouched: '普莱斯答应替你作证：只要他自己没被带走，警长就不会带走你。',
    testimonyHint: '虚线格是普莱斯说的话：他要是被带走，这些格就作废。',
    done: o
      ? `06:00 · ${o.taken.price ? '普莱斯医生被带走了。' : '普莱斯医生全身而退。'}${o.taken.mandy ? '曼迪被带走了。' : ''}${o.taken.ethan ? '伊森被带走了。' : ''}（结局即将揭晓）`
      : null,
  }
}

function personView(state: GameState, seat: Seat, f: FinaleState, who: Who): FinalePerson {
  const priceTaken = f.outcome?.taken.price ?? false
  const avatar = who === 'price'
    ? NPCS.find(n => n.id === 'price')?.avatar ?? '🩺'
    : ROLES.find(r => r.id === ROLE_OF[who])?.avatar ?? '🙂'
  const color = who === 'price' ? '#a78bfa' : ROLES.find(r => r.id === ROLE_OF[who])?.color ?? '#ffffff'
  const marks: FinaleMark[] = f.marks.filter(m => m.target === who).map(m => ({
    kind: m.kind,
    label: m.label,
    by: m.seat === null ? 'price' : m.seat === seat ? 'me' : 'other',
    round: m.round,
    double: m.double,
    void: m.voided,
  }))
  const pSeat = who === 'price' ? null : seatOfWho(state, who)
  return {
    who,
    name: WHO_LABEL[who],
    avatar,
    color,
    isMe: who !== 'price' && pSeat === seat,
    line: lineOf(state, who),
    marks,
    count: marks.filter(m => !m.void).length,
    vouched: who !== 'price' && f.vouched.includes(who) && !priceTaken,
    fled: !!pSeat && f.fled.includes(pSeat),
    taken: f.outcome ? f.outcome.taken[who] : null,
  }
}

export const finaleModule: FinaleModule = {
  init(state, now) {
    const f: FinaleState = {
      phase: 'intro',
      round: 0,
      deadline: now + INTRO_SECONDS * 1000,
      introReady: [],
      orders: {},
      deal: {},
      dealResult: null,
      handed: [],
      marks: [],
      vouched: [],
      usedItems: [],
      fled: [],
      reveals: [],
      secrets: [],
      outcome: null,
    }
    state.finale = f
    appendLog(state, now, 'DM', 'all', '🚔 05:00 · 终局「警长的名单」：先看规则，两人都点「我看懂了」就开始。', 'system')
  },

  act(state, seat, payload, now) {
    const f = fs(state)
    if (!payload || typeof payload !== 'object') return '无效操作'
    const p = payload as { type?: string; order?: unknown; choice?: unknown; round?: unknown }
    if (f.phase === 'done') return '已经结束了'
    if (p.type === 'ready') {
      if (f.phase !== 'intro') return '已经开始了'
      if (!f.introReady.includes(seat)) {
        f.introReady.push(seat)
        appendLog(state, now, 'DM', otherSeat(seat), `${nameOf(state, seat)}已经看懂规则了。`, 'dm')
      }
      if (SEATS.every(s => f.introReady.includes(s))) startOrders(state, now, 1)
      return
    }
    if (p.type === 'order') {
      if (f.phase !== 'orders') return '现在不是交证据的时候'
      // 带了轮次就必须是当前轮：双击或网络重发的旧命令不能落到下一轮
      if (p.round !== undefined && p.round !== f.round) return '那一轮已经揭晓了，这次没有生效'
      if (f.orders[seat]) return '你这一轮已经选好了'
      const o = validateOrder(state, seat, p.order)
      if (typeof o === 'string') return o
      f.orders[seat] = o
      appendLog(state, now, 'DM', otherSeat(seat), `${nameOf(state, seat)}已经选好了第 ${f.round} 轮。`, 'dm')
      if (SEATS.every(s => f.orders[s])) advanceAfterOrders(state, now)
      return
    }
    if (p.type === 'deal') {
      if (f.phase !== 'deal') return '现在没有交易'
      if (f.deal[seat]) return '你已经回复了普莱斯'
      if (p.choice !== 'accept' && p.choice !== 'refuse') return '请选择接受或拒绝'
      f.deal[seat] = p.choice
      appendLog(state, now, 'DM', otherSeat(seat), `${nameOf(state, seat)}已经回复了普莱斯。`, 'dm')
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
    if (f.phase === 'intro') {
      startOrders(state, now, 1)
      return true
    }
    if (f.phase === 'orders') {
      for (const s of SEATS) {
        if (!f.orders[s]) {
          f.orders[s] = EMPTY_ORDER
          appendLog(state, now, 'DM', s, '时间到，你这一轮没有交出证据。', 'dm')
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
    const other = otherSeat(seat)
    const rank = (id: string) => {
      const imp = FINALE_CARDS[id].implicates
      return imp.includes('price') ? 0 : imp.includes(me) ? 2 : 1
    }
    const hand: FinaleCard[] = handOf(state, seat)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map(id => ({
        id,
        title: title(id),
        icon: clueById.get(id)?.icon ?? '📄',
        about: CASE_TITLE[FINALE_CARDS[id].about],
        points: FINALE_CARDS[id].implicates,
        text: clueById.get(id)?.text ?? '',
      }))
    const items: FinaleItem[] = (Object.keys(ITEMS) as ItemKind[])
      .filter(k => hasItem(state, seat, k))
      .map(k => ({ kind: k, title: title(ITEMS[k]), icon: clueById.get(ITEMS[k])?.icon ?? '🎁', text: ITEM_TEXT[k], used: f.usedItems.includes(ITEMS[k]) }))
    const submitted = (s: Seat) =>
      f.phase === 'intro' ? f.introReady.includes(s)
        : f.phase === 'orders' ? !!f.orders[s]
          : f.phase === 'deal' ? !!f.deal[s]
            : true
    return {
      phase: f.phase,
      round: f.round,
      deadline: f.phase === 'done' ? null : f.deadline,
      people: (['mandy', 'ethan', 'price'] as Who[]).map(w => personView(state, seat, f, w)),
      hand,
      items,
      mySubmitted: submitted(seat),
      otherSubmitted: submitted(other),
      reveals: f.reveals,
      deal: f.phase === 'deal' || f.dealResult ? { myChoice: f.deal[seat] ?? null, result: f.dealResult } : null,
      outcome: f.outcome,
      copy: finaleCopy(state, seat, f),
      actions: f.phase === 'intro' && !f.introReady.includes(seat)
        ? [{ id: 'ready', label: '我看懂了', payload: { type: 'ready' } }]
        : f.phase === 'orders' && !f.orders[seat]
          ? [{ id: 'pass', label: '这一轮不交', payload: { type: 'order', round: f.round, order: EMPTY_ORDER } }]
          : f.phase === 'deal' && !f.deal[seat]
            ? [{ id: 'refuse', label: '拒绝交易', payload: { type: 'deal', choice: 'refuse' } }]
            : [],
    }
  },
}
