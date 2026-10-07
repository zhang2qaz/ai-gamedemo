// 《草莓蛋糕不见了！》· 结局与算星星（服务器端专用）
import type { GameState, ResultView, Seat } from '../../types'
import { ACCUSE, TRUTH } from './content'
import { FOX, PANDA, RABBIT, ROLES, SQUIRREL } from './roles'

/** 勇气时刻：说出来得星星；所有小侦探都说出来，每人再多一颗。不说不得星（不奖励"藏起错误"） */
export const TOLD_STARS = 2
export const ALL_TOLD_BONUS = 1
/** 金色小星星 */
const STAR_ITEM = 'item_star'
const STAR_ITEM_STARS = 2
/** 每几颗橡果换 1 颗星 */
export const ACORNS_PER_STAR = 2
/** 小侦探徽章 */
function badge(total: number) {
  return total >= 16 ? '🥇 金牌小侦探' : total >= 11 ? '🥈 银牌小侦探' : '🥉 铜牌小侦探'
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

const told = (state: GameState, seat: Seat) => state.seats[seat].flags.told === true

/** 每个角色说出 / 没说出小秘密时的那一小段 */
const SECRET_ENDING: Record<string, { told: [string, string]; kept: [string, string] }> = {
  [RABBIT]: {
    told: ['勇敢的小班长', '你把中午偷看蛋糕的事告诉了大家。大家都笑了："看一眼又没关系，说出来就好啦！"盒子上的白毛，再也不让你心里扑通扑通跳了。'],
    kept: ['还没准备好的小兔子', '这次你没有说出中午回过教室的事。没关系，等你准备好了，再告诉大家也不晚。熊老师笑着说："想看蛋糕，下次就大大方方地看吧！"'],
  },
  [FOX]: {
    told: ['诚实的小狐狸', '你承认了上午偷偷尝过一口奶油。大家一点儿也没生气，还说："切蛋糕的时候，第一块奶油最多的给你！"'],
    kept: ['还没准备好的小狐狸', '这次你没有说出偷尝奶油的事。没关系，等你准备好了，再告诉大家也不晚。下次想尝一尝，先问一声就好啦！'],
  },
  [PANDA]: {
    told: ['会改错的小熊猫', '你告诉大家，生日卡上的字是你写错了又偷偷改过来的。熊老师说："写错了就改，这比一个字都不写错还了不起！"'],
    kept: ['还没准备好的小熊猫', '这次你没有说出改字的事。没关系！写错了能自己改过来，已经很了不起了。'],
  },
  [SQUIRREL]: {
    told: ['敢认错的小松鼠', '你承认自己忘了锁门。大家说："忘了一次没关系，下次我们提醒你！"从那以后，你再也没忘过锁门。'],
    kept: ['下次会记得锁门的小松鼠', '这次你没有说出忘了锁门的事。没关系，从那天起，你每天都第一个检查门有没有锁好。'],
  },
}

const ROLE_NAME = Object.fromEntries(ROLES.map(r => [r.id, r.name]))

export function buildResult(state: GameState): ResultView {
  const seats = state.roster.filter(s => state.seats[s].roleId)
  // 中途放弃的、时间到了还没选的小朋友不算在"所有人"里（不能让别人因此拿不到这颗星）
  const choosers = seats.filter(s => !state.seats[s].abandoned && !state.seats[s].flags['auto:courage'])
  const everyoneTold = choosers.length > 0 && choosers.every(s => told(state, s))
  const whoQ = ACCUSE.find(q => q.id === 'who')!

  const scores = seats.map(seat => {
    const st = state.seats[seat]
    const acc = st.accuse ?? {}
    const items: { label: string; points: number; got: boolean }[] = ACCUSE.map(q => ({
      label: `找对了：${q.prompt}`,
      points: q.points,
      got: isCorrect(q.answer, acc[q.id]),
    }))
    items.push({ label: told(state, seat) ? '勇气星：你勇敢地说出了自己的小秘密' : '勇气星：这次你没有说出小秘密（没关系，下次再说也可以）', points: TOLD_STARS, got: told(state, seat) })
    items.push({ label: '所有小侦探都说出了小秘密，每人多 1 颗', points: ALL_TOLD_BONUS, got: everyoneTold })
    const hasStar = state.clues[STAR_ITEM]?.owner === seat
    if (hasStar) items.push({ label: '金色小星星', points: STAR_ITEM_STARS, got: true })
    const fromAcorns = Math.floor(st.money / ACORNS_PER_STAR)
    items.push({ label: `剩下 ${st.money} 颗橡果（每 ${ACORNS_PER_STAR} 颗换 1 颗⭐）`, points: fromAcorns, got: fromAcorns > 0 })
    return {
      seat,
      roleName: ROLE_NAME[st.roleId!] ?? st.name ?? seat,
      total: items.reduce((n, it) => n + (it.got ? it.points : 0), 0),
      items,
    }
  })

  const cakeLine = '下午一点半，熊老师推开教室的门——"生日快乐！"大家捧出了冰得凉凉的草莓蛋糕。门口探进来一个黑眼圈的小脑袋：皮皮红着脸，手里捧着一盒新草莓。'
  const endings = seats.map(seat => {
    const st = state.seats[seat]
    const role = st.roleId!
    const e = SECRET_ENDING[role]
    const [title, secretText] = told(state, seat) ? e.told : e.kept
    const right = isCorrect(whoQ.answer, st.accuse?.[whoQ.id])
    const detective = right
      ? '你找对了拿走蛋糕的人——你是一个真正的小侦探！'
      : '这一次你没猜中拿走蛋糕的人。没关系，看看下面的"真相"，下次一定行！'
    const total = scores.find(x => x.seat === seat)?.total ?? 0
    return { seat, roleName: ROLE_NAME[role] ?? role, title, text: `${secretText}\n\n${detective}你得到了 ${total} 颗⭐：**${badge(total)}**！\n\n${cakeLine}` }
  })

  const rightCount = seats.filter(s => isCorrect(whoQ.answer, state.seats[s].accuse?.[whoQ.id])).length
  const headline = rightCount === seats.length && seats.length > 0
    ? '森林小学快报：二班的小侦探们全都猜对了！草莓蛋糕找回来啦'
    : rightCount > 0
      ? '森林小学快报：草莓蛋糕找回来啦！二班出了几位小侦探'
      : '森林小学快报：草莓蛋糕找回来啦！可是……是谁拿走的，大家都没猜中'

  const summary = [
    '拿走蛋糕的是隔壁三班的小浣熊皮皮。',
    '他不是想偷吃：教室太热，奶油都化了，他想把蛋糕放进厨房的大冰箱保护起来——可他没有先问一声，还偷吃了最大的那颗草莓。',
    everyoneTold ? '勇气时刻：所有小侦探都说出了自己的小秘密！' : '勇气时刻：有的小朋友这次还没准备好说出小秘密——没关系。',
  ].join('\n')

  const secrets = seats.map(s => `${ROLE_NAME[state.seats[s].roleId!] ?? s}在勇气时刻选择了：${told(state, s) ? '💬 说出来' : '🤐 先不说'}。`)

  return {
    headline,
    endings,
    scores,
    accuseReview: ACCUSE.map(q => ({
      prompt: q.prompt,
      answer: label(q.id, q.answer),
      picks: Object.fromEntries(seats.map(s => [s, label(q.id, state.seats[s].accuse?.[q.id])])),
    })),
    truth: [{ title: '最后发生了什么', text: summary }, ...TRUTH],
    secrets,
  }
}
