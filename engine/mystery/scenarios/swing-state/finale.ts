// 《摇摆州》· 终局大机制「警长的名单」（服务器端专用）
//
// 06:00 警长到。名单上有三个人：曼迪、伊森、普莱斯医生，每人一排格子，格子填满的人会被带走。
// 一共三轮（05:00 / 05:15 / 05:45）：两人同时秘密交出一份证据，证据指向谁就给谁填一格。
// 交出自己的自白 = 认罪：06:00 一定会被带走，但普莱斯医生被填 2 格。
// 第 2 轮之后插入"未知剧情"：普莱斯的交易（囚徒困境）——他可以"保"一个人（多 2 格），也可以"告"一个人（填 2 格）。
// 06:00 结算：先看普莱斯，他被带走的话，他保的、告的全部不算。

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
export const LINES: Record<Who, number> = { mandy: 3, ethan: 3, price: 6 }
/** 律师名片：多一格 */
export const LAWYER_BONUS = 1
/** 交易：普莱斯"保"你（多 2 格才会被带走）/"告"你（填 2 格）/ 他慌了说漏嘴（他自己填 2 格） */
export const VOUCH_BONUS = 2
export const DEAL_MARKS = 2
/** 认罪：普莱斯填几格 */
export const CONFESS_MARKS = 2
export const INTRO_SECONDS = 300
export const ROUND_SECONDS = 240
export const DEAL_SECONDS = 150
export const ROUNDS = 3
/** 第几轮之后谈交易 */
export const DEAL_AFTER = 2
const CLOCKS = ['05:00', '05:15', '05:45']
const DEAL_CLOCK = '05:30'

export type CardMeta = {
  about: CaseId
  /** 交出去给谁填一格 */
  implicates: Who[]
  /** 自白：交出去就是这个人认罪（06:00 一定被带走），普莱斯填 CONFESS_MARKS 格 */
  confessor?: Player
  /** 为什么指向他（终局里显示并朗读） */
  why: string
}

/**
 * 能交给警长的证据：都指向至少一个人。
 * 只证明"发生了什么"、不指向任何人的线索（尸体、杯子、电话记录……）在推理里用，警长用不上。
 */
