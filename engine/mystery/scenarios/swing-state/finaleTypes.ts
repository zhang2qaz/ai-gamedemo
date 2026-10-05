// 《摇摆州》终局视图类型（客户端可安全引用：只有类型，不含剧情内容）
// 注意：界面上所有带人物/剧情的文字都在 FinaleView.copy、people、hand 里由服务器下发，前端代码里不要写死。

export type Who = 'mandy' | 'ethan' | 'price'

/** 每轮的命令：最多交出一份证据，外加道具 */
export type FinaleOrder = {
  /** 本轮交给警长的证据（null = 这一轮不交） */
  card: string | null
  /** 「头版」：这份证据算两份 */
  headline: boolean
  /** 「放大镜」：对方这一轮交出的证据作废 */
  recount: boolean
  /** 第 3 轮出海逃亡 */
  flee: boolean
}

/** 名单上的一格 */
export type FinaleMark = {
  /** 这一格是怎么来的：证据 / 交易时被告的（他被带走就擦掉）/ 交易时他自己说漏嘴 */
  kind: 'card' | 'accused' | 'panic'
  /** 文字说明，例如证据标题 */
  label: string
  /** 谁交出的：我 / 对方 / 交易时来的 */
  by: 'me' | 'other' | 'deal'
  round: number
  /** 「头版」翻倍出来的那一格 */
  double: boolean
  /** 这一格不算了（被放大镜作废，或普莱斯被带走后他说的话作废） */
  void: boolean
}

export type FinalePerson = {
  who: Who
  name: string
  avatar: string
  color: string
  isMe: boolean
  /** 满多少格会被带走（已经算上律师名片和普莱斯的"保"） */
  line: number
  /** line 的组成：基本格数 + 律师名片 + 普莱斯保他 */
  lineParts: { base: number; lawyer: number; vouch: number }
  marks: FinaleMark[]
  /** 现在算数的格数 */
  count: number
  /** 交出了自己的自白（认罪）：06:00 一定会被带走 */
  confessed: boolean
  fled: boolean
  /** 06:00 结算后才有 */
  taken: boolean | null
}

export type FinaleCard = {
  id: string
  title: string
  icon: string
  /** 这份证据说的是哪件事 */
  about: string
  /** 交出去给谁填格（自白：给普莱斯填 2 格） */
  points: Who[]
  /** 自白：交出去就是这个人认罪 */
  confessor: Who | null
  /** 为什么指向他（一句话） */
  why: string
  /** 证据正文 */
  text: string
}

export type FinaleItem = {
  kind: 'lawyer' | 'headline' | 'recount' | 'yacht'
  title: string
  icon: string
  text: string
  used: boolean
}

/** 终局界面文案（服务器下发；支持 **粗体**） */
export type FinaleCopy = {
  tag: string
  title: string
  /** 开场说明（第一屏） */
  intro: string
  /** 三轮各自的时刻 */
  clocks: string[]
  introClock: string
  dealClock: string
  doneClock: string
  /** 规则要点（一条一句） */
  rules: string[]
  /** 这一局怎么算分（只给自己看，终局时才给出准确条件） */
  goals: { points: number; text: string }[]
  pickHint: string
  waiting: string
  noCards: string
  deal: { intro: string; terms: string[]; note: string; accept: string; refuse: string }
  legend: { me: string; other: string; accused: string; panic: string }
  /** "普莱斯医生保了"（朗读用）/ "普莱斯保"（格子旁的小字） */
  vouchedBy: string
  vouchShort: string
  done: string | null
}

export type FinaleOutcome = {
  taken: Record<Who, boolean>
  fled: { mandy: boolean; ethan: boolean }
  /** 交出了自己的自白（认罪） */
  confessed: { mandy: boolean; ethan: boolean }
  /** 普莱斯的"保"最后算数，而且正是它让这个人没被带走 */
  savedByVouch: { mandy: boolean; ethan: boolean }
  counts: Record<Who, number>
  lines: Record<Who, number>
  /** 交给警长（没被作废）的证据，分别涉及哪几件事 */
  raised: { rose: boolean; gideon: boolean; mei: boolean }
  /** 其中指向普莱斯的，分别涉及哪几件事 */
  priceFor: { rose: boolean; gideon: boolean; mei: boolean }
  /** 2000 年一案翻案：普莱斯被带走，且有 2000 年的证据交到了警长手里 */
  meiReopened: boolean
  will: 'executed' | 'missing'
  mandyInherits: boolean
  ethanInherits: boolean
  deal: 'both_refuse' | 'mandy_only' | 'ethan_only' | 'both_accept' | null
}

export type FinaleReveal = { round: number; title: string; lines: string[] }

export type FinaleView = {
  phase: 'intro' | 'orders' | 'deal' | 'done'
  /** 1–3；开场说明时为 0 */
  round: number
  deadline: number | null
  people: FinalePerson[]
  hand: FinaleCard[]
  items: FinaleItem[]
  mySubmitted: boolean
  otherSubmitted: boolean
  /** 每次揭晓的经过（最新的在最后） */
  reveals: FinaleReveal[]
  deal: { myChoice: 'accept' | 'refuse' | null; result: FinaleOutcome['deal'] } | null
  outcome: FinaleOutcome | null
  copy: FinaleCopy
  /** 机器人 / 超时用的默认动作 */
  actions: { id: string; label: string; payload: unknown }[]
}
