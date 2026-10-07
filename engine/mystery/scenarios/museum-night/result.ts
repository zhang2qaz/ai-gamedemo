// 《恐龙蛋失踪之夜》· 结局与算分（服务器端专用）
import type { GameState, ResultView, Seat } from '../../types'
import { ACCUSE, TRUTH } from './content'
import { CULPRIT, DAZHUANG, DUODUO, ROLES, XIAOMI } from './roles'
import { SECRET_OF } from './clues'

/** 侦探：至少一半的侦探投中，每个侦探都加这么多 */
export const TEAM_BONUS = 2
/** 侦探：到最后都没公开秘密 */
export const SECRET_KEPT = 2
/** 守着秘密的侦探：每有一个人投票说是你拿的，扣这么多 */
export const SUSPECT_PENALTY = 1
/** 隐藏者：侦探全都投错某一题时得的分（几个侦探就按投错的比例算） */
export const CULPRIT_POINTS = { who: 6, where: 3, why: 2 } as const
/** 每几个金币换 1 分 */
export const COINS_PER_POINT = 4
const BADGE_ITEM = 'item_badge'
const BADGE_POINTS = 2

function detectiveBadge(total: number) {
  return total >= 13 ? '🥇 金牌侦探' : total >= 8 ? '🥈 银牌侦探' : '🥉 铜牌侦探'
}

function isCorrect(answer: string | string[], v: string | string[] | undefined) {
  if (Array.isArray(answer)) return Array.isArray(v) && [...v].sort().join('|') === [...answer].sort().join('|')
  return v === answer
}

function label(qid: string, v: string | string[] | undefined) {
  const q = ACCUSE.find(x => x.id === qid)
  if (!q || v === undefined) return '没有回答'
  const ids = Array.isArray(v) ? v : [v]
  return ids.map(id => q.options.find(o => o.id === id)?.label ?? id).join('、') || '没有回答'
}

const ROLE_NAME = Object.fromEntries(ROLES.map(r => [r.id, r.name]))
const Q = (id: string) => ACCUSE.find(q => q.id === id)!

/** 秘密卡有没有被别人看到（选了"公开"、自己点了公开、交给了别人都算） */
function secretRevealed(state: GameState, seat: Seat): boolean {
  const st = state.seats[seat]
  if (st.flags.told === true) return true
  const c = state.clues[SECRET_OF[st.roleId ?? ''] ?? '']
  return !!c && (c.public || c.seenBy.some(s => s !== seat))
}

const SECRET_ENDING: Record<string, { told: [string, string]; kept: [string, string] }> = {
  [XIAOMI]: {
    told: ['敢说实话的恐龙迷', '你承认自己摸过恐龙蛋。许姐姐叹了口气，又笑了："下次想摸，先跟我说——我教你戴上手套摸。"'],
    kept: ['守着秘密的恐龙迷', '你没有说出摸过恐龙蛋的事。指尖那一下凉凉、糙糙的感觉，成了只有你自己知道的秘密。'],
  },
  [DAZHUANG]: {
    told: ['泡面英雄', '你承认停电是你弄的。馆长罚你第二天帮刘阿姨打扫恐龙大厅——不过他也尝了一口你的泡面。'],
    kept: ['嘴巴最紧的大个子', '停电的事，你一个字都没说。可赵叔叔全记着呢：第二天，你还是被罚去帮刘阿姨打扫恐龙大厅。'],
  },
  [DUODUO]: {
    told: ['唯一的目击者', '你说出了在二楼看见的蓝光。馆长没有怪你违反营规，还把你那张 22:28 的霸王龙速写，挂在了博物馆的大门口。'],
    kept: ['把秘密画进本子的人', '你没有说出二楼的事。那个在黑暗里移动的蓝色光点，被你画在了速写本的最后一页。'],
  },
}

