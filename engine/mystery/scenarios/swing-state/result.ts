// 《摇摆州》· 结局与计分（服务器端专用）
import type { GameState, ResultView } from '../../types'
import { ACCUSE, TRUTH } from './content'
import { ROLES } from './roles'
import { computeOutcome, PLAYERS } from './finale'
import type { FinaleState, Outcome, PlayerWho } from './finale'

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

type SelfFate = 'free' | 'vouched' | 'fled' | 'confessed' | 'taken_reduced' | 'taken'

function fateOf(o: Outcome, who: PlayerWho): SelfFate {
  if (o.fled[who]) return 'fled'
  if (o.taken[who] && o.confessed[who]) return 'confessed'
  if (o.taken[who]) return o.taken.price ? 'taken_reduced' : 'taken'
  return o.savedByVouch[who] ? 'vouched' : 'free'
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
    case 'confessed':
      title = o.taken.price ? '说出一切' : '一个人的认罪'
      parts.push(o.taken.price
        ? '你把一切都告诉了警长：那只小瓶、那句"你右手边"、23:27 的备餐间。普莱斯医生上了同一辆警车。检方认定你是被人利用的，你以过失致死认罪。宣判那天，你对着法官说："我想替她去死。"'
        : '你把一切都告诉了警长。普莱斯医生只是叹了口气："这孩子受了刺激。"证据不够，警长只带走了你。你以过失致死认罪——给你那瓶药的人，那天早上开着奔驰离开了庄园。')
      break
    case 'taken_reduced':
      title = '被欺骗的手'
      parts.push(o.priceFor.rose
        ? '警长把你带走了，普莱斯医生上了同一辆警车。陪审团听完了他如何骗你、如何算准了"你的右手边"。你被以过失致死起诉。宣判那天，你对着法官说："我想替她去死。"'
        : '警长把你带走了，普莱斯医生上了同一辆警车。警方搜查他的客房时，发现医疗箱里少了一瓶药——批号和你手包里那只空瓶一模一样。你被以过失致死起诉。宣判那天，你对着法官说："我想替她去死。"')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说："她只是个端盘子的孩子，我可以担保。"警长没有带走你。你走出庄园的大门，没有人拦你。可你知道，从今往后，你的命攥在那个人手里——你亲手递出去的那杯酒，他记得清清楚楚。')
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
    case 'confessed':
      title = '自首'
      parts.push(o.taken.price
        ? '你对警长说："是我推的。"你把那封匿名信、关掉的摄像头、塔上的那几分钟全都说了出来。警长顺着那封信查下去，普莱斯医生上了同一辆警车。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都替同一个人背了锅——可这一次，你没有沉默。'
        : '你对警长说："是我推的。"你把那封匿名信、关掉的摄像头、塔上的那几分钟全都说了出来。可那封信没有署名，普莱斯医生站在一旁，一句话也没说。你被以二级谋杀定罪。')
      break
    case 'taken_reduced':
      title = '受人教唆'
      parts.push(o.priceFor.gideon
        ? '警长把你带走了，普莱斯医生上了同一辆警车。匿名信、打印记录、回收站——陪审团知道了是谁把你推上了那座塔。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都替同一个人背了锅。'
        : '警长把你带走了，普莱斯医生上了同一辆警车。你被以二级谋杀定罪。宣判时你想起父亲：你们父子，都栽在了同一座庄园里。')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说："这孩子一直在塔下等着，我可以担保。"警长没有再问。你自由了——可从今往后，每一次见到那个人，你都得对他笑。')
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

function joanEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (fateOf(o, 'joan')) {
    case 'fled':
      title = '最后一班船'
      parts.push('你上了"第二次机会号"。跑了三十年社会新闻，这是你第一次从新闻现场逃走。罗丝攥着你手腕的那股力气，你到现在都还记得。')
      break
    case 'confessed':
      title = '迟到的报道'
      parts.push(o.taken.price
        ? '你把一切都告诉了警长：一点半，罗丝的床边，那句"不要他，永远不要他"。普莱斯医生上了同一辆警车。你被以见危不救、作伪证起诉。在看守所里，你用一支铅笔写完了那篇稿子。'
        : '你把一切都告诉了警长。普莱斯医生耸了耸肩："记者编故事，是职业习惯。"证据不够，警长只带走了你。')
      break
    case 'taken':
    case 'taken_reduced':
      title = '旁观者'
      parts.push('警长把你带走了。地毯上的卡扣、楼梯上那句"喝多了，睡了"——检方说，一个跑了三十年社会新闻的人，不可能看不出罗丝快死了。你没有辩解。')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说："默瑟小姐整晚都站在我旁边。"警长没有带走你。你自由了——可你知道，从今往后，你再也写不了他。')
      break
    default:
      title = o.meiReopened ? '十六年后的头版' : o.taken.price ? '今晚的头版' : '被压下的稿子'
      parts.push(o.meiReopened
        ? '你的稿子登上了《棕榈滩纪事报》的头版：《2000 年大选之夜：一位女郎之死》。署名那一栏，你写了三个名字：乔安·默瑟、林梅、罗丝·阿尔瓦雷斯。'
        : o.taken.price
          ? '你写了今晚的事，登上了头版。可十六年前的那一夜，你还是没能写完。'
          : '你的稿子被报社的律师压了下来。主编说："没有证据，只有一个记者的猜测。"')
  }
  parts.push(o.taken.price && o.priceFor.rose
    ? '罗丝没有白死。法庭上，检方念出了那句"灯都是黄的"。'
    : '罗丝的死亡证明上，写的还是"心源性猝死"。')
  if (o.meiReopened) parts.push('翻案那天，你在法院门口等到了哈洛韦警长。十六年前那份"意外坠落"的报告，就是他签的字。他从你身边走过，没有看你。')
  return { title, text: parts.join('\n\n') }
}