export const FINALE_CARDS: Record<string, CardMeta> = {
  // 罗丝之死
  hector_tray: { about: 'rose', implicates: ['mandy'], why: '祝酒前那三分钟，备餐间里只有曼迪一个人碰过托盘。' },
  b_saw: { about: 'rose', implicates: ['mandy'], why: '伊森亲眼看见曼迪往一杯香槟里倒了东西。' },
  clutch: { about: 'rose', implicates: ['mandy', 'price'], why: '毒药空瓶在曼迪的手包里；瓶底是药房批号，标签是医生的手写字——警长一查就知道药是普莱斯医生的。' },
  hector_corridor: { about: 'rose', implicates: ['mandy', 'price'], why: '赫克托看见普莱斯医生把那只小瓶塞进了曼迪手里。' },
  a_confess: { about: 'rose', implicates: [], confessor: 'mandy', why: '这是曼迪的认罪：药是普莱斯医生给的，是她亲手倒进了杯子。' },
  med_bag: { about: 'rose', implicates: ['price'], why: '普莱斯的药箱里正好少了一瓶，批号和毒药空瓶一模一样。' },
  rx_pad: { about: 'rose', implicates: ['price'], why: '普莱斯的笔迹和毒药瓶上的标签一模一样。' },
  med_record: { about: 'rose', implicates: ['price'], why: '普莱斯早就知道吉迪恩只拿右边那杯，却让曼迪倒进"你右手边"那杯——毒酒就这样到了罗丝手里。' },
  golf_card: { about: 'rose', implicates: ['price'], why: '普莱斯亲手写下"R 也会作证""天亮之前"——他知道罗丝要揭发他。' },
  // 吉迪恩之死
  earpiece: { about: 'gideon', implicates: ['ethan'], why: '这是庄园保安戴的耳麦，扯断在阳台上；另外两个保安整晚都在摄像头下。' },
  door_log: { about: 'gideon', implicates: ['ethan'], why: '02:37 有人用安保通用码进了灯塔；知道这个码的三个人里，只有伊森不在摄像头下。' },
  mike_door: { about: 'gideon', implicates: ['ethan'], why: '吉迪恩进塔四分钟后，有人用安保通用码跟了进去；知道这个码的只有三个保安。' },
  cctv_log: { about: 'gideon', implicates: ['ethan'], why: '灯塔摄像头是用安保账号 S2 关掉的，系统里写着：S2 就是伊森。' },
  mike_codes: { about: 'gideon', implicates: ['ethan'], why: '三号码只有麦克、路易斯、伊森知道；麦克和路易斯整晚都在摄像头下。' },
  radio_log: { about: 'gideon', implicates: ['ethan'], why: '对讲和录像证明麦克、路易斯一直在岗，知道塔门密码的保安里只剩伊森。' },
  joan_ethan: { about: 'gideon', implicates: ['ethan'], why: '02:47 伊森从北侧门喘着气进来，耳麦不见了，一直揉手腕。' },
  price_scratch: { about: 'gideon', implicates: ['ethan'], why: '伊森手腕上有三道新鲜的抓痕，警长自己就看得到；吉迪恩的指甲缝里正好有皮屑。' },
  a_saw: { about: 'gideon', implicates: ['ethan'], why: '曼迪亲眼看见一个高个子、深色短发的男人把吉迪恩推了下去——在场只有伊森是这个样子。' },
  note: { about: 'gideon', implicates: ['ethan'], why: '这封叫人去灯塔的匿名信，就放在伊森的储物柜里。' },
  b_confess: { about: 'gideon', implicates: [], confessor: 'ethan', why: '这是伊森的认罪：是他把吉迪恩推了下去。他会把匿名信和今晚的事全告诉警长，警长顺着查到写信的人。' },
  printer_log: { about: 'gideon', implicates: ['price'], why: '那封匿名信，是从普莱斯住的 5 号客房打印出来的。' },
  pc_bin: { about: 'gideon', implicates: ['price'], why: '普莱斯客房电脑的回收站里，有一份和匿名信一字不差的文档。' },
  // 2000 年
  frank_letter: { about: 'mei', implicates: ['price'], why: '弗兰克看见从塔里出来的人个子不高、拎着黑色小皮包、手背有抓痕——正是普莱斯医生的样子。' },
  frank_log: { about: 'mei', implicates: ['price'], why: '2000 年的值班日志：塔门口的男人约 5 尺 8 寸、拎黑色小皮包、左手背有抓伤——和普莱斯医生对得上。' },
  rose_letter: { about: 'mei', implicates: ['price'], why: '罗丝在信里写：2000 年那晚，她看见普莱斯医生在备餐间洗袖口上的血。' },
  confession: { about: 'mei', implicates: ['price'], why: '吉迪恩的忏悔信写得清清楚楚：2000 年把林梅推下灯塔的，是普莱斯。' },
  mei_diary: { about: 'mei', implicates: ['price'], why: '林梅在日记里写：普莱斯约她那天夜里两点在灯塔上见面。' },
  joan_2000: { about: 'mei', implicates: ['price'], why: '林梅死前对乔安说：俱乐部里有个医生给姑娘们下药。' },
  price_suit: { about: 'mei', implicates: ['price'], why: '普莱斯的西装内袋里藏着林梅的照片，背面是他的笔迹，写着她死前一天的日期。' },
}

export const WILL = 'will'
export const ITEMS = { lawyer: 'item_lawyer', headline: 'item_headline', recount: 'item_recount', yacht: 'item_yacht' } as const
type ItemKind = keyof typeof ITEMS

const ITEM_TEXT: Record<ItemKind, string> = {
  lawyer: `你要多填 ${LAWYER_BONUS} 格，警长才会带走你。一直有效，不用操作。`,
  headline: '这一轮你交出的证据算两份（只能用一次；就算被放大镜作废，也算用过了）。',
  recount: '对方这一轮交出的证据作废，不算数（只能用一次；对方这一轮没交，就不算用过）。',
  yacht: '第三轮可以出海：06:00 时你已经不在庄园，警长带不走你；但遗产里你的那份就不要了。出海这一轮，你仍然可以交出一份证据。',
}

const clueById = new Map(CLUES.map(c => [c.id, c]))
const title = (id: string) => clueById.get(id)?.title ?? id
const WHO_LABEL: Record<Who, string> = { mandy: '曼迪', ethan: '伊森', price: '普莱斯医生' }
const TA: Record<Who, string> = { mandy: '她', ethan: '他', price: '他' }
const ROLE_OF: Record<Player, string> = { mandy: MANDY, ethan: ETHAN }