export function buildResult(state: GameState): ResultView {
  const seats = state.roster.filter(s => state.seats[s].roleId)
  const roleOf = (s: Seat) => state.seats[s].roleId!
  // 中途放弃的侦探不算在"侦探们"里
  const detectives = seats.filter(s => roleOf(s) !== CULPRIT && !state.seats[s].abandoned)
  const acc = (s: Seat) => state.seats[s].accuse ?? {}
  const rightOn = (qid: string) => detectives.filter(s => isCorrect(Q(qid).answer, acc(s)[qid])).length
  const hits = rightOn('who')
  const caught = detectives.length > 0 && hits * 2 >= detectives.length
  /** 投给某个角色的票：侦探的"是谁"＋隐藏者的那一票 */
  const votesFor = (roleId: string) => seats.filter(s => {
    if (roleOf(s) === roleId) return false
    return roleOf(s) === CULPRIT ? acc(s).frame === roleId : acc(s).who === roleId
  }).length

  const coinItems = (seat: Seat) => {
    const st = state.seats[seat]
    const items: { label: string; points: number; got: boolean }[] = []
    if (state.clues[BADGE_ITEM]?.owner === seat) items.push({ label: '小小讲解员徽章', points: BADGE_POINTS, got: true })
    const fromCoins = Math.floor(st.money / COINS_PER_POINT)
    items.push({ label: `剩下 ${st.money} 个金币（每 ${COINS_PER_POINT} 个换 1 分）`, points: fromCoins, got: fromCoins > 0 })
    return items
  }

  const scores = seats.map(seat => {
    const role = roleOf(seat)
    let items: { label: string; points: number; got: boolean }[]
    if (role === CULPRIT) {
      const n = detectives.length
      const part = (qid: 'who' | 'where' | 'why', name: string) => {
        const wrong = n - rightOn(qid)
        const pts = n === 0 ? CULPRIT_POINTS[qid] : Math.round(CULPRIT_POINTS[qid] * wrong / n)
        return { label: `${name}：${n} 个侦探里，${wrong} 个投错了`, points: pts, got: pts > 0 }
      }
      items = [part('who', '别被认出来'), part('where', '护住恐龙蛋'), part('why', '藏好原因'), ...coinItems(seat)]
    } else {
      const a = acc(seat)
      items = ACCUSE.filter(q => q.notRole === CULPRIT).map(q => ({ label: `投对了：${q.prompt}`, points: q.points, got: isCorrect(q.answer, a[q.id]) }))
      items.push({ label: '团队奖：至少一半的侦探投中了拿蛋的人', points: TEAM_BONUS, got: caught })
      const kept = !secretRevealed(state, seat)
      items.push({ label: kept ? '守住秘密：你的秘密到最后都没公开' : '守住秘密：你的秘密公开了', points: SECRET_KEPT, got: kept })
      const v = votesFor(role)
      if (kept && v > 0) items.push({ label: `守着秘密被怀疑：有 ${v} 个人投票说是你拿的`, points: -SUSPECT_PENALTY * v, got: true })
      items.push(...coinItems(seat))
    }
    return {
      seat,
      roleName: ROLE_NAME[role] ?? state.seats[seat].name ?? seat,
      // 扣分最多扣到 0 分
      total: Math.max(0, items.reduce((n, it) => n + (it.got ? it.points : 0), 0)),
      items,
    }
  })
  const totalOf = (seat: Seat) => scores.find(x => x.seat === seat)?.total ?? 0

  const closing = caught
    ? '一鸣说出了一切。天亮以前，恐龙蛋回到了展柜里——这一次，锁是按好的。早上 8 点，电视台的镜头对准了它。'
    : '天快亮的时候，一鸣"碰巧"在蛋筐里发现了恐龙蛋，大家都欢呼起来——只有一鸣自己知道是怎么回事。'
  const endings = seats.map(seat => {
    const role = roleOf(seat)
    if (role === CULPRIT) {
      const nobody = hits === 0
      return caught
        ? { seat, roleName: ROLE_NAME[role], title: '被识破的护蛋人', text: `侦探们把证据一条条摆了出来：湿沙坑里的闪电鞋印、黑暗里的蓝色手环……你低下头，说出了 21:30 听到的那个电话。\n\n许姐姐愣了一下，然后笑了："换成复制品，是为了让来参观的孩子们能摸——真蛋要送进恒温库房保护起来呀！"原来，是一场大误会。\n\n馆长没有批评你，只说了一句："下次听到奇怪的事，先问一问。"第二天的电视上，你捧着复制品讲了一遍恐龙蛋的故事，讲得比谁都好。\n\n你得了 ${totalOf(seat)} 分。` }
        : { seat, roleName: ROLE_NAME[role], title: '没被认出来的护蛋人', text: `${nobody ? '没有一个侦探投中你。' : '大多数侦探都没投中你。'}天快亮的时候，你"碰巧"在蛋筐里发现了真蛋，大家都欢呼起来。\n\n8:00 记者一到，你冲过去大声说："他们要把真蛋换掉！"全场安静了三秒。许姐姐红着脸解释：换成复制品，是为了让来参观的孩子们能摸，真蛋要送进恒温库房保护起来。原来，是你只听到了一半。\n\n这段直播上了新闻。全市的小学生都知道了：有个班长，为了保护恐龙蛋，一个人干了一件大事——只是，干错了。\n\n你得了 ${totalOf(seat)} 分。` }
    }
    const e = SECRET_ENDING[role]
    const [title, secretText] = secretRevealed(state, seat) ? e.told : e.kept
    const right = isCorrect(Q('who').answer, acc(seat).who)
    const detective = right ? '你投中了拿走恐龙蛋的人。' : '这一次你没投中拿走恐龙蛋的人。去看看"真相复盘"，找找是哪条线索漏掉了。'
    const total = totalOf(seat)
    return { seat, roleName: ROLE_NAME[role], title, text: `${secretText}\n\n${detective}你得了 ${total} 分：**${detectiveBadge(total)}**！\n\n${closing}` }
  })

  const headline = caught
    ? '博物馆快报：恐龙蛋找回来了！隐藏者被侦探们识破'
    : '博物馆快报：恐龙蛋找回来了——可是隐藏者躲过了投票'

  const summary = [
    '拿走恐龙蛋的是**一鸣**。',
    '停电的十分钟里，他把蛋从展柜里抱出来，藏进了互动区"摸一摸恐龙蛋"的筐里。',
    '他不是想偷：21:30 他偷听到许姐姐打电话，说要把真蛋"换成复制品""送走"，以为有人要偷蛋，想先把蛋藏起来保护好。其实，那是为了明天的拍摄保护真蛋。',
    detectives.length > 0 ? `投票结果：${detectives.length} 个侦探里，有 ${hits} 个投中了一鸣。` : '',
  ].filter(Boolean).join('\n')

  const secrets = seats.map(s => {
    const name = ROLE_NAME[roleOf(s)] ?? s
    if (roleOf(s) === CULPRIT) {
      const framed = acc(s).frame
      return `${name}（隐藏者）在秘密时刻${state.seats[s].flags.told === true ? '公开了一张假的秘密卡' : '什么都没公开'}；最后把票投给了：${framed ? label('frame', framed) : '没有投'}。`
    }
    return `${name}在秘密时刻选择了：${state.seats[s].flags.told === true ? '📢 公开秘密卡' : '🤐 不公开'}。`
  })

  return {
    headline,
    endings,
    scores,
    accuseReview: ACCUSE.filter(q => q.notRole === CULPRIT).map(q => ({
      prompt: q.prompt,
      answer: label(q.id, q.answer),
      picks: Object.fromEntries(seats.map(s => [s, roleOf(s) === CULPRIT
        ? (q.id === 'who' ? `（隐藏者）投给了 ${label('frame', acc(s).frame)}` : '（隐藏者不答）')
        : label(q.id, acc(s)[q.id])])),
    })),
    truth: [{ title: '最后发生了什么', text: summary }, ...TRUTH],
    secrets,
  }
}
