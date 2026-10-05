// 《摇摆州》· 结局与计分（服务器端专用）
import type { GameState, ResultView, Seat } from '../../types'
import { SEATS } from '../../types'
import { ACCUSE, TRUTH } from './content'
import { ETHAN, MANDY } from './roles'
import { computeOutcome } from './finale'
import type { FinaleState, Outcome } from './finale'

function isCorrect(answer: string | string[], v: string | string[] | undefined) {
  if (Array.isArray(answer)) return Array.isArray(v) && [...v].sort().join('|') === [...answer].sort().join('|')
  return v === answer
}

function label(qid: string, v: string | string[] | undefined) {
  const q = ACCUSE.find(x => x.id === qid)
  if (!q || v === undefined) return '未作答'
  const ids = Array.isArray(v) ? v : [v]
  return ids.map(id => q.options.find(o => o.id === id)?.label ?? id).join('、') || '未作答'
}

type SelfFate = 'free' | 'vouched' | 'fled' | 'taken_reduced' | 'taken'

function fateOf(o: Outcome, who: 'mandy' | 'ethan'): SelfFate {
  if (o.fled[who]) return 'fled'
  if (o.taken[who]) return o.taken.price ? 'taken_reduced' : 'taken'
  return o.vouched[who] ? 'vouched' : 'free'
}

function mandyEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (fateOf(o, 'mandy')) {
    case 'fled':
      title = '第二次机会'
      parts.push('天亮前，"第二次机会号"驶出了伊斯特湖口。你站在船尾，看着海葡萄庄园的灯塔一点一点变小。巴哈马的海是蓝的，可你每次闭上眼睛，看到的都是一片昏黄的灯光。')
      break
    case 'taken':
      title = '一级谋杀'
      parts.push('警长把你带走了。检方认定：一个化名潜入庄园的女郎，为了报复蓄意投毒。你在法庭上说那是安眠药，没有人信——给你药的那个人，那天早上开着奔驰离开了庄园。罗丝的照片被投在大屏幕上，你一直低着头。')
      break
    case 'taken_reduced':
      title = '被欺骗的手'
      parts.push(o.priceFor.rose
        ? '警长把你带走了，普莱斯医生上了同一辆警车。陪审团听完了他如何骗你、如何算准了"你的右手边"。你被以过失致死起诉。宣判那天，你对着法官说："我想替她去死。"'
        : '警长把你带走了，普莱斯医生上了同一辆警车。警方搜查他的客房时，发现医疗箱里少了一瓶药——批号和你手包里那只空瓶一模一样。你被以过失致死起诉。宣判那天，你对着法官说："我想替她去死。"')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说，你整晚都和他在一起。你走出庄园的大门，没有人拦你。可你知道，从今往后，你的命攥在那个人手里——你亲手递出去的那杯酒，他记得清清楚楚。')
      break
    default:
      title = o.raised.rose ? '无人知晓的那只手' : '心源性猝死'
      parts.push(o.raised.rose
        ? '罗丝死于毒杀，警长的笔录里写得清清楚楚——可证据还不够把你带走。只有你自己知道，那三分钟的备餐间里发生了什么。'
        : '罗丝的死亡证明上写着"心源性猝死"。葬礼上你站在第一排，没有哭。你知道真相，而真相永远不会被写下来。')
  }
  parts.push(o.meiReopened
    ? '2000 年林梅坠楼一案重新立案。十六年后，你母亲的名字终于和"意外"两个字分开了。'
    : o.taken.price
      ? '普莱斯因为今晚的事被带走了，可 2000 年那一夜，没有人向警长提起。母亲的案子依旧是"意外"。'
      : '母亲的案子依旧是"意外"。乔安的报道被律师函压了下来。')
  if (o.mandyInherits) parts.push('吉迪恩的遗嘱生效了。律师念出"我的女儿林曼"的时候，你才第一次哭出声。')
  else if (o.will === 'executed') parts.push('遗嘱生效了，但你已经不在这里，拿不到属于你的那一半。')
  else parts.push('遗嘱原件再也没有找到。普雷斯顿继承了一切。没有人知道，你是吉迪恩·万斯的女儿。')
  return { title, text: parts.join('\n\n') }
}

function ethanEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (fateOf(o, 'ethan')) {
    case 'fled':
      title = '海上的保镖'
      parts.push('你开走了"第二次机会号"。父亲当年签下认错书换来的一切，你都留在了身后。海风很大，像那天晚上的灯塔阳台。')
      break
    case 'taken':
      title = '一级谋杀'
      parts.push('警长把你带走了。门禁记录、断掉的耳麦、手腕上的抓痕……检方说这是一场蓄谋的复仇：你提前关掉了摄像头。你没有辩解。你只是一遍一遍听那条 41 秒的留言："别恨他。"')
      break
    case 'taken_reduced':
      title = '受人教唆'
      parts.push(o.priceFor.gideon
        ? '警长把你带走了，普莱斯医生上了同一辆警车。匿名信、打印记录、回收站——陪审团知道了是谁把你推上了那座塔。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都替同一个人背了锅。'
        : '警长把你带走了，普莱斯医生上了同一辆警车。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都栽在了同一座庄园里。')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说，两点以后你一直在他旁边。警长没有再问。你自由了——可从今往后，每一次见到那个人，你都得对他笑。')
      break
    default:
      title = o.raised.gideon ? '塔上的影子' : '醉酒失足'
      parts.push(o.raised.gideon
        ? '吉迪恩被认定为他杀，可证据还不够把凶手带走。你辞去了保镖的工作，每年 11 月 8 日，都会一个人去灯塔下站一会儿。'
        : '吉迪恩·万斯的死被认定为"醉酒失足"。没有人再问起那四分钟。你自由了——只是再也睡不好觉。')
  }
  parts.push(o.meiReopened
    ? '2000 年的案子重新立案，弗兰克·科尔的"失职"认错书被法庭宣布作废。你把判决书复印件放在了父亲的墓前。'
    : o.taken.price
      ? '普莱斯被带走了，可没有人向警长提起 2000 年。父亲的认错书依旧锁在庄园的档案柜里。'
      : '父亲的认错书依旧锁在庄园的档案柜里。弗兰克·科尔，仍然是那个"没锁塔门"的人。')
  if (o.ethanInherits) parts.push('吉迪恩把一半遗产留给了"弗兰克·科尔之子"。你拿着那份文件，想起他在塔上说的最后一句话："伊森，听我说——"')
  else if (o.will === 'executed') parts.push(o.fled.ethan ? '遗嘱里属于你的那一半，你再也拿不到了。' : '律师念出了"弗兰克·科尔之子"。可依照佛州"杀人者不得继承"的规定，你失去了遗嘱里属于你的那一半。')
  else parts.push('遗嘱原件不见了。你永远不会知道，他想还给你什么。')
  return { title, text: parts.join('\n\n') }
}

/** 头条必须和同页的"官方结论"一致 */
function headline(o: Outcome): string {
  const taken = (['mandy', 'ethan'] as const).filter(w => o.taken[w]).length
  if (o.taken.price && o.meiReopened) return '《棕榈滩纪事报》头版：知名医生涉嫌 2000 年谋杀被捕，16 年前的"意外"重新立案'
  if (o.taken.price) return '《棕榈滩纪事报》头版：吉迪恩·万斯的私人医生被捕'
  if (taken > 0) return `《棕榈滩纪事报》头版：大选之夜庄园命案，${taken === 2 ? '两人' : '一人'}被警方带走`
  if (o.raised.rose && o.raised.gideon) return '《棕榈滩纪事报》头版：首富坠楼、未婚妻中毒，大选之夜双尸案无人被捕'
  if (o.raised.rose) return '《棕榈滩纪事报》头版：首富大选之夜意外身亡，未婚妻同晚遭人下毒'
  if (o.raised.gideon) return '《棕榈滩纪事报》头版：首富坠楼被认定为他杀，未婚妻同晚猝死'
  return '《棕榈滩纪事报》第 14 版：棕榈滩首富大选之夜意外身亡，未婚妻同晚猝死'
}

function seatOfRole(state: GameState, roleId: string): Seat {
  return SEATS.find(s => state.seats[s].roleId === roleId) ?? 'P1'
}