export type DealChoice = 'accept' | 'refuse'
export type DealResult = NonNullable<FinaleOutcome['deal']>

export type MarkRecord = {
  target: Who
  kind: FinaleMark['kind']
  label: string
  /** 交出这一格的座位；交易时来的为 null */
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
  /** 普莱斯答应"保"谁 */
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

function countOf(f: FinaleState, who: Who) {
  return f.marks.filter(m => m.target === who && !m.voided).length
}

function priceTakenNow(f: FinaleState) {
  return countOf(f, 'price') >= LINES.price
}

/** 满几格会被带走：基本格数 + 律师名片 + 普莱斯的"保"（他被带走就不算） */
function linePartsOf(state: GameState, who: Who) {
  if (who === 'price') return { base: LINES.price, lawyer: 0, vouch: 0 }
  const f = fs(state)
  const seat = seatOfWho(state, who)
  const lawyer = seat && hasItem(state, seat, 'lawyer') ? LAWYER_BONUS : 0
  const priceGone = f.outcome ? f.outcome.taken.price : false
  const vouch = f.vouched.includes(who) && !priceGone ? VOUCH_BONUS : 0
  return { base: LINES[who], lawyer, vouch }
}

function lineOf(state: GameState, who: Who) {
  const p = linePartsOf(state, who)
  return p.base + p.lawyer + p.vouch
}

/** 交出了（没被作废的）自己的自白 */
function confessedOf(f: FinaleState, who: Player) {
  return f.handed.some(h => !h.voided && FINALE_CARDS[h.card].confessor === who)
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

/** 每次揭晓后的小结：谁几格、还差几格 */
function summaryLine(state: GameState, f: FinaleState) {
  return '现在：' + (['mandy', 'ethan', 'price'] as Who[]).map(w => {
    const n = countOf(f, w)
    const line = lineOf(state, w)
    if (w !== 'price' && confessedOf(f, w)) return `${WHO_LABEL[w]}已经认罪`
    return n >= line ? `${WHO_LABEL[w]} ${n} 格，已经满了` : `${WHO_LABEL[w]} ${n} 格，还差 ${line - n} 格`
  }).join('；') + '。'
}

function effectText(meta: CardMeta, headline: boolean) {
  const k = headline ? 2 : 1
  if (meta.confessor) return `${WHO_LABEL[meta.confessor]}认罪了，06:00 警长一定会带走${TA[meta.confessor]}；普莱斯医生 +${CONFESS_MARKS * k} 格`
  return meta.implicates.map(w => `${WHO_LABEL[w]} +${k} 格`).join('，')
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
    const targets: Who[] = meta.confessor ? Array(CONFESS_MARKS).fill('price') : meta.implicates
    for (const target of targets) {
      f.marks.push({ target, kind: 'card', label: title(o.card), seat, card: o.card, round: f.round, double: false, voided: false })
      if (headline) f.marks.push({ target, kind: 'card', label: `${title(o.card)}（头版）`, seat, card: o.card, round: f.round, double: true, voided: false })
    }
    if (meta.confessor) f.secrets.push(`第 ${f.round} 轮，${who}把「${title(o.card)}」交给了警长。`)
    lines.push(`🗂️ ${who}交出「${title(o.card)}」→ ${effectText(meta, headline)}。${headline ? '（🗞️ 登上头版，算两份）' : ''}`)
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
      f.secrets.push(`${nameOf(state, seat)}在 05:45 驾驶"第二次机会号"出海逃亡。`)
    }
  }

  lines.push(summaryLine(state, f))
  f.reveals.push({ round: f.round, title: `第 ${f.round} 轮揭晓（${CLOCKS[f.round - 1]}）`, lines })
  appendLog(state, now, 'DM', 'all', `🚨 第 ${f.round} 轮揭晓（${CLOCKS[f.round - 1]}）\n${lines.join('\n')}`, 'event')
  f.orders = {}
}

const ACCUSE_LABEL: Record<Player, string> = {
  mandy: '普莱斯告她：「曼迪从我的药箱里偷过东西」',
  ethan: '普莱斯告他：「伊森跟着吉迪恩上了灯塔」',
}

