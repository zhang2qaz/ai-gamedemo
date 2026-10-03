// =====================
// 剧本杀引擎 - 类型定义
// 内容（剧本数据）与运行时状态分离；服务器上的引擎就是 DM。
// =====================

export const SEATS = ['P1', 'P2'] as const
export type Seat = typeof SEATS[number]

export function otherSeat(seat: Seat): Seat {
  return seat === 'P1' ? 'P2' : 'P1'
}

// ───────────────────────── 内容 Schema ─────────────────────────

/** 条件表达式：用于解锁问题、线索、剧本章节、目标判定 */
export type Cond =
  | { hasClue: string }                 // 我持有（或已公开/对我可见）该线索
  | { owns: string }                    // 我亲手持有（不含公开）
  | { flag: string; eq?: FlagValue }    // 全局旗标
  | { seatFlag: string; eq?: FlagValue } // 我的个人旗标
  | { role: string }                    // 我的角色
  | { reached: string }                 // 流程已到达（或越过）某步骤
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }

export type FlagValue = string | number | boolean

export type Effect =
  | { giveClue: string; to?: 'self' | 'other' | 'both' }
  | { setFlag: string; value: FlagValue }
  | { setSeatFlag: string; value: FlagValue; to?: 'self' | 'other' }
  | { money: number; to?: 'self' | 'other' }
  | { dm: string; to?: 'self' | 'other' | 'both' }   // DM 私信/广播

export type ClueKind = 'document' | 'digital' | 'physical' | 'testimony' | 'media' | 'item'

export type ClueDef = {
  id: string
  title: string
  icon: string
  kind: ClueKind
  text: string
  /** 搜证点（出现在搜证菜单中）；无 location 的线索只能由问询/事件/效果获得 */
  location?: string
  /** 搜证菜单里展示的“搜哪里”（不剧透内容），如“书桌抽屉” */
  spot?: string
  /** 行动点花费 */
  cost?: number
  /** 从哪个流程步骤开始可搜到 */
  from?: string
  /** 解锁条件（如需先找到上一层线索） */
  requires?: Cond
  /** 只有某角色能取得（例如只有他知道密码） */
  onlyRole?: string
  /** 被发现时自动公开给双方 */
  autoPublic?: boolean
  /** 可被伪造时的伪造版本文本（青楼式篡改） */
  forgedText?: string
  /** 标签：用于自动化一致性检查（如 time:23:41、place:library） */
  tags?: string[]
}

export type QuestionDef = {
  id: string
  /** 玩家看到的问题 */
  ask: string
  /** NPC 的回答 */
  answer: string
  /** 需要出示的证据（线索 id）。出示错证据不会触发。 */
  present?: string
  requires?: Cond
  from?: string
  cost?: number
  /** 获得的线索（证词卡等） */
  grants?: string[]
  effects?: Effect[]
  onlyRole?: string
}

export type NpcDef = {
  id: string
  name: string
  title: string
  avatar: string
  profile: string
  questions: QuestionDef[]
  /** NPC 可被问询的步骤（不填则所有搜证步骤都可） */
  from?: string
}

export type LocationDef = {
  id: string
  name: string
  icon: string
  desc: string
  from?: string
}

export type GoalDef = {
  id: string
  text: string
  points: number
  /** 达成条件；未提供 check 的目标由剧本特定逻辑判定 */
  check?: Cond
  hidden?: boolean
}

export type RoleDef = {
  id: string
  name: string
  enName: string
  title: string
  avatar: string
  color: string
  /** 公开简介（对方可见） */
  publicProfile: string
  /** 私密剧本：章节 id → 文本 */
  script: { id: string; title: string; text: string; from: string }[]
  goals: GoalDef[]
  /** 初始资金 */
  money?: number
}

export type ChoiceOption = {
  id: string
  label: string
  desc?: string
  requires?: Cond
  effects?: Effect[]
}

export type CaseQuestion = {
  id: string
  prompt: string
  options: { id: string; label: string }[]
  answer: string
}

export type CaseFileDef = {
  id: string
  title: string
  desc: string
  questions: CaseQuestion[]
  reward: number
  /** 每次提交错误的罚金 */
  penalty: number
  maxAttempts: number
  /** 开放区间（步骤 id，含首尾） */
  opens: string
  closes: string
}

export type AccuseQuestion = {
  id: string
  prompt: string
  options: { id: string; label: string }[]
  answer: string | string[]
  points: number
  /** 只对某角色出现（个人问题） */
  onlyRole?: string
}

export type StepKind =
  | 'story'     // 公共叙事
  | 'read'      // 私密阅读
  | 'search'    // 搜证/问询
  | 'discuss'   // 讨论
  | 'choice'    // 同时秘密抉择
  | 'finale'    // 终局大机制（剧本特定）
  | 'accuse'    // 结构化指认
  | 'ending'    // 结局与复盘

export type StepDef = {
  id: string
  kind: StepKind
  title: string
  /** 公共叙事 / 阶段说明（DM 播报） */
  text?: string
  /** 倒计时（秒）；不填则只靠双方“准备” */
  seconds?: number
  /** read：对应的剧本章节 id */
  chapter?: string
  /** search：每人行动点 */
  ap?: number
  /** choice：按角色给出的提示与选项 */
  choice?: Record<string, { prompt: string; options: ChoiceOption[] }>
  /** 进入步骤时触发的效果 */
  onEnter?: Effect[]
}

export type EndingDef = {
  id: string
  title: string
  text: string
}

