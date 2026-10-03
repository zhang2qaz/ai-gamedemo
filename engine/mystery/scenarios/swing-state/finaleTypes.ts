// 《摇摆州》终局视图类型（客户端可安全引用：只有类型，不含剧情内容）
// 注意：界面上所有带人物/剧情的文字都在 FinaleView.copy 里由服务器下发，前端代码里不要写死。

export type RaceId = 'R1' | 'R2' | 'R3'

export type FinaleOrder = {
  /** 本轮递交的证据（最多 2 张，不含遗嘱） */
  cast: string[]
  /** 本轮销毁的证据（最多 1 张） */
  burn: string | null
  /** 遗嘱原件：交给律师 / 烧掉（不占递交名额） */
  will: 'submit' | 'burn' | null
  /** 舆论：给某一案的「真相」或「对方说法」+1 */
  pr: { race: RaceId; side: 'truth' | 'claim' } | null
  /** 「头版」作用的那张递交卡 */
  headline: string | null
  /** 布置「重新计票」：作废对方本轮递交的最强一张 */
  recount: boolean
  /** 第 3 轮出海逃亡 */
  flee: boolean
}

export type FinaleOutcome = {
  prevails: Record<RaceId, boolean>
  exposed: Record<RaceId, ('mandy' | 'ethan' | 'price')[]>
  mandy: 'none' | 'reduced' | 'full' | 'fled'
  ethan: 'none' | 'reduced' | 'full' | 'fled'
  priceArrested: boolean
  will: 'executed' | 'burned' | 'missing'
  mandyInherits: boolean
  ethanInherits: boolean
  lawyerUsedBy: 'P1' | 'P2' | null
}

export type FinaleCast = { id: string; title: string; race: RaceId; weight: number; round: number; voided: boolean; found: boolean }

/** 终局界面文案（服务器下发；支持 **粗体**） */
export type FinaleCopy = {
  tag: string
  title: string
  /** 三轮各自的时刻 */
  clocks: string[]
  dealClock: string
  doneClock: string
  truthLabel: string
  /** 每场计票里与「真相」对垒的一方 */
  claimLabel: string
  claimTextLabel: string
  handHint: string
  searchableTag: string
  waiting: string
  immune: string
  will: { title: string; hint: string; keep: string; submit: string; burn: string; submitted: string; burned: string }
  items: { lawyer: string; headline: string; recount: string; yacht: string }
  deal: { intro: string; terms: string[]; note: string }
  historyLabels: { deal: string; sheriff: string }
  done: string | null
  rules: string[]
}

export type FinaleView = {
  round: number
  phase: 'orders' | 'deal' | 'done'
  deadline: number | null
  /** truth / claim：两边的票数；claimText：对方的说法 */
  races: { id: RaceId; title: string; truth: number; claim: number; claimText: string }[]
  hand: { id: string; title: string; icon: string; race: RaceId; weight: number; implicates: string[]; searchable: boolean }[]
  holdsWill: boolean
  items: { id: string; title: string; icon: string; used: boolean }[]
  money: number
  prCost: number
  maxCast: number
  mySubmitted: boolean
  otherSubmitted: boolean
  myCast: FinaleCast[]
  otherCast: FinaleCast[]
  history: { round: number; lines: string[] }[]
  deal: { myRaceTitle: string; otherRaceTitle: string; myChoice: 'accept' | 'refuse' | null; result: string | null } | null
  immune: boolean
  fled: boolean
  outcome: FinaleOutcome | null
  copy: FinaleCopy
  actions: { id: string; label: string; payload: unknown }[]
}