function resolveDeal(state: GameState, now: number) {
  const f = fs(state)
  const ms = seatOfWho(state, 'mandy')
  const es = seatOfWho(state, 'ethan')
  const m = (ms && f.deal[ms]) ?? 'refuse'
  const e = (es && f.deal[es]) ?? 'refuse'
  const lines: string[] = []
  const accuse = (target: Player) => {
    for (let i = 0; i < DEAL_MARKS; i++) f.marks.push({ target, kind: 'accused', label: ACCUSE_LABEL[target], seat: null, round: DEAL_AFTER + 0.5, double: false, voided: false })
  }
  if (m === 'refuse' && e === 'refuse') {
    f.dealResult = 'both_refuse'
    for (let i = 0; i < DEAL_MARKS; i++) f.marks.push({ target: 'price', kind: 'panic', label: '他慌了，自己说漏了嘴', seat: null, round: DEAL_AFTER + 0.5, double: false, voided: false })
    lines.push('普莱斯的交易，你们两个都拒绝了。他回到大厅，脸色发白。')
    lines.push(`乔安问他怎么了，他脱口而出："那瓶药明明是……"——他猛地闭上了嘴。没有人跟他提过什么药瓶。普莱斯医生 +${DEAL_MARKS} 格。`)
  } else if (m === 'accept' && e === 'refuse') {
    f.dealResult = 'mandy_only'
    f.vouched.push('mandy')
    accuse('ethan')
    lines.push(`普莱斯医生保了曼迪："曼迪只是个端盘子的孩子，她什么都不知道——我可以担保。"曼迪要多 ${VOUCH_BONUS} 格，警长才会带走她。`)
    lines.push(`接着，他告了伊森："伊森跟着吉迪恩上了灯塔，大家都看见了。"伊森 +${DEAL_MARKS} 格。`)
  } else if (m === 'refuse' && e === 'accept') {
    f.dealResult = 'ethan_only'
    f.vouched.push('ethan')
    accuse('mandy')
    lines.push(`普莱斯医生保了伊森："伊森是个好孩子，吉迪恩让他在塔下等着，他就一直等着——我可以担保。"伊森要多 ${VOUCH_BONUS} 格，警长才会带走他。`)
    lines.push(`接着，他告了曼迪："我本不想说——曼迪那孩子从我药箱里偷过东西。"曼迪 +${DEAL_MARKS} 格。`)
  } else {
    f.dealResult = 'both_accept'
    accuse('mandy')
    accuse('ethan')
    lines.push('普莱斯医生分别向你们两个人许了诺——然后当着所有人的面，把你们两个都告了："曼迪偷了我的药，伊森跟着吉迪恩上了灯塔。"')
    lines.push(`曼迪 +${DEAL_MARKS} 格，伊森 +${DEAL_MARKS} 格。他谁也没保。`)
  }
  lines.push('（记住：普莱斯自己要是被带走，他保的不算、告的也擦掉。）')
  lines.push(summaryLine(state, f))
  for (const s of SEATS) f.secrets.push(`${nameOf(state, s)}${f.deal[s] === 'accept' ? '接受' : '拒绝'}了普莱斯的交易。`)
  f.reveals.push({ round: DEAL_AFTER + 0.5, title: `${DEAL_CLOCK} · 普莱斯的交易`, lines })
  appendLog(state, now, 'DM', 'all', `🤝 ${DEAL_CLOCK} · 普莱斯的交易\n${lines.join('\n')}`, 'event')
}