function prestonEnding(o: Outcome): { title: string; text: string } {
  const parts: string[] = []
  let title: string
  switch (fateOf(o, 'preston')) {
    case 'fled':
      title = '父亲的游艇'
      parts.push('你开走了父亲的"第二次机会号"。维克多的电话一直在响，你把手机扔进了海里。')
      break
    case 'confessed':
      title = '儿子的坦白'
      parts.push(o.taken.price
        ? '你对警长说：是我去试了保险箱。你把四点一刻普莱斯在走廊里对你说的话也说了出来。"哈兰叔叔"和你上了同一辆警车。'
        : '你对警长说：是我去试了保险箱。普莱斯医生叹了口气："这孩子太累了。"警长只带走了你。')
      break
    case 'taken':
    case 'taken_reduced':
      title = '万斯家的儿子'
      parts.push('警长把你带走了。保险箱面板上的 03:14、维克多的证词……检方以"企图毁灭遗嘱"起诉了你。万斯家的儿子，上了自家常读的那份报纸的社会版。')
      break
    case 'vouched':
      title = '欠下的人情'
      parts.push('普莱斯医生对警长说："普雷斯顿只是想守着他父亲。"警长没有带走你。"哈兰叔叔"拍了拍你的肩膀——你忽然觉得那只手很冷。')
      break
    default:
      title = o.meiReopened ? '父亲的秘密' : '万斯这个姓'
      parts.push('天亮了。你还是万斯家的儿子，站在父亲的庄园里。')
  }
  parts.push(o.meiReopened
    ? '2000 年的案子重新立案。"万斯"这个姓，和一桩被掩盖了十六年的命案写在了一起。'
    : '父亲十六年前替人掩盖的事，没有人再提起。万斯家的名声保住了。')
  if (o.will === 'missing') parts.push(o.fled.preston ? '新遗嘱始终没有找到。按旧遗嘱，一切本该是你的——可你已经不在这里了。' : '新遗嘱始终没有找到。按 2009 年的旧遗嘱，这座庄园和一切，都归你。维克多的律师已经在门口等着了。')
  else parts.push('律师宣读了新遗嘱："一半给我的女儿林曼，一半给弗兰克·科尔之子。"你的名字只出现在最后一行：一笔信托，够你体面地活着。')
  return { title, text: parts.join('\n\n') }
}

/** 头条必须和同页的"官方结论"一致 */
function headline(o: Outcome): string {
  const taken = o.cast.filter(w => o.taken[w]).length
  if (o.taken.price && o.meiReopened) return '《棕榈滩纪事报》头版：知名医生涉嫌 2000 年谋杀被捕，16 年前的"意外"重新立案'
  if (o.taken.price) return '《棕榈滩纪事报》头版：吉迪恩·万斯的私人医生被捕'
  if (taken > 0) return `《棕榈滩纪事报》头版：大选之夜庄园命案，${['', '一', '两', '三', '四'][taken] ?? taken}人被警方带走`
  if (o.raised.rose && o.raised.gideon) return '《棕榈滩纪事报》头版：首富坠楼、未婚妻中毒，大选之夜双尸案无人被捕'
  if (o.raised.rose) return '《棕榈滩纪事报》头版：首富大选之夜意外身亡，未婚妻同晚遭人下毒'
  if (o.raised.gideon) return '《棕榈滩纪事报》头版：首富坠楼被认定为他杀，未婚妻同晚猝死'
  return '《棕榈滩纪事报》第 14 版：棕榈滩首富大选之夜意外身亡，未婚妻同晚猝死'
}

