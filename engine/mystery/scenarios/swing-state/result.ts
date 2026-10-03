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

function mandyEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (o.mandy) {
    case 'fled':
      title = '第二次机会'
      parts.push('天亮前，"第二次机会号"驶出了伊斯特湖口。你站在船尾，看着海葡萄庄园的灯塔一点一点变小。巴哈马的海是蓝的，可你每次闭上眼睛，看到的都是一片昏黄的灯光。')
      break
    case 'full':
      title = '一级谋杀'
      parts.push('检方认定：一个化名潜入庄园的女郎，为了报复蓄意投毒。你在法庭上说那是安眠药，没有人信。罗丝的照片被投在大屏幕上，你一直低着头。')
      break
    case 'reduced':
      title = '被欺骗的手'
      parts.push(!o.exposed.R1.includes('price') ? '检方本想以一级谋杀起诉你，凯斯勒律师在法庭上替你争到了"过失致死"。' : '你被以过失致死起诉。')
      parts.push('陪审团听完了普莱斯如何骗你、如何算准了"你的右手边"。宣判那天，你对着法官说："我想替她去死。"')
      break
    default:
      title = o.prevails.R1 ? '无人知晓的那只手' : '心源性猝死'
      parts.push(o.prevails.R1
        ? '罗丝死于毒杀，案卷里写得清清楚楚——可没有人追究到你。只有你自己知道，那三分钟的备餐间里发生了什么。'
        : '罗丝的死亡证明上写着"心源性猝死"。葬礼上你站在第一排，没有哭。你知道真相，而真相永远不会被写下来。')
  }
  parts.push(o.prevails.R3
    ? '2000 年林梅坠楼一案重新立案。十六年后，你母亲的名字终于和"意外"两个字分开了。'
    : '母亲的案子依旧是"意外"。乔安的报道被律师函压了下来。')
  if (o.mandyInherits) parts.push('吉迪恩的遗嘱生效了。律师念出"我的女儿林曼"的时候，你才第一次哭出声。')
  else if (o.will === 'executed') parts.push('遗嘱生效了，但你已经不在这里，拿不到属于你的那一半。')
  else parts.push('遗嘱原件再也没有找到。普雷斯顿继承了一切。没有人知道，你是吉迪恩·万斯的女儿。')
  return { title, text: parts.join('\n\n') }
}

function ethanEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (o.ethan) {
    case 'fled':
      title = '海上的保镖'
      parts.push('你开走了"第二次机会号"。父亲当年签下认错书换来的一切，你都留在了身后。海风很大，像那天晚上的灯塔阳台。')
      break
    case 'full':
      title = '一级谋杀'
      parts.push('门禁记录、断掉的耳麦、手腕上的抓痕……检方说这是一场蓄谋的复仇：你提前关掉了摄像头。你没有辩解。你只是一遍一遍听那条 41 秒的留言："别恨他。"')
      break
    case 'reduced':
      title = o.exposed.R2.includes('price') ? '受人教唆' : '律师的辩护'
      parts.push(o.exposed.R2.includes('price')
        ? '匿名信、打印记录、回收站——陪审团知道了是谁把你推上了那座塔。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都替同一个人背了锅。'
        : '检方要以一级谋杀起诉你。凯斯勒律师把"激情杀人"讲了整整两天，最后你被以二级谋杀定罪。')
      break
    default:
      title = o.prevails.R2 ? '塔上的影子' : '醉酒失足'
      parts.push(o.prevails.R2
        ? '吉迪恩被认定为他杀，可凶手始终没有找到。你辞去了保镖的工作，每年 11 月 8 日，都会一个人去灯塔下站一会儿。'
        : '吉迪恩·万斯的死被认定为"醉酒失足"。没有人再问起那四分钟。你自由了——只是再也睡不好觉。')
  }
  parts.push(o.prevails.R3
    ? '2000 年的案子重新立案，弗兰克·科尔的"失职"认错书被法庭宣布作废。你把判决书复印件放在了父亲的墓前。'
    : '父亲的认错书依旧锁在庄园的档案柜里。弗兰克·科尔，仍然是那个"没锁塔门"的人。')
  if (o.ethanInherits) parts.push('吉迪恩把一半遗产留给了"弗兰克·科尔之子"。你拿着那份文件，想起他在塔上说的最后一句话："伊森，听我说——"')
  else if (o.will === 'executed') parts.push(o.ethan === 'fled' ? '遗嘱里属于你的那一半，你再也拿不到了。' : '依照佛州"杀人者不得继承"的规定，你失去了遗嘱里属于你的那一半。')
  else parts.push('遗嘱原件不见了。你永远不会知道，他想还给你什么。')
  return { title, text: parts.join('\n\n') }
}