export type Scenario = {
  id: string
  title: string
  subtitle: string
  tagline: string
  /** 大厅展示用的无剧透简介 */
  intro: string
  era: string
  duration: string
  roles: RoleDef[]
  npcs: NpcDef[]
  locations: LocationDef[]
  clues: ClueDef[]
  flow: StepDef[]
  caseFiles: CaseFileDef[]
  accuse: AccuseQuestion[]
  endings: EndingDef[]
  /** 复盘（结局页全部公开） */
  truth: { title: string; text: string }[]
}

// ───────────────────────── 运行时状态 ─────────────────────────

export type LogEntry = {
  id: number
  ts: number
  from: Seat | 'DM'
  to: Seat | 'all'
  text: string
  kind: 'chat' | 'dm' | 'system' | 'event'
}

export type ClueState = {
  owner: Seat | null
  public: boolean
  /** 被谁看到过（所有权可转移，但看过的人仍记得内容） */
  seenBy: Seat[]
  foundAt: number
  destroyed?: boolean
  forged?: boolean
}

export type QaRecord = { npc: string; q: string; seat: Seat; ts: number }

export type CaseAttempt = { ts: number; correct: boolean; wrong: number }

export type SeatState = {
  name: string | null
  online: boolean
  roleId: string | null
  ready: boolean
  ap: number
  money: number
  flags: Record<string, FlagValue>
  choices: Record<string, string>
  caseAttempts: Record<string, CaseAttempt[]>
  accuse: Record<string, string | string[]> | null
}

export type GameState = {
  code: string
  seed: number
  rngState: number
  createdAt: number
  stepIndex: number
  stepStartedAt: number
  deadline: number | null
  seats: Record<Seat, SeatState>
  clues: Record<string, ClueState>
  qa: QaRecord[]
  flags: Record<string, FlagValue>
  log: LogEntry[]
  logSeq: number
  /** 剧本特定的终局状态 */
  finale: unknown
  ended: boolean
}

// ───────────────────────── 玩家动作 ─────────────────────────

export type MysteryAction =
  | { type: 'pickRole'; roleId: string }
  | { type: 'ready'; value: boolean }
  | { type: 'chat'; text: string }
  | { type: 'search'; clueId: string }
  | { type: 'ask'; npcId: string; questionId: string }
  | { type: 'publish'; clueId: string }
  | { type: 'give'; clueId: string }
  | { type: 'choose'; optionId: string }
  | { type: 'caseFile'; caseId: string; answers: Record<string, string> }
  | { type: 'accuse'; answers: Record<string, string | string[]> }
  | { type: 'finale'; payload: unknown }

// ───────────────────────── 视图 ─────────────────────────

export type ClueView = {
  id: string
  title: string
  icon: string
  kind: ClueKind
  text: string
  location?: string
  holder: 'me' | 'other' | 'none'
  public: boolean
  forged?: boolean
}

export type SpotView = {
  clueId: string
  location: string
  spot: string
  cost: number
  status: 'open' | 'mine' | 'taken' | 'locked'
  /** 只有本角色可取得 */
  exclusive?: boolean
}

export type QuestionView = {
  id: string
  ask: string
  cost: number
  present?: { id: string; title: string }
  asked: boolean
  answer?: string
}

export type NpcView = {
  id: string
  name: string
  title: string
  avatar: string
  profile: string
  questions: QuestionView[]
}

export type CaseFileView = {
  id: string
  title: string
  desc: string
  reward: number
  penalty: number
  attemptsLeft: number
  solved: boolean
  lastWrong: number | null
  questions: { id: string; prompt: string; options: { id: string; label: string }[] }[]
  open: boolean
}

export type SeatView = {
  code: string
  seat: Seat
  scenario: { id: string; title: string; subtitle: string; tagline: string; intro: string; era: string; duration: string }
  roles: { id: string; name: string; enName: string; title: string; avatar: string; color: string; publicProfile: string }[]
  players: Record<Seat, { name: string | null; online: boolean; roleId: string | null; ready: boolean; money: number }>
  step: {
    index: number
    total: number
    id: string
    kind: StepKind | 'lobby'
    title: string
    text?: string
    deadline: number | null
    serverNow: number
  }
  me: {
    roleId: string | null
    ap: number
    money: number
    chapters: { id: string; title: string; text: string; isNew: boolean }[]
    goals: { id: string; text: string; points: number }[]
    choice?: { prompt: string; options: { id: string; label: string; desc?: string; disabled?: boolean }[]; chosen: string | null }
    accuse: Record<string, string | string[]> | null
  }
  locations: { id: string; name: string; icon: string; desc: string }[]
  spots: SpotView[]
  npcs: NpcView[]
  clues: ClueView[]
  caseFiles: CaseFileView[]
  accuse: { id: string; prompt: string; options: { id: string; label: string }[]; multi: boolean }[]
  log: LogEntry[]
  finale: unknown
  result: ResultView | null
}

// ───────────────────────── 结局视图（剧本模块产出）─────────────────────────

export type ResultView = {
  headline: string
  endings: { seat: Seat; roleName: string; title: string; text: string }[]
  scores: { seat: Seat; roleName: string; total: number; items: { label: string; points: number; got: boolean }[] }[]
  accuseReview: { prompt: string; answer: string; picks: Partial<Record<Seat, string>> }[]
  truth: { title: string; text: string }[]
  /** 对局中的隐藏操作日志（篡改线索等），终局公开 */
  secrets: string[]
}