const NAME: Record<PlayerWho, string> = { mandy: '曼迪', ethan: '伊森', joan: '乔安', preston: '普雷斯顿' }
const TA: Record<PlayerWho, string> = { mandy: '她', ethan: '他', joan: '她', preston: '他' }
const ENDING: Record<PlayerWho, (o: Outcome) => { title: string; text: string }> = {
  mandy: mandyEnding,
  ethan: ethanEnding,
  joan: joanEnding,
  preston: prestonEnding,
}

/** 每个角色除了"自身平安"以外的三项目标 */
function goalItems(o: Outcome, who: PlayerWho): { first: { label: string; got: boolean }; rest: { label: string; got: boolean }[] } {
  switch (who) {
    case 'mandy':
      return {
        first: { label: '母亲的真相（2000 年的证据交到警长手里，普莱斯医生被带走）', got: o.meiReopened },
        rest: [
          { label: '让灯塔上那个人付出代价（伊森被警长带走）', got: o.taken.ethan },
          { label: '拿到他留给你的东西（继承遗产）', got: o.mandyInherits },
        ],
      }
    case 'ethan':
      return {
        first: { label: '父亲的清白（2000 年的证据交到警长手里，普莱斯医生被带走）', got: o.meiReopened },
        rest: [
          { label: '让毒死母亲的人付出代价（曼迪被警长带走）', got: o.taken.mandy },
          { label: '"弗兰克·科尔之子"拿到遗产（遗嘱被找到，而且你没被带走、没出海）', got: o.ethanInherits },
        ],
      }
    case 'joan':
      return {
        first: { label: '写完十六年前没写完的那篇稿子（2000 年的证据交到警长手里，普莱斯医生被带走）', got: o.meiReopened },
        rest: [
          { label: '罗丝不能白死（普莱斯医生被带走，而且有关于罗丝之死、指向他的证据）', got: o.taken.price && o.priceFor.rose },
          { label: '让今晚的真相登上头版（普莱斯医生被带走）', got: o.taken.price },
        ],
      }
    case 'preston':
      return {
        first: { label: '守住万斯家的名声（2000 年的旧案没有被翻出来）', got: !o.meiReopened },
        rest: [
          { label: '让推父亲下塔的人付出代价（伊森被警长带走）', got: o.taken.ethan },
          { label: '拿回本该属于你的一切（新遗嘱没被拿出来，而且你没出海）', got: o.will === 'missing' && !o.fled.preston },
        ],
      }
  }
}

function whoOf(roleId: string | null): PlayerWho | null {
  return roleId && (PLAYERS as string[]).includes(roleId) ? (roleId as PlayerWho) : null
}