function headline(o: Outcome): string {
  if (o.priceArrested && o.prevails.R3) return '《棕榈滩纪事报》头版：知名医生涉嫌 2000 年谋杀，庄园双尸案真相大白'
  if (o.priceArrested) return '《棕榈滩纪事报》头版：吉迪恩·万斯的私人医生被捕'
  if (o.mandy === 'full' || o.ethan === 'full') return '《棕榈滩纪事报》头版：大选之夜庄园命案，员工被控谋杀'
  return '《棕榈滩纪事报》第 14 版：棕榈滩首富大选之夜意外身亡，未婚妻同晚猝死'
}

function seatOfRole(state: GameState, roleId: string): Seat {
  return SEATS.find(s => state.seats[s].roleId === roleId) ?? 'P1'
}

export function buildResult(state: GameState): ResultView {
  const f = state.finale as FinaleState | null
  const o: Outcome = f?.outcome ?? (f ? computeOutcome(state) : {
    prevails: { R1: false, R2: false, R3: false }, exposed: { R1: [], R2: [], R3: [] }, mandy: 'none', ethan: 'none',
    priceArrested: false, will: 'missing', mandyInherits: false, ethanInherits: false, lawyerUsedBy: null,
  })
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
    const charge = isMandy ? o.mandy : o.ethan
    const freePoints = charge === 'none' ? 20 : charge === 'reduced' ? 10 : charge === 'fled' ? 5 : 0
    const freeLabel = charge === 'none' ? '天亮后不被起诉'
      : charge === 'reduced' ? (isMandy ? '只以过失致死被起诉' : '只以二级谋杀被起诉')
        : charge === 'fled' ? '出海逃亡' : '被以一级谋杀起诉'
    items.push({ label: isMandy ? '母亲的真相（2000 年一案真相成立）' : '父亲的清白（2000 年一案真相成立）', points: 20, got: o.prevails.R3 })
    items.push({ label: `自身：${freeLabel}`, points: freePoints > 0 ? freePoints : 20, got: freePoints > 0 })
    if (isMandy) {
      const tower = o.prevails.R2 && (o.ethan === 'full' || o.ethan === 'reduced' || (o.exposed.R2.includes('price') && o.priceArrested))
      items.push({ label: '让灯塔上那个人付出代价', points: 15, got: tower })
      items.push({ label: '拿到他留给你的东西（继承遗产）', points: 15, got: o.mandyInherits })
    } else {
      const rose = o.prevails.R1 && (o.mandy === 'full' || o.mandy === 'reduced' || (o.exposed.R1.includes('price') && o.priceArrested))
      items.push({ label: '让毒死母亲的人付出代价', points: 15, got: rose })
      items.push({ label: '"弗兰克·科尔之子"的名字被宣读（遗嘱生效）', points: 15, got: o.will === 'executed' })
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
  const priceLine = o.priceArrested
    ? '哈兰·普莱斯医生在 06:40 被戴上手铐。他上警车前回头看了一眼灯塔。'
    : '哈兰·普莱斯医生签完了两份死亡证明，开着他的奔驰离开了庄园。他还会去打周日的高尔夫。'

  const raceLine = (ok: boolean, yes: string, no: string) => (ok ? yes : no)
  const summary = [
    raceLine(o.prevails.R1, '罗丝之死：认定为毒杀', '罗丝之死：按"心源性猝死"结案'),
    raceLine(o.prevails.R2, '吉迪恩之死：认定为他杀', '吉迪恩之死：按"醉酒失足"结案'),
    raceLine(o.prevails.R3, '2000 年林梅之死：重新立案', '2000 年林梅之死：维持"意外"'),
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