export function buildResult(state: GameState): ResultView {
  const f = state.finale as FinaleState | null
  const o: Outcome = f?.outcome ?? (f ? computeOutcome(state) : EMPTY_OUTCOME)
  const ms = seatOfRole(state, MANDY)
  const es = seatOfRole(state, ETHAN)

  const scores = SEATS.map(seat => {
    const isMandy = seat === ms
    const acc = state.seats[seat].accuse ?? {}
    const items: { label: string; points: number; got: boolean }[] = ACCUSE.map(q => ({
      label: `指认：${q.prompt}`,
      points: q.points,
      got: isCorrect(q.answer, acc[q.id]),
    }))
    const fate = fateOf(o, isMandy ? 'mandy' : 'ethan')
    const freePoints = fate === 'free' || fate === 'vouched' ? 20 : fate === 'taken_reduced' ? 10 : fate === 'fled' ? 5 : 0
    const freeLabel = fate === 'free' ? '天亮后平安离开'
      : fate === 'vouched' ? '天亮后平安离开（普莱斯替你作证）'
        : fate === 'taken_reduced' ? '被警长带走，但普莱斯医生也被带走（从轻判决）'
          : fate === 'fled' ? '出海逃亡' : '被警长带走'
    items.push({ label: isMandy ? '母亲的真相（2000 年的证据交到警长手里，普莱斯医生被带走）' : '父亲的清白（2000 年的证据交到警长手里，普莱斯医生被带走）', points: 20, got: o.meiReopened })
    items.push({ label: `自身：${freeLabel}`, points: freePoints > 0 ? freePoints : 20, got: freePoints > 0 })
    if (isMandy) {
      items.push({ label: '让灯塔上那个人付出代价（伊森被带走，或普莱斯医生因吉迪恩之死的证据被带走）', points: 15, got: o.taken.ethan || (o.taken.price && o.priceFor.gideon) })
      items.push({ label: '拿到他留给你的东西（继承遗产）', points: 15, got: o.mandyInherits })
    } else {
      items.push({ label: '让毒死母亲的人付出代价（曼迪被带走，或普莱斯医生因罗丝之死的证据被带走）', points: 15, got: o.taken.mandy || (o.taken.price && o.priceFor.rose) })
      items.push({ label: '"弗兰克·科尔之子"的名字被宣读（遗嘱被找到）', points: 15, got: o.will === 'executed' })
    }
    const cashPoints = Math.floor(state.seats[seat].money / 1000)
    items.push({ label: `剩余现金 $${state.seats[seat].money.toLocaleString('en-US')}（每 $1,000 计 1 分）`, points: cashPoints, got: cashPoints > 0 })
    return {
      seat,
      roleName: isMandy ? '曼迪' : '伊森',
      total: items.reduce((n, it) => n + (it.got ? it.points : 0), 0),
      items,
    }
  })

  const m = mandyEnding(o)
  const e = ethanEnding(o)
  // 普莱斯没被带走时，要区分"有证据指向他但还不够"和"根本没人指向他"
  const pointedAtPrice = o.priceFor.rose || o.priceFor.gideon || o.priceFor.mei
  const priceLine = o.taken.price
    ? '哈兰·普莱斯医生在 06:40 被戴上手铐。他上警车前回头看了一眼灯塔。'
    : pointedAtPrice
      ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园。交到警长手里的那几份指向他的证据，还差一点。他还会去打周日的高尔夫。'
      : o.counts.price > 0
        ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园。他慌过一次、说漏过嘴——可没有一份证据跟上。他还会去打周日的高尔夫。'
        : o.raised.rose || o.raised.gideon
          ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园——没有一份证据指向他。他还会去打周日的高尔夫。'
          : '哈兰·普莱斯医生签完了两份死亡证明，开着他的奔驰离开了庄园。他还会去打周日的高尔夫。'

  const fateText = (who: 'mandy' | 'ethan') => {
    switch (fateOf(o, who)) {
      case 'fled': return '出海逃亡'
      case 'taken': case 'taken_reduced': return '被警长带走'
      case 'vouched': return '平安离开（普莱斯替' + (who === 'mandy' ? '她' : '他') + '作证）'
      default: return '平安离开'
    }
  }
  const summary = [
    `曼迪：${fateText('mandy')}`,
    `伊森：${fateText('ethan')}`,
    `普莱斯医生：${o.taken.price ? '被警长带走' : '全身而退'}`,
    `2000 年林梅之死：${o.meiReopened ? '重新立案' : '维持"意外"'}`,
    `吉迪恩的新遗嘱：${o.will === 'executed' ? '找到了，交给律师生效' : '没有找到'}`,
  ].join('；')

  return {
    headline: headline(o),
    endings: [
      { seat: ms, roleName: '曼迪', title: m.title, text: `${m.text}\n\n${priceLine}` },
      { seat: es, roleName: '伊森', title: e.title, text: `${e.text}\n\n${priceLine}` },
    ],
    scores,
    accuseReview: ACCUSE.map(q => ({
      prompt: q.prompt,
      answer: label(q.id, q.answer),
      picks: Object.fromEntries(SEATS.map(s => [s, label(q.id, state.seats[s].accuse?.[q.id])])),
    })),
    truth: [{ title: '天亮时的官方结论', text: summary }, ...TRUTH],
    secrets: f?.secrets ?? [],
  }
}

const EMPTY_OUTCOME: Outcome = {
  taken: { mandy: false, ethan: false, price: false },
  fled: { mandy: false, ethan: false },
  vouched: { mandy: false, ethan: false },
  counts: { mandy: 0, ethan: 0, price: 0 },
  lines: { mandy: 3, ethan: 3, price: 5 },
  raised: { rose: false, gideon: false, mei: false },
  priceFor: { rose: false, gideon: false, mei: false },
  meiReopened: false,
  will: 'missing',
  mandyInherits: false,
  ethanInherits: false,
  deal: null,
}