export function buildResult(state: GameState): ResultView {
  const f = state.finale as FinaleState | null
  const o: Outcome = f?.outcome ?? (f ? computeOutcome(state) : EMPTY_OUTCOME)
  const seats = state.roster.filter(s => whoOf(state.seats[s].roleId))

  const scores = seats.map(seat => {
    const who = whoOf(state.seats[seat].roleId)!
    const acc = state.seats[seat].accuse ?? {}
    const items: { label: string; points: number; got: boolean }[] = ACCUSE.map(q => ({
      label: `指认：${q.prompt}`,
      points: q.points,
      got: isCorrect(q.answer, acc[q.id]),
    }))
    const fate = fateOf(o, who)
    // 曼迪和伊森是被普莱斯骗着动的手：他也被带走，就从轻判决
    const reduced = (who === 'mandy' || who === 'ethan') && (fate === 'taken_reduced' || fate === 'confessed') && o.taken.price
    const freePoints = fate === 'free' || fate === 'vouched' ? 20 : reduced ? 10 : fate === 'fled' ? 5 : 0
    const confessTag = fate === 'confessed' ? '（认罪）' : ''
    const freeLabel = fate === 'free' ? '天亮后平安离开'
      : fate === 'vouched' ? '天亮后平安离开（普莱斯保了你）'
        : reduced ? `被警长带走${confessTag}，但普莱斯医生也被带走（从轻判决）`
          : fate === 'fled' ? '出海逃亡' : `被警长带走${confessTag}`
    const g = goalItems(o, who)
    items.push({ label: g.first.label, points: 20, got: g.first.got })
    items.push({ label: `自身：${freeLabel}`, points: freePoints > 0 ? freePoints : 20, got: freePoints > 0 })
    for (const r of g.rest) items.push({ label: r.label, points: 15, got: r.got })
    const cashPoints = Math.floor(state.seats[seat].money / 1000)
    items.push({ label: `剩余现金 $${state.seats[seat].money.toLocaleString('en-US')}（每 $1,000 计 1 分）`, points: cashPoints, got: cashPoints > 0 })
    return {
      seat,
      roleName: ROLES.find(r => r.id === who)?.name ?? NAME[who],
      total: items.reduce((n, it) => n + (it.got ? it.points : 0), 0),
      items,
    }
  })

  // 普莱斯没被带走时，要区分"有证据指向他但还不够"和"根本没人指向他"
  const pointedAtPrice = o.priceFor.rose || o.priceFor.gideon || o.priceFor.mei || o.priceFor.will
  const priceLine = o.taken.price
    ? '06:00，哈兰·普莱斯医生被戴上手铐。他上警车前回头看了一眼灯塔。'
    : pointedAtPrice
      ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园。交到警长手里的那几份指向他的证据，还差一点。他还会去打周日的高尔夫。'
      : o.counts.price > 0
        ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园。他慌过一次、说漏过嘴——可没有一份证据跟上。他还会去打周日的高尔夫。'
        : o.raised.rose || o.raised.gideon
          ? '哈兰·普莱斯医生做完笔录，开着他的奔驰离开了庄园——没有一份证据指向他。他还会去打周日的高尔夫。'
          : '哈兰·普莱斯医生签完了两份死亡证明，开着他的奔驰离开了庄园。他还会去打周日的高尔夫。'

  const fateText = (who: PlayerWho) => {
    switch (fateOf(o, who)) {
      case 'fled': return '出海逃亡'
      case 'taken': case 'taken_reduced': return '被警长带走'
      case 'confessed': return '认罪，被警长带走'
      case 'vouched': return `平安离开（普莱斯保了${TA[who]}）`
      default: return '平安离开'
    }
  }
  const summary = [
    ...o.cast.map(w => `${NAME[w]}：${fateText(w)}`),
    `普莱斯医生：${o.taken.price ? '被警长带走' : '全身而退'}`,
    `2000 年林梅之死：${o.meiReopened ? '重新立案' : '维持"意外"'}`,
    `吉迪恩的新遗嘱：${o.will === 'executed' ? '找到了，交给律师生效' : '没有找到'}`,
  ].join('；')

  return {
    headline: headline(o),
    endings: seats.map(seat => {
      const who = whoOf(state.seats[seat].roleId)!
      const e = ENDING[who](o)
      return { seat, roleName: NAME[who], title: e.title, text: `${e.text}\n\n${priceLine}` }
    }),
    scores,
    accuseReview: ACCUSE.map(q => ({
      prompt: q.prompt,
      answer: label(q.id, q.answer),
      picks: Object.fromEntries(seats.map(s => [s, label(q.id, state.seats[s].accuse?.[q.id])])),
    })),
    truth: [{ title: '天亮时的官方结论', text: summary }, ...TRUTH],
    secrets: f?.secrets ?? [],
  }
}

const NONE = { mandy: false, ethan: false, joan: false, preston: false }
const EMPTY_OUTCOME: Outcome = {
  cast: [],
  taken: { ...NONE, price: false },
  fled: { ...NONE },
  confessed: { ...NONE },
  savedByVouch: { ...NONE },
  counts: { mandy: 0, ethan: 0, joan: 0, preston: 0, price: 0 },
  lines: { mandy: 3, ethan: 3, joan: 3, preston: 3, price: 7 },
  raised: { rose: false, gideon: false, mei: false, will: false },
  priceFor: { rose: false, gideon: false, mei: false, will: false },
  meiReopened: false,
  will: 'missing',
  mandyInherits: false,
  ethanInherits: false,
  deal: null,
}
