// =====================
// 剧本杀引擎 - 通用状态机（DM）
// 纯函数：reduce(state, seat, action, now) → 新 state；不修改入参。
// =====================

import type {
  CaseFileDef, ClueDef, ClueView, Cond, Effect, GameState, MysteryAction,
  NpcView, QuestionDef, Seat, SeatState, SeatView, SpotView, StepDef,
} from './types'
import { SEATS } from './types'
import type { ScenarioRuntime } from './runtime'
import { appendLog } from './log'
import { createHash } from 'node:crypto'

const MAX_CHAT = 300
/** 必须双方各自操作才能推进的步骤（accuse / choice / auction）没配倒计时时的兜底 */
const FALLBACK_SECONDS = 900

export type ReduceResult = { state: GameState; error?: string }

export type Engine = ReturnType<typeof makeEngine>

// ── 可复现随机数（mulberry32）──
export function nextRandom(state: GameState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function emptySeat(): SeatState {
  return {
    name: null,
    online: false,
    roleId: null,
    ready: false,
    ap: 0,
    money: 0,
    flags: {},
    choices: {},
    caseAttempts: {},
    accuse: null,
  }
}

export function makeEngine(rt: ScenarioRuntime) {
  const sc = rt.scenario
  const clueById = new Map(sc.clues.map(c => [c.id, c]))
  const npcById = new Map(sc.npcs.map(n => [n.id, n]))
  const roleById = new Map(sc.roles.map(r => [r.id, r]))
  const stepIndexById = new Map(sc.flow.map((s, i) => [s.id, i]))
  const caseById = new Map(sc.caseFiles.map(c => [c.id, c]))
  const spotClues = sc.clues.filter(c => c.location)
  const MAX_PLAYERS = Math.max(1, Math.min(sc.maxPlayers ?? 2, SEATS.length))
  const MIN_PLAYERS = Math.max(1, Math.min(sc.minPlayers ?? 2, MAX_PLAYERS))
  /** 这个剧本用得到的座位 */
  const SEAT_LIST: Seat[] = SEATS.slice(0, MAX_PLAYERS)

  // ───────────── 座位 ─────────────

  /** 这局的座位：开局后是开局时在座的人；开局前是已经入座的人 */
  function seatsIn(state: GameState): Seat[] {
    return state.stepIndex === -1 ? SEAT_LIST.filter(s => state.seats[s].name) : state.roster
  }

  function othersOf(state: GameState, seat: Seat): Seat[] {
    return seatsIn(state).filter(s => s !== seat)
  }

  /** 某个角色这局有没有人扮演 */
  function rolePlayed(state: GameState, roleId: string): boolean {
    return seatsIn(state).some(s => state.seats[s].roleId === roleId)
  }

  // ───────────── 搜查点编号 ─────────────
  // 发给客户端的是按房间种子散列出来的编号，不暴露线索 id（线索 id 本身是剧透）

  // 用房间的秘密种子做 SHA-256（不可逆）：拿自己看得见的点反推不出别的点的编号
  const spotIdCache = new Map<string, string>()
  function spotIdOf(state: GameState, clueId: string): string {
    const key = `${state.seed}:${state.code}:${clueId}`
    let id = spotIdCache.get(key)
    if (!id) {
      id = createHash('sha256').update(key).digest('base64url').slice(0, 12)
      if (spotIdCache.size > 50_000) spotIdCache.clear()
      spotIdCache.set(key, id)
    }
    return id
  }

  function clueOfSpot(state: GameState, spotId: string): ClueDef | null {
    if (typeof spotId !== 'string' || !spotId) return null
    return spotClues.find(c => spotIdOf(state, c.id) === spotId) ?? null
  }

  // ───────────── 工具 ─────────────

  function stepAt(state: GameState): StepDef | null {
    return state.stepIndex >= 0 && state.stepIndex < sc.flow.length ? sc.flow[state.stepIndex] : null
  }

  function reached(state: GameState, stepId: string | undefined): boolean {
    if (!stepId) return true
    const idx = stepIndexById.get(stepId)
    if (idx === undefined) return false
    return state.stepIndex >= idx
  }

  function roleOf(state: GameState, seat: Seat) {
    const id = state.seats[seat].roleId
    return id ? roleById.get(id) ?? null : null
  }

  function seatOfRole(state: GameState, roleId: string): Seat | null {
    return seatsIn(state).find(s => state.seats[s].roleId === roleId) ?? null
  }

  function canSee(state: GameState, seat: Seat, clueId: string): boolean {
    const c = state.clues[clueId]
    if (!c) return false
    // 被销毁的线索只从持有者那里消失；看过它的另一方仍然记得内容，
    // 也就无从得知它被烧了（"秘密销毁"到结局才公开）
    if (c.destroyed) return c.owner !== seat && (c.public || c.seenBy.includes(seat))
    return c.public || c.owner === seat || c.seenBy.includes(seat)
  }

  function evalCond(state: GameState, seat: Seat, cond: Cond | undefined): boolean {
    if (!cond) return true
    if ('hasClue' in cond) return canSee(state, seat, cond.hasClue)
    if ('owns' in cond) return state.clues[cond.owns]?.owner === seat && !state.clues[cond.owns]?.destroyed
    if ('flag' in cond) {
      const v = state.flags[cond.flag]
      return cond.eq === undefined ? !!v : v === cond.eq
    }
    if ('seatFlag' in cond) {
      const v = state.seats[seat].flags[cond.seatFlag]
      return cond.eq === undefined ? !!v : v === cond.eq
    }
    if ('role' in cond) return state.seats[seat].roleId === cond.role
    if ('reached' in cond) return reached(state, cond.reached)
    if ('all' in cond) return cond.all.every(c => evalCond(state, seat, c))
    if ('any' in cond) return cond.any.some(c => evalCond(state, seat, c))
    if ('not' in cond) return !evalCond(state, seat, cond.not)
    return false
  }

  const log = appendLog

  function grantClue(state: GameState, seat: Seat, clueId: string, now: number, opts: { quiet?: boolean } = {}) {
    const def = clueById.get(clueId)
    if (!def) return
    const existing = state.clues[clueId]
    if (existing && !existing.destroyed) {
      // 已存在：只让该座位“看见”
      if (!existing.seenBy.includes(seat)) existing.seenBy.push(seat)
      if (!opts.quiet) log(state, now, 'DM', seat, `你获得了线索【${def.title}】。`, 'dm')
      return
    }
    state.clues[clueId] = {
      owner: seat,
      public: !!def.autoPublic,
      seenBy: def.autoPublic ? [...seatsIn(state)] : [seat],
      foundAt: now,
      foundBy: seat,
    }
    if (def.autoPublic) {
      log(state, now, 'DM', 'all', `【公开线索】${seatName(state, seat)} 发现了「${def.title}」，内容已对所有人公开。`, 'event')
    } else if (!opts.quiet) {
      log(state, now, 'DM', seat, `你获得了线索【${def.title}】。只有你能看到，是否公开由你决定。`, 'dm')
    }
  }

  function seatName(state: GameState, seat: Seat): string {
    const r = roleOf(state, seat)
    return r ? r.name : state.seats[seat].name ?? seat
  }

  function applyEffects(state: GameState, seat: Seat, effects: Effect[] | undefined, now: number) {
    if (!effects) return
    for (const e of effects) {
      if ('giveClue' in e) {
        if (e.role && state.seats[seat].roleId !== e.role) continue
        const targets: Seat[] = e.to === 'other' ? othersOf(state, seat) : e.to === 'both' ? seatsIn(state) : [seat]
        for (const t of targets) grantClue(state, t, e.giveClue, now)
      } else if ('setFlag' in e) {
        state.flags[e.setFlag] = e.value
      } else if ('setSeatFlag' in e) {
        for (const t of e.to === 'other' ? othersOf(state, seat) : [seat]) state.seats[t].flags[e.setSeatFlag] = e.value
      } else if ('money' in e) {
        for (const t of e.to === 'other' ? othersOf(state, seat) : [seat]) state.seats[t].money = Math.max(0, state.seats[t].money + e.money)
      } else if ('dm' in e) {
        if (e.to === 'both') log(state, now, 'DM', 'all', e.dm, 'dm')
        else for (const t of e.to === 'other' ? othersOf(state, seat) : [seat]) log(state, now, 'DM', t, e.dm, 'dm')
      }
    }
  }

  function stepWindowOpen(state: GameState, opens: string, closes: string): boolean {
    const a = stepIndexById.get(opens)
    const b = stepIndexById.get(closes)
    if (a === undefined || b === undefined) return false
    return state.stepIndex >= a && state.stepIndex <= b
  }

  // ───────────── 流程推进 ─────────────

  function enterStep(state: GameState, index: number, now: number) {
    state.stepIndex = index
    state.stepStartedAt = now
    for (const s of seatsIn(state)) state.seats[s].ready = false
    const step = stepAt(state)
    if (!step) {
      state.deadline = null
      return
    }
    const seconds = step.seconds ?? (step.kind === 'accuse' || step.kind === 'choice' || step.kind === 'auction' ? FALLBACK_SECONDS : 0)
    state.deadline = seconds ? now + seconds * 1000 : null
    if (step.kind === 'search') {
      for (const s of seatsIn(state)) state.seats[s].ap = step.ap ?? 0
    }
    log(state, now, 'DM', 'all', `—— ${step.title} ——${step.text ? '\n' + step.text : ''}`, 'system')
    applyEnterEffects(state, step.onEnter, now)
    if (step.kind === 'read' && step.chapter) {
      for (const s of seatsIn(state)) {
        const r = roleOf(state, s)
        const ch = r?.script.find(c => c.id === step.chapter)
        if (ch) log(state, now, 'DM', s, `你的剧本已更新：「${ch.title}」。`, 'dm')
      }
    }
    if (step.kind === 'auction') {
      state.auction = { stepId: step.id, bids: {}, results: null }
    }
    if (step.kind === 'finale' && rt.finale) {
      rt.finale.init(state, now)
    }
    if (step.kind === 'ending') {
      state.ended = true
      state.deadline = null
    }
  }

  /**
   * onEnter：与座位相关的效果（带 role 的发线索、seatFlag、money、私信）对每个座位各执行一次；
   * 全局效果（setFlag、对双方的广播、不带 role 的发线索）只执行一次。
   */
  function applyEnterEffects(state: GameState, effects: Effect[] | undefined, now: number) {
    if (!effects?.length) return
    const perSeat = (e: Effect) =>
      ('giveClue' in e && (!!e.role || (e.to !== undefined && e.to !== 'both'))) ||
      'setSeatFlag' in e || 'money' in e || ('dm' in e && e.to !== 'both')
    const seats = seatsIn(state)
    for (const s of seats) applyEffects(state, s, effects.filter(perSeat), now)
    const globals = effects.filter(e => !perSeat(e)).map(e => ('giveClue' in e && !e.to ? { ...e, to: 'both' as const } : e))
    if (seats.length) applyEffects(state, seats[0], globals, now)
  }

  function leaveStep(state: GameState, now: number) {
    const step = stepAt(state)
    if (!step) return
    if (step.kind === 'choice' && step.choice) {
      for (const s of seatsIn(state)) {
        const r = roleOf(state, s)
        const def = r ? step.choice[r.id] : undefined
        if (!def) continue
        let chosen = state.seats[s].choices[step.id]
        let opt = def.options.find(o => o.id === chosen)
        if (!opt) {
          // 超时未选：取第一个可选项
          opt = def.options.find(o => evalCond(state, s, o.requires))
          if (opt) {
            chosen = opt.id
            state.seats[s].choices[step.id] = chosen
            log(state, now, 'DM', s, `时间到，系统替你选择了「${opt.label}」。`, 'dm')
          }
        }
        if (opt) applyEffects(state, s, opt.effects, now)
      }
    }
    if (step.kind === 'auction' && state.auction && !state.auction.results) {
      resolveAuction(state, step, now)
    }
    if (step.kind === 'accuse') {
      for (const s of seatsIn(state)) {
        if (!state.seats[s].accuse) state.seats[s].accuse = {}
        let bonus = 0
        for (const q of accuseFor(state, s)) {
          if (q.bonus && isCorrect(q, state.seats[s].accuse![q.id])) bonus += q.bonus
        }
        if (bonus > 0) state.seats[s].money += bonus
        log(state, now, 'DM', s, bonus > 0
          ? `DM 核对了你的指认：酬金 $${bonus.toLocaleString('en-US')} 已到账。（只告诉你总额，不告诉你对在哪里。）`
          : 'DM 核对了你的指认：这一次，你没有拿到酬金。', 'dm')
      }
    }
  }

  function resolveAuction(state: GameState, step: StepDef, now: number) {
    const a = state.auction!
    const results: NonNullable<typeof a.results> = []
    const lines: string[] = []
    const seats = seatsIn(state)
    for (const lot of step.lots ?? []) {
      const bidOf = (s: Seat) => a.bids[s]?.[lot.id] ?? 0
      const top = Math.max(0, ...seats.map(bidOf))
      const leaders = seats.filter(s => bidOf(s) === top)
      const itemTitle = clueById.get(lot.item)?.title ?? lot.title
      if (top === 0 || leaders.length > 1) {
        results.push({ lot: lot.id, winner: null, price: top, tie: top > 0 })
        lines.push(top > 0
          ? `「${lot.title}」：最高出价相同（$${top.toLocaleString('en-US')}），${step.tie?.log ?? '流拍'}。`
          : `「${lot.title}」：无人出价，流拍。`)
        continue
      }
      const winner = leaders[0]
      const price = top
      state.seats[winner].money = Math.max(0, state.seats[winner].money - price)
      grantClue(state, winner, lot.item, now, { quiet: true })
      results.push({ lot: lot.id, winner, price, tie: false })
      lines.push(`「${lot.title}」：${seatName(state, winner)} 以 $${price.toLocaleString('en-US')} 拍得，获得道具【${itemTitle}】。`)
    }
    a.results = results
    log(state, now, 'DM', 'all', `🔨 拍卖结果\n${lines.join('\n')}`, 'event')
  }

  function isCorrect(q: { answer: string | string[] }, v: string | string[] | undefined): boolean {
    if (Array.isArray(q.answer)) {
      if (!Array.isArray(v)) return false
      const want = [...q.answer].sort().join('|')
      return [...v].sort().join('|') === want
    }
    return v === q.answer
  }

  function advance(state: GameState, now: number) {
    leaveStep(state, now)
    if (state.stepIndex + 1 < sc.flow.length) {
      enterStep(state, state.stepIndex + 1, now)
    } else {
      // 流程没有以 ending 收尾：就地结束，避免之后每个动作都重复执行 leaveStep 的结算
      state.ended = true
      state.deadline = null
    }
  }

  function maybeAutoAdvance(state: GameState, now: number) {
    const step = stepAt(state)
    if (!step || step.kind === 'ending' || state.ended) return
    if (step.kind === 'finale') {
      if (rt.finale?.isDone(state)) advance(state, now)
      return
    }
    const seats = seatsIn(state)
    if (step.kind === 'accuse') {
      if (seats.every(s => state.seats[s].accuse)) advance(state, now)
      return
    }
    if (step.kind === 'auction') {
      if (state.auction && !state.auction.results && seats.every(s => state.auction!.bids[s])) {
        resolveAuction(state, step, now)
        for (const s of seats) state.seats[s].ready = false
        return
      }
      if (state.auction?.results && seats.every(s => state.seats[s].ready)) advance(state, now)
      return
    }
    if (step.kind === 'choice') {
      const allChosen = seats.every(s => {
        const r = roleOf(state, s)
        return !r || !step.choice?.[r.id] || !!state.seats[s].choices[step.id]
      })
      if (allChosen && seats.every(s => state.seats[s].ready)) advance(state, now)
      return
    }
    if (seats.every(s => state.seats[s].ready)) advance(state, now)
  }

  // ───────────── 对外 API ─────────────

  function createGame(code: string, seed: number, now: number): GameState {
    return {
      code,
      seed,
      rngState: seed | 0,
      createdAt: now,
      stepIndex: -1,
      stepStartedAt: now,
      deadline: null,
      seats: { P1: emptySeat(), P2: emptySeat(), P3: emptySeat(), P4: emptySeat() },
      roster: [],
      clues: {},
      qa: [],
      flags: {},
      log: [],
      logSeq: 0,
      logSeqBy: { P1: 0, P2: 0, P3: 0, P4: 0 },
      auction: null,
      finale: null,
      ended: false,
    }
  }

  function joinSeat(prev: GameState, seat: Seat, name: string, now: number): GameState {
    const state = structuredClone(prev)
    const s = state.seats[seat]
    s.name = name
    s.online = true
    log(state, now, 'DM', 'all', `${name} 进入了房间。`, 'system')
    return state
  }

  function setPresence(prev: GameState, seat: Seat, online: boolean, now: number, reason?: 'left'): GameState {
    if (prev.seats[seat].online === online) return prev
    const state = structuredClone(prev)
    state.seats[seat].online = online
    // 大厅里掉线就取消准备：离线的座位不能被对方"一键开局"，否则开局后可能再也没人能回到这个座位
    if (!online && state.stepIndex === -1) state.seats[seat].ready = false
    const name = state.seats[seat].name ?? seat
    log(state, now, 'DM', 'all', online
      ? `${name} 已重新连线。`
      : reason === 'left'
        ? `${name} 暂时离开了（在原设备上打开本页即可回到这局）。`
        : `${name} 断线了（可用原设备重新打开页面自动恢复）。`, 'system')
    return state
  }

  /** 大厅里取消某个座位的准备（例如它的主人已经要离开、只是服务器还挂着旧连接） */
  function unready(prev: GameState, seat: Seat): GameState {
    if (prev.stepIndex !== -1 || !prev.seats[seat].ready) return prev
    const state = structuredClone(prev)
    state.seats[seat].ready = false
    return state
  }

  /** 开局后彻底放弃（入口页「放弃这局」）：如实告诉对方 */
  function abandonSeat(prev: GameState, seat: Seat, now: number): GameState {
    if (prev.stepIndex === -1 || prev.ended) return prev
    const state = structuredClone(prev)
    state.seats[seat].online = false
    log(state, now, 'DM', 'all', `${state.seats[seat].name ?? seat} 放弃了这一局，不会再回来了。`, 'system')
    return state
  }

  /** 大厅阶段离开：让出座位，新玩家可以补位 */
  function vacateSeat(prev: GameState, seat: Seat, now: number): GameState {
    if (prev.stepIndex !== -1) return prev
    const state = structuredClone(prev)
    const name = state.seats[seat].name
    state.seats[seat] = emptySeat()
    for (const s of SEAT_LIST) state.seats[s].ready = false
    if (name) log(state, now, 'DM', 'all', `${name} 离开了房间，座位已空出。`, 'system')
    return state
  }

  function reduce(prev: GameState, seat: Seat, action: MysteryAction, now: number): ReduceResult {
    if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
      return { state: prev, error: '无效操作' }
    }
    const state = structuredClone(prev)
    const err = apply(state, seat, action, now)
    if (err) return { state: prev, error: err }
    maybeAutoAdvance(state, now)
    return { state }
  }

  function apply(state: GameState, seat: Seat, action: MysteryAction, now: number): string | void {
    const me = state.seats[seat]
    const step = stepAt(state)

    switch (action.type) {
      case 'chat': {
        const text = String(action.text ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, MAX_CHAT)
        if (!text) return '消息为空'
        log(state, now, seat, 'all', text, 'chat')
        return
      }

      case 'pickRole': {
        if (state.stepIndex !== -1) return '游戏已开始，不能更换角色'
        const role = roleById.get(String(action.roleId))
        if (!role) return '没有这个角色'
        const holder = seatOfRole(state, role.id)
        if (holder && holder !== seat) return '这个角色已经被别人选了'
        if (me.roleId === role.id) return
        me.roleId = role.id
        // 角色变了，大家重新确认一次
        for (const s of SEAT_LIST) state.seats[s].ready = false
        return
      }

      case 'ready': {
        const value = !!action.value
        if (state.stepIndex === -1) {
          if (value) {
            if (!me.roleId) return '请先选择角色'
            const n = seatsIn(state).length
            if (n < MIN_PLAYERS) return `还要等人：至少 ${MIN_PLAYERS} 个人才能开局（现在 ${n} 人）`
          }
          me.ready = value
          if (canStart(state)) startGame(state, now)
          return
        }
        if (!step) return
        if (step.kind === 'finale' || step.kind === 'ending' || step.kind === 'accuse') return '此阶段不能使用“准备”'
        if (step.kind === 'auction' && value && !state.auction?.results) return '请先提交出价，等待揭晓'
        if (step.kind === 'choice' && value) {
          const r = roleOf(state, seat)
          if (r && step.choice?.[r.id] && !me.choices[step.id]) return '请先做出选择'
        }
        me.ready = value
        return
      }

      case 'search': {
        if (!step || step.kind !== 'search') return '现在不是搜证时间'
        const def = clueOfSpot(state, action.spotId)
        if (!def || !def.location) return '这里没有可搜的东西'
        const spot = spotStatus(state, seat, def)
        // 先判"你够不够得着"：够不着的点（专属 / 未解锁），对方搜没搜走，报错都一样
        if (spot !== 'mine' && !spotReachable(state, seat, def)) return '还不能搜这里'
        if (spot === 'mine' || spot === 'taken') return '这里已经被搜过了'
        const cost = def.cost ?? 1
        if (me.ap < cost) return '行动点不足'
        me.ap -= cost
        me.ready = false
        grantClue(state, seat, def.id, now)
        const loc = sc.locations.find(l => l.id === def.location)
        // 别人自己也够得着的点才说出具体位置；专属点、未解锁的点只说地点（否则等于告诉他你拿到了什么）
        for (const other of othersOf(state, seat)) {
          const place = def.spot && spotReachable(state, other, def) ? `「${loc?.name ?? ''} · ${def.spot}」` : `「${loc?.name ?? ''}」里的某处`
          log(state, now, 'DM', other, `${seatName(state, seat)} 搜查了${place}。`, 'dm')
        }
        return
      }

      case 'ask': {
        if (!step || step.kind !== 'search') return '现在不能问询'
        const npc = npcById.get(String(action.npcId))
        if (!npc || !npcPresent(state, npc)) return '没有这个人'
        if (!reached(state, npc.from)) return '此人现在不在场'
        const q = npc.questions.find(x => x.id === action.questionId)
        if (!q) return '没有这个问题'
        if (!questionAvailable(state, seat, q)) return '这个问题还不能问'
        if (state.qa.some(r => r.npc === npc.id && r.q === q.id && r.seat === seat)) return '你已经问过了'
        const cost = q.cost ?? 1
        if (me.ap < cost) return '行动点不足'
        me.ap -= cost
        me.ready = false
        state.qa.push({ npc: npc.id, q: q.id, seat, ts: now })
        if (q.present) log(state, now, 'DM', seat, `你向${npc.name}出示了【${clueById.get(q.present)?.title ?? ''}】。`, 'dm')
        log(state, now, 'DM', seat, `${npc.avatar} ${npc.name}：${q.answer}`, 'dm')
        for (const g of q.grants ?? []) grantClue(state, seat, g, now)
        applyEffects(state, seat, q.effects, now)
        for (const o of othersOf(state, seat)) log(state, now, 'DM', o, `${seatName(state, seat)} 找${npc.name}单独谈了几句。`, 'dm')
        return
      }

      case 'publish': {
        const id = String(action.clueId)
        const c = state.clues[id]
        const def = clueById.get(id)
        // 先判"你看不看得见"，再判归属、最后判销毁：自己看不见的线索，不论存在与否、在谁手里，都是同一句话；
        // 对方手里的牌烧没烧，也是同一句话（否则错误信息就能探测对方私下拿到 / 烧掉了什么）
        if (!c || !def || !canSee(state, seat, id)) return '没有这条线索'
        if (c.owner !== seat) return '只能公开自己持有的线索'
        if (c.destroyed) return '没有这条线索'
        if (c.public) return '已经公开过了'
        if (state.stepIndex < 0 || state.ended) return '现在不能公开线索'
        c.public = true
        for (const s of seatsIn(state)) if (!c.seenBy.includes(s)) c.seenBy.push(s)
        log(state, now, 'DM', 'all', `【公开线索】${seatName(state, seat)} 公开了「${def.title}」。`, 'event')
        return
      }

      case 'give': {
        const id = String(action.clueId)
        const c = state.clues[id]
        const def = clueById.get(id)
        if (!c || !def || !canSee(state, seat, id)) return '没有这条线索'
        if (c.owner !== seat) return '只能交出自己持有的线索'
        if (c.destroyed) return '没有这条线索'
        if (state.stepIndex < 0 || state.ended) return '现在不能交出线索'
        // 终局里证据就是选票：转手会让"限一次"的道具再用一次，也能把牵连自己的物证塞给对方躲过搜身
        if (step?.kind === 'finale') return '终局开始后证据已经封存，不能再交给别人'
        const others = othersOf(state, seat)
        const other = action.to === undefined && others.length === 1 ? others[0] : others.find(s => s === action.to)
        if (!other) return '请选择交给谁'
        c.owner = other
        if (!c.seenBy.includes(other)) c.seenBy.push(other)
        log(state, now, 'DM', 'all', `${seatName(state, seat)} 把「${def.title}」交给了 ${seatName(state, other)}。`, 'event')
        return
      }

      case 'choose': {
        if (!step || step.kind !== 'choice') return '现在不需要抉择'
        const r = roleOf(state, seat)
        const def = r ? step.choice?.[r.id] : undefined
        if (!def) return '你在此处无需抉择'
        if (me.choices[step.id]) return '你已经做出选择，无法更改'
        const opt = def.options.find(o => o.id === action.optionId)
        if (!opt) return '无效选项'
        if (!evalCond(state, seat, opt.requires)) return '你无法选择这一项'
        me.choices[step.id] = opt.id
        me.ready = true
        for (const o of othersOf(state, seat)) log(state, now, 'DM', o, `${seatName(state, seat)} 已做出选择。`, 'dm')
        return
      }

      case 'caseFile': {
        const cf = caseById.get(String(action.caseId))
        if (!cf) return '没有这个案卷'
        if (!stepWindowOpen(state, cf.opens, cf.closes)) return '该案卷现在不接受提交'
        const attempts = me.caseAttempts[cf.id] ?? []
        if (attempts.some(a => a.correct)) return '你已经破解了这一案'
        if (attempts.length >= cf.maxAttempts) return '提交次数已用完'
        if (typeof action.attemptsLeft === 'number' && action.attemptsLeft !== cf.maxAttempts - attempts.length) {
          return '这份案卷刚刚已经递交过了，请看过结果再决定是否重交'
        }
        const answers = action.answers && typeof action.answers === 'object' ? action.answers : {}
        const wrong = cf.questions.filter(q => answers[q.id] !== q.answer).length
        const correct = wrong === 0
        attempts.push({ ts: now, correct, wrong })
        me.caseAttempts[cf.id] = attempts
        if (correct) {
          me.money += cf.reward
          me.flags[`case:${cf.id}`] = true
          log(state, now, 'DM', seat, `✅ 案卷「${cf.title}」判定正确！酬金 $${cf.reward.toLocaleString('en-US')} 已到账。`, 'dm')
          for (const o of othersOf(state, seat)) log(state, now, 'DM', o, `${seatName(state, seat)} 向 DM 递交了一份案卷，并且拿到了酬金。`, 'dm')
        } else {
          me.money = Math.max(0, me.money - cf.penalty)
          const left = cf.maxAttempts - attempts.length
          const hint = wrong === 1 ? '只差一处' : '不止一处有误'
          log(state, now, 'DM', seat, `❌ 案卷「${cf.title}」判定不通过（${hint}）。扣除 $${cf.penalty.toLocaleString('en-US')}，剩余提交次数 ${left}。`, 'dm')
        }
        return
      }

      case 'accuse': {
        if (!step || step.kind !== 'accuse') return '现在不是指认环节'
        if (me.accuse) return '你已经提交了'
        const answers = action.answers && typeof action.answers === 'object' ? action.answers : {}
        const clean: Record<string, string | string[]> = {}
        for (const q of accuseFor(state, seat)) {
          const v = answers[q.id]
          if (Array.isArray(v)) clean[q.id] = v.filter(x => typeof x === 'string' && q.options.some(o => o.id === x))
          else if (typeof v === 'string' && q.options.some(o => o.id === v)) clean[q.id] = v
        }
        me.accuse = clean
        for (const o of othersOf(state, seat)) log(state, now, 'DM', o, `${seatName(state, seat)} 已提交最终指认。`, 'dm')
        return
      }

      case 'bid': {
        if (!step || step.kind !== 'auction' || !state.auction) return '现在不是拍卖时间'
        if (state.auction.bids[seat]) return '你已经提交了出价'
        if (state.auction.results) return '拍卖已经结束'
        const raw = action.bids && typeof action.bids === 'object' ? action.bids : {}
        const clean: Record<string, number> = {}
        let total = 0
        for (const lot of step.lots ?? []) {
          const v = Math.floor(Number(raw[lot.id] ?? 0))
          if (!Number.isFinite(v) || v < 0) return '出价无效'
          if (v === 0) { clean[lot.id] = 0; continue }
          if (v < lot.min) return `「${lot.title}」最低出价 $${lot.min}`
          if (v % 100 !== 0) return '出价须为 $100 的整数倍'
          clean[lot.id] = v
          total += v
        }
        if (total > me.money) return '总出价超过了你的现金'
        state.auction.bids[seat] = clean
        for (const o of othersOf(state, seat)) log(state, now, 'DM', o, `${seatName(state, seat)} 已经把暗标交给了拍卖师。`, 'dm')
        return
      }

      case 'finale': {
        if (!step || step.kind !== 'finale' || !rt.finale) return '现在不是终局环节'
        return rt.finale.act(state, seat, action.payload, now) ?? undefined
      }

      default:
        return '未知操作'
    }
  }

  /** 开局条件：人数够、每个人都在线、选了角色、点了准备；必须有人演的角色都有人演 */
  function canStart(state: GameState): boolean {
    const seats = seatsIn(state)
    if (seats.length < MIN_PLAYERS) return false
    if (!seats.every(s => state.seats[s].ready && state.seats[s].roleId && state.seats[s].online)) return false
    return sc.roles.every(r => r.optional || seats.some(s => state.seats[s].roleId === r.id))
  }

  function startGame(state: GameState, now: number) {
    state.roster = seatsIn(state)
    for (const s of state.roster) {
      const r = roleOf(state, s)
      state.seats[s].money = r?.money ?? 0
      state.seats[s].ready = false
    }
    log(state, now, 'DM', 'all', `🎬 游戏开始。我是本场的 DM（电脑主持）。${sc.title}——${sc.subtitle}`, 'system')
    enterStep(state, 0, now)
  }

  function tick(prev: GameState, now: number): GameState {
    const step = stepAt(prev)
    if (!step) return prev
    if (step.kind === 'finale' && prev.deadline === null && rt.finale) {
      const fd = rt.finale.deadline(prev)
      if (fd === null || fd > now) return prev
      const state = structuredClone(prev)
      const changed = rt.finale.tick(state, now)
      if (!changed) return prev
      maybeAutoAdvance(state, now)
      return state
    }
    if (prev.deadline === null || prev.deadline > now) return prev
    const state = structuredClone(prev)
    log(state, now, 'DM', 'all', '⏰ 时间到，DM 推进到下一阶段。', 'system')
    if (step.kind === 'finale') {
      state.deadline = null
      rt.finale?.tick(state, now)
      maybeAutoAdvance(state, now)
      return state
    }
    advance(state, now)
    return state
  }

  function nextDeadline(state: GameState): number | null {
    const step = stepAt(state)
    if (step?.kind === 'finale' && state.deadline === null && rt.finale) return rt.finale.deadline(state)
    return state.deadline
  }

  // ───────────── 视图 ─────────────

  function questionAvailable(state: GameState, seat: Seat, q: QuestionDef): boolean {
    if (!reached(state, q.from)) return false
    if (q.onlyRole && state.seats[seat].roleId !== q.onlyRole) return false
    if (!evalCond(state, seat, q.requires)) return false
    if (q.present && !canSee(state, seat, q.present)) return false
    return true
  }

  /** 这个搜查点对本座位是否可达（不看是否已被搜走） */
  function spotReachable(state: GameState, seat: Seat, def: ClueDef): boolean {
    if (!reached(state, def.from)) return false
    if (def.onlyRole && state.seats[seat].roleId !== def.onlyRole) return false
    return evalCond(state, seat, def.requires)
  }

  function spotStatus(state: GameState, seat: Seat, def: ClueDef): SpotView['status'] {
    const c = state.clues[def.id]
    if (c) return c.owner === seat || c.foundBy === seat ? 'mine' : 'taken'
    return spotReachable(state, seat, def) ? 'open' : 'locked'
  }

  /** 可选角色的替身 NPC：那个角色有人演，NPC 就不在场 */
  function npcPresent(state: GameState, npc: { standsInFor?: string }): boolean {
    return !npc.standsInFor || !rolePlayed(state, npc.standsInFor)
  }

  function accuseFor(state: GameState, seat: Seat) {
    const roleId = state.seats[seat].roleId
    return sc.accuse.filter(q => !q.onlyRole || q.onlyRole === roleId)
  }

  function viewFor(state: GameState, seat: Seat, now: number): SeatView {
    const step = stepAt(state)
    const me = state.seats[seat]
    const role = roleOf(state, seat)

    const seats = seatsIn(state)
    const players: SeatView['players'] = {}
    for (const s of seats) {
      const st = state.seats[s]
      players[s] = { name: st.name, online: st.online, roleId: st.roleId, ready: st.ready }
      // 别人的余额会泄露案卷对错、指认得分：只在结局后公开
      if (s === seat || state.ended) players[s]!.money = st.money
    }

    const chapters = (role?.script ?? [])
      .filter(c => reached(state, c.from) && state.stepIndex >= 0)
      .map(c => ({ id: c.id, title: c.title, text: c.text, isNew: step?.kind === 'read' && step.chapter === c.id }))

    let choice: SeatView['me']['choice']
    if (step?.kind === 'choice' && role && step.choice?.[role.id]) {
      const def = step.choice[role.id]
      choice = {
        prompt: def.prompt,
        options: def.options.map(o => ({ id: o.id, label: o.label, desc: o.desc, disabled: !evalCond(state, seat, o.requires) })),
        chosen: me.choices[step.id] ?? null,
      }
    }

    const inSearch = step?.kind === 'search'
    const spots: SpotView[] = []
    if (inSearch) {
      for (const def of spotClues) {
        const status = spotStatus(state, seat, def)
        // 尚未解锁的二级搜证点不显示（避免剧透）；专属点对非本角色隐藏。
        // 被对方搜走的点，也只在"本来就对你开放"时才显示为"已被搜走"——否则等于告诉你对方拿到了什么
        if (status === 'locked' && (def.requires || def.onlyRole)) continue
        if (status === 'locked' && !reached(state, def.from)) continue
        if (status === 'taken' && !spotReachable(state, seat, def)) continue
        spots.push({
          spotId: spotIdOf(state, def.id),
          location: def.location!,
          spot: def.spot ?? def.title,
          cost: def.cost ?? 1,
          status,
          exclusive: !!def.onlyRole,
        })
      }
    }

    const npcs: NpcView[] = sc.npcs
      .filter(n => reached(state, n.from) && state.stepIndex >= 0 && npcPresent(state, n))
      .map(n => ({
        id: n.id,
        name: n.name,
        title: n.title,
        avatar: n.avatar,
        profile: n.profile,
        questions: n.questions
          .filter(q => questionAvailable(state, seat, q) || state.qa.some(r => r.npc === n.id && r.q === q.id && r.seat === seat))
          .map(q => {
            const asked = state.qa.some(r => r.npc === n.id && r.q === q.id && r.seat === seat)
            return {
              id: q.id,
              ask: q.ask,
              cost: q.cost ?? 1,
              present: q.present ? { id: q.present, title: clueById.get(q.present)?.title ?? '' } : undefined,
              asked,
              answer: asked ? q.answer : undefined,
            }
          }),
      }))

    const clues: ClueView[] = []
    for (const def of sc.clues) {
      const c = state.clues[def.id]
      if (!c || !canSee(state, seat, def.id)) continue
      clues.push({
        id: def.id,
        title: def.title,
        icon: def.icon,
        kind: def.kind,
        text: c.forged && def.forgedText ? def.forgedText : def.text,
        location: def.location,
        holder: c.owner === seat ? 'me' : c.owner ? 'other' : 'none',
        holderSeat: c.owner && c.owner !== seat ? c.owner : undefined,
        public: c.public,
        forged: c.forged && c.owner === seat ? true : undefined,
      })
    }

    const caseFiles = sc.caseFiles
      .filter(cf => reached(state, cf.opens))
      .map(cf => caseView(state, seat, cf))

    const accuse = step && (step.kind === 'accuse' || step.kind === 'ending')
      ? accuseFor(state, seat).map(q => ({ id: q.id, prompt: q.prompt, options: q.options, multi: Array.isArray(q.answer) }))
      : []

    // 剧情、DM 私信全部保留；聊天只带最近 200 条（刷屏不会挤掉剧情）
    const visible = state.log
      .filter(e => e.to === 'all' || e.to === seat)
      .map(({ seq, ...e }) => ({ ...e, id: seq?.[seat] ?? e.id }))
    const chats = visible.filter(e => e.kind === 'chat')
    const chatFloor = chats.length > 200 ? chats[chats.length - 200].id : -Infinity
    const log = visible.filter(e => e.kind !== 'chat' || e.id >= chatFloor)

    let auction: SeatView['auction'] = null
    if (step?.kind === 'auction' && state.auction) {
      const a = state.auction
      auction = {
        lots: (step.lots ?? []).map(l => ({
          id: l.id, title: l.title, desc: l.desc, min: l.min,
          itemTitle: clueById.get(l.item)?.title ?? '', itemIcon: clueById.get(l.item)?.icon ?? '🎁',
        })),
        myBids: a.bids[seat] ?? null,
        submitted: seats.filter(s => !!a.bids[s]),
        // 揭晓前别人的出价一个字也不下发
        results: a.results
          ? a.results.map(r => ({
              lot: r.lot,
              winner: r.winner,
              price: r.price,
              tie: r.tie,
              bids: Object.fromEntries(seats.map(s => [s, a.bids[s]?.[r.lot] ?? 0])),
            }))
          : null,
        tieLabel: step.tie?.label ?? '平局 · 流拍',
      }
    }

    return {
      code: state.code,
      seat,
      seats,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      scenario: { id: sc.id, title: sc.title, subtitle: sc.subtitle, tagline: sc.tagline, intro: sc.intro, era: sc.era, duration: sc.duration },
      roles: sc.roles.map(r => ({ id: r.id, name: r.name, enName: r.enName, title: r.title, avatar: r.avatar, color: r.color, publicProfile: r.publicProfile, optional: !!r.optional })),
      players,
      step: {
        index: state.stepIndex,
        total: sc.flow.length,
        id: step?.id ?? 'lobby',
        kind: step?.kind ?? 'lobby',
        title: step?.title ?? '等待开局',
        text: step?.text,
        deadline: nextDeadline(state),
        serverNow: now,
      },
      me: {
        roleId: me.roleId,
        ap: me.ap,
        money: me.money,
        chapters,
        goals: state.stepIndex >= 0 ? (role?.goals ?? []).filter(g => !g.hidden && reached(state, g.from)).map(g => ({ id: g.id, text: g.text, points: g.points })) : [],
        choice,
        accuse: me.accuse,
      },
      locations: inSearch ? sc.locations.filter(l => reached(state, l.from)).map(l => ({ id: l.id, name: l.name, icon: l.icon, desc: l.desc })) : [],
      spots,
      npcs: inSearch ? npcs : npcs.map(n => ({ ...n, questions: n.questions.filter(q => q.asked) })),
      clues,
      caseFiles,
      accuse,
      auction,
      log,
      finale: step?.kind === 'finale' || (state.ended && rt.finale) ? rt.finale?.view(state, seat, now) ?? null : null,
      result: state.ended ? rt.result(state) : null,
    }
  }

  function caseView(state: GameState, seat: Seat, cf: CaseFileDef) {
    const attempts = state.seats[seat].caseAttempts[cf.id] ?? []
    const last = attempts[attempts.length - 1]
    return {
      id: cf.id,
      title: cf.title,
      desc: cf.desc,
      reward: cf.reward,
      penalty: cf.penalty,
      attemptsLeft: Math.max(0, cf.maxAttempts - attempts.length),
      solved: attempts.some(a => a.correct),
      lastWrong: last && !last.correct ? last.wrong : null,
      questions: cf.questions.map(q => ({ id: q.id, prompt: q.prompt, options: q.options })),
      open: stepWindowOpen(state, cf.opens, cf.closes),
    }
  }

  return {
    scenario: sc,
    createGame,
    joinSeat,
    setPresence,
    vacateSeat,
    abandonSeat,
    unready,
    reduce,
    tick,
    nextDeadline,
    viewFor,
    // 供剧本模块与测试使用
    spotIdOf,
    helpers: { evalCond, canSee, grantClue, log, applyEffects, roleOf, seatOfRole, stepAt, reached, seatName, clueOfSpot, seatsIn, othersOf, rolePlayed },
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
  }
}