/** 06:00 警长到：先看普莱斯，再看你们俩 */
function sheriffArrives(state: GameState, now: number) {
  const f = fs(state)
  const lines: string[] = ['🚔 06:00，警长到了。他拿着你们交上去的证据，一个一个看过去。']
  const priceTaken = priceTakenNow(f)
  if (priceTaken) {
    lines.push(`🩺 普莱斯医生：${countOf(f, 'price')} 格，满了 ${LINES.price} 格。警长当场给他戴上了手铐。`)
    const said = f.marks.filter(m => m.kind === 'accused' && !m.voided)
    if (said.length > 0 || f.vouched.length > 0) {
      for (const m of said) m.voided = true
      lines.push('他被带走了，他说的话也就不算数了：他保过的人不再有人保，他告过的格子全部擦掉。')
    }
  } else {
    lines.push(`🩺 普莱斯医生：${countOf(f, 'price')} 格，不够 ${LINES.price} 格。警长和他握了握手。`)
  }
  for (const w of ['mandy', 'ethan'] as Player[]) {
    const seat = seatOfWho(state, w)
    const n = countOf(f, w)
    const line = LINES[w] + linePartsOf(state, w).lawyer + (f.vouched.includes(w) && !priceTaken ? VOUCH_BONUS : 0)
    const ta = TA[w]
    if (seat && f.fled.includes(seat)) lines.push(`🛥️ ${WHO_LABEL[w]}已经出海了，不在庄园里。`)
    else if (confessedOf(f, w)) lines.push(`🕯️ ${WHO_LABEL[w]}认了罪。警长把${ta}带走了。`)
    else if (n >= line) lines.push(`🚨 ${WHO_LABEL[w]}：${n} 格，满了 ${line} 格。警长把${ta}带走了。`)
    else if (f.vouched.includes(w) && !priceTaken && n >= line - VOUCH_BONUS) lines.push(`🤝 ${WHO_LABEL[w]}：${n} 格。普莱斯医生保了${ta}，要 ${line} 格才够。警长看了普莱斯一眼，没有带走${ta}。`)
    else lines.push(`✅ ${WHO_LABEL[w]}：${n} 格，不够 ${line} 格。${ta}可以走了。`)
  }
  const willOk = !!state.clues[WILL] && !state.clues[WILL]!.destroyed
  lines.push(willOk ? '📜 律师宣读了吉迪恩昨晚签下的新遗嘱。' : '📜 吉迪恩的新遗嘱始终没有找到。')
  f.reveals.push({ round: 4, title: '06:00 · 警长到了', lines })
  appendLog(state, now, 'DM', 'all', lines.join('\n'), 'event')
}

