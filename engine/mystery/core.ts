// =====================
// 剧本杀引擎 - 通用状态机（DM）
// 纯函数：reduce(state, seat, action, now) → 新 state；不修改入参。
// =====================

import type {
  CaseFileDef, ClueDef, ClueView, Cond, Effect, GameState, LogEntry, MysteryAction,
  NpcView, QuestionDef, Seat, SeatState, SeatView, SpotView, StepDef,
} from './types'
import { SEATS, otherSeat } from './types'
import type { ScenarioRuntime } from './runtime'

const MAX_LOG = 400
const MAX_CHAT = 300

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
    return SEATS.find(s => state.seats[s].roleId === roleId) ?? null
  }

  function canSee(state: GameState, seat: Seat, clueId: string): boolean {
    const c = state.clues[clueId]
    if (!c || c.destroyed) return false
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

  function log(state: GameState, now: number, from: LogEntry['from'], to: LogEntry['to'], text: string, kind: LogEntry['kind']) {
    state.logSeq += 1
    state.log.push({ id: state.logSeq, ts: now, from, to, text, kind })
    if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG)
  }

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
      seenBy: def.autoPublic ? [...SEATS] : [seat],
      foundAt: now,
    }
    if (def.autoPublic) {
      log(state, now, 'DM', 'all', `【公开线索】${seatName(state, seat)} 发现了「${def.title}」，内容已对双方公开。`, 'event')
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
        const targets: Seat[] = e.to === 'other' ? [otherSeat(seat)] : e.to === 'both' ? [...SEATS] : [seat]
        for (const t of targets) grantClue(state, t, e.giveClue, now)
      } else if ('setFlag' in e) {
        state.flags[e.setFlag] = e.value
      } else if ('setSeatFlag' in e) {
        const t = e.to === 'other' ? otherSeat(seat) : seat
        state.seats[t].flags[e.setSeatFlag] = e.value
      } else if ('money' in e) {
        const t = e.to === 'other' ? otherSeat(seat) : seat
        state.seats[t].money = Math.max(0, state.seats[t].money + e.money)
      } else if ('dm' in e) {
        const to: LogEntry['to'] = e.to === 'both' ? 'all' : e.to === 'other' ? otherSeat(seat) : seat
        log(state, now, 'DM', to, e.dm, 'dm')
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
    for (const s of SEATS) state.seats[s].ready = false
    const step = stepAt(state)
    if (!step) {
      state.deadline = null
      return
    }
    state.deadline = step.seconds ? now + step.seconds * 1000 : null
    if (step.kind === 'search') {
      for (const s of SEATS) state.seats[s].ap = step.ap ?? 0
    }
    log(state, now, 'DM', 'all', `—— ${step.title} ——${step.text ? '\n' + step.text : ''}`, 'system')
    for (const s of SEATS) applyEffects(state, s, step.onEnter, now)
    if (step.kind === 'read' && step.chapter) {
      for (const s of SEATS) {
        const r = roleOf(state, s)
        const ch = r?.script.find(c => c.id === step.chapter)
        if (ch) log(state, now, 'DM', s, `你的剧本已更新：「${ch.title}」。`, 'dm')
      }
    }
    if (step.kind === 'finale' && rt.finale) {
      rt.finale.init(state, now)
    }
    if (step.kind === 'ending') {
      state.ended = true
      state.deadline = null
    }
  }

  function leaveStep(state: GameState, now: number) {
    const step = stepAt(state)
    if (!step) return
    if (step.kind === 'choice' && step.choice) {
      for (const s of SEATS) {
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
    if (step.kind === 'accuse') {
      for (const s of SEATS) if (!state.seats[s].accuse) state.seats[s].accuse = {}
    }
  }

  function advance(state: GameState, now: number) {
    leaveStep(state, now)
    if (state.stepIndex + 1 < sc.flow.length) enterStep(state, state.stepIndex + 1, now)
  }

  function maybeAutoAdvance(state: GameState, now: number) {
    const step = stepAt(state)
    if (!step || step.kind === 'ending') return
    if (step.kind === 'finale') {
      if (rt.finale?.isDone(state)) advance(state, now)
      return
    }
    if (step.kind === 'accuse') {
      if (SEATS.every(s => state.seats[s].accuse)) advance(state, now)
      return
    }
    if (step.kind === 'choice') {
      const allChosen = SEATS.every(s => {
        const r = roleOf(state, s)
        return !r || !step.choice?.[r.id] || !!state.seats[s].choices[step.id]
      })
      if (allChosen && SEATS.every(s => state.seats[s].ready)) advance(state, now)
      return
    }
    if (SEATS.every(s => state.seats[s].ready)) advance(state, now)
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
      seats: { P1: emptySeat(), P2: emptySeat() },
      clues: {},
      qa: [],
      flags: {},
      log: [],
      logSeq: 0,
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

  function setPresence(prev: GameState, seat: Seat, online: boolean, now: number): GameState {
    if (prev.seats[seat].online === online) return prev
    const state = structuredClone(prev)
    state.seats[seat].online = online
    const name = state.seats[seat].name ?? seat
    log(state, now, 'DM', 'all', online ? `${name} 已重新连线。` : `${name} 断线了（可用原设备重新打开页面自动恢复）。`, 'system')
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
        if (holder && holder !== seat) return '该角色已被对方选择'
        me.roleId = role.id
        me.ready = false
        state.seats[otherSeat(seat)].ready = false
        return
      }

      case 'ready': {
        const value = !!action.value
        if (state.stepIndex === -1) {
          if (value) {
            if (!me.roleId) return '请先选择角色'
            const other = state.seats[otherSeat(seat)]
            if (!other.name) return '等待第二位玩家加入'
          }
          me.ready = value
          if (SEATS.every(s => state.seats[s].ready && state.seats[s].roleId)) startGame(state, now)
          return
        }
        if (!step) return
        if (step.kind === 'finale' || step.kind === 'ending' || step.kind === 'accuse') return '此阶段不能使用“准备”'
        if (step.kind === 'choice' && value) {
          const r = roleOf(state, seat)
          if (r && step.choice?.[r.id] && !me.choices[step.id]) return '请先做出选择'
        }
        me.ready = value
        return
      }

      case 'search': {
        if (!step || step.kind !== 'search') return '现在不是搜证时间'
        const def = clueById.get(String(action.clueId))
        if (!def || !def.location) return '这里没有可搜的东西'
        const spot = spotStatus(state, seat, def)
        if (spot === 'mine' || spot === 'taken') return '这里已经被搜过了'
        if (spot === 'locked') return '还不能搜这里'
        const cost = def.cost ?? 1
        if (me.ap < cost) return '行动点不足'
        me.ap -= cost
        me.ready = false
        grantClue(state, seat, def.id, now)
        const other = otherSeat(seat)
        const loc = sc.locations.find(l => l.id === def.location)
        log(state, now, 'DM', other, `${seatName(state, seat)} 搜查了「${loc?.name ?? ''} · ${def.spot ?? def.title}」。`, 'dm')
        return
      }

      case 'ask': {
        if (!step || step.kind !== 'search') return '现在不能问询'
        const npc = npcById.get(String(action.npcId))
        if (!npc) return '没有这个人'
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
        log(state, now, 'DM', otherSeat(seat), `${seatName(state, seat)} 找${npc.name}单独谈了几句。`, 'dm')
        return
      }

      case 'publish': {
        const c = state.clues[String(action.clueId)]
        const def = clueById.get(String(action.clueId))
        if (!c || !def || c.destroyed) return '没有这条线索'
        if (c.owner !== seat) return '只能公开自己持有的线索'
        if (c.public) return '已经公开过了'
        if (state.stepIndex < 0 || state.ended) return '现在不能公开线索'
        c.public = true
        for (const s of SEATS) if (!c.seenBy.includes(s)) c.seenBy.push(s)
        log(state, now, 'DM', 'all', `【公开线索】${seatName(state, seat)} 公开了「${def.title}」。`, 'event')
        return
      }

      case 'give': {
        const c = state.clues[String(action.clueId)]
        const def = clueById.get(String(action.clueId))
        if (!c || !def || c.destroyed) return '没有这条线索'
        if (c.owner !== seat) return '只能交出自己持有的线索'
        if (state.stepIndex < 0 || state.ended) return '现在不能交出线索'
        const other = otherSeat(seat)
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
        log(state, now, 'DM', otherSeat(seat), `${seatName(state, seat)} 已做出选择。`, 'dm')
        return
      }

      case 'caseFile': {
        const cf = caseById.get(String(action.caseId))
        if (!cf) return '没有这个案卷'
        if (!stepWindowOpen(state, cf.opens, cf.closes)) return '该案卷现在不接受提交'
        const attempts = me.caseAttempts[cf.id] ?? []
        if (attempts.some(a => a.correct)) return '你已经破解了这一案'
        if (attempts.length >= cf.maxAttempts) return '提交次数已用完'
        const answers = action.answers && typeof action.answers === 'object' ? action.answers : {}
        const wrong = cf.questions.filter(q => answers[q.id] !== q.answer).length
        const correct = wrong === 0
        attempts.push({ ts: now, correct, wrong })
        me.caseAttempts[cf.id] = attempts
        if (correct) {
          me.money += cf.reward
          me.flags[`case:${cf.id}`] = true
          log(state, now, 'DM', seat, `✅ 案卷「${cf.title}」判定正确！酬金 $${cf.reward.toLocaleString('en-US')} 已到账。`, 'dm')
          log(state, now, 'DM', otherSeat(seat), `${seatName(state, seat)} 向 DM 递交了一份案卷，并且拿到了酬金。`, 'dm')
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
        log(state, now, 'DM', otherSeat(seat), `${seatName(state, seat)} 已提交最终指认。`, 'dm')
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

  function startGame(state: GameState, now: number) {
    for (const s of SEATS) {
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

  function spotStatus(state: GameState, seat: Seat, def: ClueDef): SpotView['status'] {
    const c = state.clues[def.id]
    if (c) return c.owner === seat ? 'mine' : 'taken'
    if (!reached(state, def.from)) return 'locked'
    if (def.onlyRole && state.seats[seat].roleId !== def.onlyRole) return 'locked'
    if (!evalCond(state, seat, def.requires)) return 'locked'
    return 'open'
  }

  function accuseFor(state: GameState, seat: Seat) {
    const roleId = state.seats[seat].roleId
    return sc.accuse.filter(q => !q.onlyRole || q.onlyRole === roleId)
  }

  function viewFor(state: GameState, seat: Seat, now: number): SeatView {
    const step = stepAt(state)
    const me = state.seats[seat]
    const role = roleOf(state, seat)

    const players = {} as SeatView['players']
    for (const s of SEATS) {
      const st = state.seats[s]
      players[s] = { name: st.name, online: st.online, roleId: st.roleId, ready: st.ready, money: st.money }
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
      for (const def of sc.clues) {
        if (!def.location) continue
        const status = spotStatus(state, seat, def)
        // 尚未解锁的二级搜证点不显示（避免剧透）；专属点对非本角色隐藏
        if (status === 'locked' && (def.requires || def.onlyRole)) continue
        if (status === 'locked' && !reached(state, def.from)) continue
        spots.push({
          clueId: def.id,
          location: def.location,
          spot: def.spot ?? def.title,
          cost: def.cost ?? 1,
          status,
          exclusive: !!def.onlyRole,
        })
      }
    }

    const npcs: NpcView[] = sc.npcs
      .filter(n => reached(state, n.from) && state.stepIndex >= 0)
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
      if (!c || c.destroyed || !canSee(state, seat, def.id)) continue
      clues.push({
        id: def.id,
        title: def.title,
        icon: def.icon,
        kind: def.kind,
        text: c.forged && def.forgedText ? def.forgedText : def.text,
        location: def.location,
        holder: c.owner === seat ? 'me' : c.owner ? 'other' : 'none',
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

    const log = state.log.filter(e => e.to === 'all' || e.to === seat).slice(-200)

    return {
      code: state.code,
      seat,
      scenario: { id: sc.id, title: sc.title, subtitle: sc.subtitle, tagline: sc.tagline, intro: sc.intro, era: sc.era, duration: sc.duration },
      roles: sc.roles.map(r => ({ id: r.id, name: r.name, enName: r.enName, title: r.title, avatar: r.avatar, color: r.color, publicProfile: r.publicProfile })),
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
        goals: state.stepIndex >= 0 ? (role?.goals ?? []).filter(g => !g.hidden).map(g => ({ id: g.id, text: g.text, points: g.points })) : [],
        choice,
        accuse: me.accuse,
      },
      locations: inSearch ? sc.locations.filter(l => reached(state, l.from)).map(l => ({ id: l.id, name: l.name, icon: l.icon, desc: l.desc })) : [],
      spots,
      npcs: inSearch ? npcs : npcs.map(n => ({ ...n, questions: n.questions.filter(q => q.asked) })),
      clues,
      caseFiles,
      accuse,
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
    reduce,
    tick,
    nextDeadline,
    viewFor,
    // 供剧本模块与测试使用
    helpers: { evalCond, canSee, grantClue, log, applyEffects, roleOf, seatOfRole, stepAt, reached, seatName },
  }
}