export function computeOutcome(state: GameState): Outcome {
  const f = fs(state)
  const priceTaken = priceTakenNow(f)
  const fledOf = (w: Player) => {
    const seat = seatOfWho(state, w)
    return !!seat && f.fled.includes(seat)
  }
  const fled = { mandy: fledOf('mandy'), ethan: fledOf('ethan') }
  const confessed = { mandy: confessedOf(f, 'mandy'), ethan: confessedOf(f, 'ethan') }
  // 普莱斯被带走时，他告的格子不算、保也不算（sheriffArrives 已经把格子作废；这里按规则再算一遍，不依赖调用顺序）
  const countFor = (w: Player) => f.marks.filter(m => m.target === w && !m.voided && !(priceTaken && m.kind === 'accused')).length
  const lawyer = (w: Player) => linePartsOf(state, w).lawyer
  const vouchOk = (w: Player) => f.vouched.includes(w) && !priceTaken
  const lineFor = (w: Player) => LINES[w] + lawyer(w) + (vouchOk(w) ? VOUCH_BONUS : 0)
  const takenOf = (w: Player) => !fled[w] && (confessed[w] || countFor(w) >= lineFor(w))
  const taken = { mandy: takenOf('mandy'), ethan: takenOf('ethan'), price: priceTaken }
  const savedBy = (w: Player) => vouchOk(w) && !taken[w] && !fled[w] && countFor(w) >= LINES[w] + lawyer(w)
  const raised = { rose: false, gideon: false, mei: false }
  const priceFor = { rose: false, gideon: false, mei: false }
  for (const h of f.handed) {
    if (h.voided) continue
    const meta = FINALE_CARDS[h.card]
    raised[meta.about] = true
    if (meta.implicates.includes('price') || meta.confessor) priceFor[meta.about] = true
  }
  const will = state.clues[WILL] && !state.clues[WILL]!.destroyed ? 'executed' : 'missing'
  return {
    taken,
    fled,
    confessed,
    savedByVouch: { mandy: savedBy('mandy'), ethan: savedBy('ethan') },
    counts: { mandy: countFor('mandy'), ethan: countFor('ethan'), price: countOf(f, 'price') },
    lines: { mandy: lineFor('mandy'), ethan: lineFor('ethan'), price: LINES.price },
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
  appendLog(state, now, 'DM', 'all', `⏰ ${CLOCKS[round - 1]} · 第 ${round} 轮：挑一份证据交给警长（也可以不交）。`, 'system')
}

function advanceAfterOrders(state: GameState, now: number) {
  const f = fs(state)
  resolveRound(state, now)
  if (f.round === DEAL_AFTER) {
    f.phase = 'deal'
    f.deal = {}
    f.deadline = now + DEAL_SECONDS * 1000
    appendLog(state, now, 'DM', 'all', `📞 ${DEAL_CLOCK} · 未知剧情：普莱斯医生分别把你们叫到了走廊尽头……（请在「终局」里回复他）`, 'system')
  } else if (f.round < ROUNDS) {
    startOrders(state, now, f.round + 1)
  } else {
    sheriffArrives(state, now)
    f.phase = 'done'
    f.outcome = computeOutcome(state)
  }
}

function goalsFor(me: Player): FinaleCopy['goals'] {
  const other: Player = me === 'mandy' ? 'ethan' : 'mandy'
  const free = { points: 20, text: '自己平安：06:00 不被警长带走。（被带走了、但普莱斯医生也被带走，得 10 分；出海得 5 分）' }
  return me === 'mandy'
    ? [
        { points: 20, text: '母亲的真相：普莱斯医生被带走，而且至少有一份关于 2000 年的证据交到了警长手里。' },
        free,
        { points: 15, text: `让灯塔上那个人付出代价：${WHO_LABEL[other]}被警长带走。` },
        { points: 15, text: '拿到他留给你的东西：保险箱里的新遗嘱被拿出来过（06:00 律师会自动宣读），而且你没有出海。' },
      ]
    : [
        { points: 20, text: '父亲的清白：普莱斯医生被带走，而且至少有一份关于 2000 年的证据交到了警长手里。' },
        free,
        { points: 15, text: `让毒死母亲的人付出代价：${WHO_LABEL[other]}被警长带走。` },
        { points: 15, text: '"弗兰克·科尔之子"拿到遗产：新遗嘱被拿出来过（06:00 律师会自动宣读），而且你没被带走、没有出海（杀了立遗嘱的人，就不能继承）。' },
      ]
}

/**
 * 终局界面上所有带剧情的文字。客户端包里不能出现任何人物关系与真相
 * （指认环节在终局之前，前端 JS 是任何人都能打开看的），所以统一由服务器下发。
 */
function finaleCopy(state: GameState, seat: Seat, f: FinaleState): FinaleCopy {
  const me = whoOfSeat(state, seat)
  const other: Player = me === 'mandy' ? 'ethan' : 'mandy'
  const o = f.outcome
  const myItems = (Object.keys(ITEMS) as ItemKind[]).filter(k => hasItem(state, seat, k))
  const itemLine = myItems.length
    ? `你拍卖得到的道具：${myItems.map(k => `${clueById.get(ITEMS[k])?.icon ?? ''}「${title(ITEMS[k])}」——${ITEM_TEXT[k]}`).join(' ')}`
    : '你在拍卖里没有拿到道具。'
  return {
    tag: 'SHERIFF',
    title: '警长的名单',
    intro: FINALE_TEXT,
    clocks: CLOCKS,
    introClock: '05:00 · 天亮之前',
    dealClock: `${DEAL_CLOCK} · 普莱斯的交易`,
    doneClock: '06:00 · 警长到了',
    rules: [
      `06:00 警长就到。名单上有三个人：曼迪、伊森、普莱斯医生，每个人下面有一排格子。格子填满了，警长就把这个人带走。曼迪和伊森各 ${LINES.mandy} 格；普莱斯医生是有身份的大人物，要 ${LINES.price} 格。`,
      '一共三轮。每一轮，你从手里挑**一份**证据交给警长，也可以不交。证据指向谁，就给谁填一格；同时指向两个人的，两个人各填一格。',
      '你们两个人同时偷偷选，都选好了才一起揭晓。',
      `自白很特别：交出你自己的自白，就是**认罪**——06:00 警长一定会带走你；但你会把一切都说出来，普莱斯医生被填 ${CONFESS_MARKS} 格。`,
      `第二轮之后，普莱斯医生会私下找你们谈交易。他可以"保"一个人（这个人要多填 ${VOUCH_BONUS} 格才会被带走），也可以"告"一个人（这个人被填 ${DEAL_MARKS} 格）。到时候会一条一条讲清楚。`,
      '06:00 警长先看普莱斯医生：他要是被带走了，他保的人就不保了，他告的格子也擦掉。然后再看你们俩。',
      itemLine,
      '只证明"发生了什么"、不指向任何人的线索，警长用不上，所以不会出现在你能交的证据里。',
    ],
    goals: goalsFor(me),
    pickHint: '点一份证据，再点「交给警长」。不想交，就点「这一轮不交」。',
    waiting: '你已经选好了，等对方……（你们可以在记录里商量）',
    noCards: '你手里已经没有能交给警长的证据了。',
    deal: {
      intro: `走廊尽头，普莱斯医生压低声音，像所有人的好外公：\n"孩子，你我都知道今晚发生了什么。只要你点头，我就在警长面前保你。至于${WHO_LABEL[other]}……我会说出我‘看到’的。"`,
      terms: [
        `**你们两个都拒绝**：普莱斯慌了，自己说漏了嘴——普莱斯医生 +${DEAL_MARKS} 格。`,
        `**你接受、${WHO_LABEL[other]}拒绝**：普莱斯保你——你要多填 ${VOUCH_BONUS} 格才会被带走；他还会告${WHO_LABEL[other]}——${WHO_LABEL[other]} +${DEAL_MARKS} 格。`,
        `**你拒绝、${WHO_LABEL[other]}接受**：普莱斯保${WHO_LABEL[other]}，告你——你 +${DEAL_MARKS} 格。`,
        `**你们两个都接受**：他把你们两个都告了——你们各 +${DEAL_MARKS} 格，谁也不保。`,
        '**记住**：普莱斯自己要是在 06:00 被带走，他保的不算，告的格子也全部擦掉。只有他说漏嘴的格子不擦——那是他自己露了馅。',
      ],
      note: `${WHO_LABEL[other]}听到的是同样的提议。你们可以先在记录里商量——但对方最后选什么，只有揭晓时才知道。`,
      accept: '接受交易',
      refuse: '拒绝交易',
    },
    legend: { me: '你交的', other: '对方交的', accused: '普莱斯告的（他被带走就擦掉）', panic: '普莱斯说漏嘴' },
    vouchedBy: '普莱斯医生保了',
    vouchShort: '普莱斯保',
    done: o
      ? `06:00 · ${o.taken.price ? '普莱斯医生被带走了。' : '普莱斯医生没有被带走。'}${o.taken.mandy ? '曼迪被带走了。' : ''}${o.taken.ethan ? '伊森被带走了。' : ''}（结局即将揭晓）`
      : null,
  }
}

function personView(state: GameState, seat: Seat, f: FinaleState, who: Who): FinalePerson {
  const avatar = who === 'price'
    ? NPCS.find(n => n.id === 'price')?.avatar ?? '🩺'
    : ROLES.find(r => r.id === ROLE_OF[who])?.avatar ?? '🙂'
  const color = who === 'price' ? '#a78bfa' : ROLES.find(r => r.id === ROLE_OF[who])?.color ?? '#ffffff'
  const marks: FinaleMark[] = f.marks.filter(m => m.target === who).map(m => ({
    kind: m.kind,
    label: m.label,
    by: m.seat === null ? 'deal' : m.seat === seat ? 'me' : 'other',
    round: m.round,
    double: m.double,
    void: m.voided,
  }))
  const pSeat = who === 'price' ? null : seatOfWho(state, who)
  const lineParts = linePartsOf(state, who)
  return {
    who,
    name: WHO_LABEL[who],
    avatar,
    color,
    isMe: who !== 'price' && pSeat === seat,
    line: lineParts.base + lineParts.lawyer + lineParts.vouch,
    lineParts,
    marks,
    count: marks.filter(m => !m.void).length,
    confessed: who !== 'price' && confessedOf(f, who),
    fled: !!pSeat && f.fled.includes(pSeat),
    taken: f.outcome ? f.outcome.taken[who] : null,
  }
}

/** 终局里不再需要的"代价"提示（那是给推理阶段看的） */
function finaleText(id: string) {
  return (clueById.get(id)?.text ?? '').replace(/\n?（代价：[^）]*）/g, '').trim()
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
        startOrders(state, now, DEAL_AFTER + 1)
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
      startOrders(state, now, DEAL_AFTER + 1)
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
      const m = FINALE_CARDS[id]
      if (m.confessor) return 3
      return m.implicates.includes('price') ? 0 : m.implicates.includes(me) ? 2 : 1
    }
    const hand: FinaleCard[] = handOf(state, seat)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map(id => {
        const m = FINALE_CARDS[id]
        return {
          id,
          title: title(id),
          icon: clueById.get(id)?.icon ?? '📄',
          about: CASE_TITLE[m.about],
          points: m.confessor ? ['price'] : m.implicates,
          confessor: m.confessor ?? null,
          why: m.why,
          text: finaleText(id),
        }
      })
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
