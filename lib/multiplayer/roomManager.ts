// =====================
// 弈战 - 房间管理器（服务端）
// =====================

import type { WebSocket } from 'ws'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, RoundInput, MarketForecast, Pledge, WildCard, WildCardType } from '@/engine/types'
import { ALL_PLAYER_IDS, WILD_CARD_POOL } from '@/engine/types'
import { createInitialPlayerStates, INITIAL_GLOBAL_STATE } from '@/engine/constants'
import { resolveRound } from '@/engine/resolveRound'
import { generateRoundNarration, generateGameNarration } from '@/engine/resolveGame'
import { getTheme } from '@/engine/themes'
import type { ThemeConfig, RoundIntel } from '@/engine/themes/types'
import type { ClientMessage, ServerMessage, PlayerSlot } from './protocol'
import { generateRoomCode } from './protocol'
import { assignObjectives, evaluateObjective, type Objective, type ObjectiveResult } from '@/engine/objectives'
import { generatePrivateIntel, type PrivateIntel } from '@/engine/privateIntel'
import { evaluatePact, makePactId, type Pact, type PactResult } from '@/engine/pacts'
import { makeListingId, type IntelListing } from '@/engine/intelMarket'

type PendingInput = {
  action: BaseAction | null
  finalShift: FinalShift
  useWildCard: boolean
}

type RoomPhase = 'LOBBY' | 'INTEL_PHASE' | 'SUBMITTING' | 'ROUND_RESULT' | 'GAME_OVER'

const MAX_PLAYERS = 8
const INTEL_PHASE_DURATION = 30_000 // 30 seconds

export class RoomManager {
  roomCode: string
  phase: RoomPhase = 'LOBBY'
  hostWs: WebSocket | null = null
  maxPlayers: number = MAX_PLAYERS

  // 玩家连接
  connections = new Map<PlayerId, WebSocket>()
  playerNames = new Map<PlayerId, string>()

  // 当前游戏使用的玩家 ID 列表（由实际人数决定）
  activePlayerIds: PlayerId[] = []

  // 游戏状态
  themeId: string | null = null
  theme: ThemeConfig | null = null
  global: GlobalState = { ...INITIAL_GLOBAL_STATE, eventQueue: [] }
  players: PlayerState[] = []
  pendingInputs: Record<string, PendingInput> = {}
  auditLogs: RoundAuditLog[] = []
  roundNarrations: string[] = []
  generatedIntel: RoundIntel[] = []
  intelTruth: Record<number, boolean[]> = {}
  generatedForecasts: MarketForecast[] = []
  pledges: Pledge[] = []
  pledgesHistory: Pledge[][] = []  // 每回合的立誓历史（供目标评估）
  objectives: Record<string, Objective> = {}  // 每人的秘密目标
  privateIntel: Record<string, PrivateIntel[]> = {}  // 每人每回合的私有情报
  pacts: Pact[] = []                                  // 当前回合的契约
  intelListings: IntelListing[] = []                  // 当前回合的情报市场
  private chatCooldowns: Map<PlayerId, number> = new Map()
  wildCards: Record<string, WildCard> = {}
  cpuPlayerIds: Set<PlayerId> = new Set()
  intelPhaseTimer: ReturnType<typeof setTimeout> | null = null
  intelPhaseEndsAt: number = 0
  beginnerMode: boolean = false
  pveMode: boolean = false
  bossId: PlayerId | null = null
  readyStartPlayers: Set<PlayerId> = new Set()
  readyNextPlayers: Set<PlayerId> = new Set()

  constructor() {
    this.roomCode = generateRoomCode()
  }

  // ── 获取玩家槽位 ──
  getPlayerSlots(): PlayerSlot[] {
    return ALL_PLAYER_IDS
      .filter(id => this.playerNames.has(id))
      .map(id => ({
        id,
        name: this.playerNames.get(id)!,
        connected: this.connections.has(id),
      }))
  }

  // ── 下一个空位 ──
  getNextAvailableSlot(): PlayerId | null {
    for (const id of ALL_PLAYER_IDS) {
      if (!this.playerNames.has(id)) return id
    }
    return null
  }

  // ── 获取当前活跃玩家 ID ──
  getActivePlayerIds(): PlayerId[] {
    return ALL_PLAYER_IDS.filter(id => this.playerNames.has(id))
  }

  // ── 处理消息 ──
  handleMessage(ws: WebSocket, raw: string) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      this.sendTo(ws, { type: 'ERROR', message: '无法解析消息' })
      return
    }

    if (msg.type === 'PING') {
      this.sendTo(ws, { type: 'PONG' })
      return
    }

    if (msg.type === 'JOIN') {
      this.handleJoin(ws, msg.playerName, msg.roomCode)
      return
    }

    // 以下消息需要找到发送者的 PlayerId
    const playerId = this.getPlayerIdByWs(ws)
    if (!playerId) {
      this.sendTo(ws, { type: 'ERROR', message: '未加入房间' })
      return
    }

    switch (msg.type) {
      case 'HOST_SELECT_THEME':
        if (playerId !== 'A') return
        this.handleSelectTheme(msg.themeId)
        break
      case 'HOST_START_GAME':
        if (playerId !== 'A') return
        this.beginnerMode = !!msg.beginnerMode
        this.pveMode = !!msg.pveMode
        // 不再直接开始游戏，改为通过 READY_START 投票系统
        break
      case 'HOST_SKIP_INTEL':
        if (playerId !== 'A') return
        this.handleSkipIntel()
        break
      case 'ACTION':
        this.handleAction(playerId, msg.action, msg.finalShift, msg.useWildCard)
        break
      case 'PLEDGE':
        this.handlePledge(playerId, msg.action)
        break
      case 'CLEAR_ACTION':
        this.handleClearAction(playerId)
        break
      case 'HOST_NEXT_ROUND':
        if (playerId !== 'A') return
        this.handleNextRound()
        break
      case 'HOST_RESET':
        if (playerId !== 'A') return
        this.handleReset()
        break
      case 'READY_START':
        this.handleReadyStart(playerId)
        break
      case 'READY_NEXT_ROUND':
        this.handleReadyNextRound(playerId)
        break
      case 'REACTION':
        this.handleReaction(playerId, msg.emoji, msg.phrase)
        break
      case 'CHAT':
        this.handleChat(playerId, msg.text)
        break
      case 'PROPOSE_PACT':
        this.handleProposePact(playerId, msg.targetId, msg.action)
        break
      case 'RESPOND_PACT':
        this.handleRespondPact(playerId, msg.pactId, msg.accept)
        break
      case 'LIST_INTEL':
        this.handleListIntel(playerId, msg.price)
        break
      case 'UNLIST_INTEL':
        this.handleUnlistIntel(playerId)
        break
      case 'BUY_INTEL':
        this.handleBuyIntel(playerId, msg.listingId)
        break
    }
  }

  // ── 情报市场：挂牌 ──
  handleListIntel(sellerId: PlayerId, price: number) {
    if (this.phase !== 'INTEL_PHASE' && this.phase !== 'SUBMITTING') return
    if (price < 10_000 || price > 500_000) return
    // 已挂牌过的不能再挂
    if (this.intelListings.find(l => l.sellerId === sellerId && !l.soldTo)) return

    const intelList = this.privateIntel[sellerId]
    if (!intelList) return
    const intel = intelList.find(i => i.round === this.global.roundNumber)
    if (!intel) return

    const sellerName = this.playerNames.get(sellerId) ?? `玩家${sellerId}`
    const listing: IntelListing = {
      id: makeListingId(),
      sellerId,
      sellerName,
      round: this.global.roundNumber,
      price,
      source: intel.source,
      reliability: intel.reliability,
      hintAction: intel.hintAction,
      stance: intel.stance,
    }
    this.intelListings.push(listing)
    this.broadcastMarketUpdate()
  }

  // ── 情报市场：撤回 ──
  handleUnlistIntel(sellerId: PlayerId) {
    const before = this.intelListings.length
    this.intelListings = this.intelListings.filter(l => !(l.sellerId === sellerId && !l.soldTo))
    if (this.intelListings.length !== before) this.broadcastMarketUpdate()
  }

  // ── 情报市场：购买 ──
  handleBuyIntel(buyerId: PlayerId, listingId: string) {
    const listing = this.intelListings.find(l => l.id === listingId)
    if (!listing || listing.soldTo) return
    if (listing.sellerId === buyerId) return  // 不能买自己的

    const intelList = this.privateIntel[listing.sellerId]
    const intel = intelList?.find(i => i.round === listing.round)
    if (!intel) return

    // 转账
    const buyer = this.players.find(p => p.id === buyerId)
    const seller = this.players.find(p => p.id === listing.sellerId)
    if (!buyer || !seller) return
    buyer.cumulativeProfit -= listing.price
    seller.cumulativeProfit += listing.price

    listing.soldTo = buyerId

    // 私聊买家：完整情报
    const buyerWs = this.connections.get(buyerId)
    if (buyerWs) {
      this.sendTo(buyerWs, {
        type: 'INTEL_PURCHASED',
        intel,
        from: listing.sellerId,
        price: listing.price,
      })
    }

    // 私聊卖家：被买了
    const sellerWs = this.connections.get(listing.sellerId)
    if (sellerWs) {
      const buyerName = this.playerNames.get(buyerId) ?? `玩家${buyerId}`
      this.sendTo(sellerWs, { type: 'INTEL_SOLD', price: listing.price, toName: buyerName })
    }

    this.broadcastMarketUpdate()
  }

  private broadcastMarketUpdate() {
    this.broadcast({ type: 'INTEL_MARKET', listings: this.intelListings })
  }

  // ── 公开聊天 ──
  handleChat(playerId: PlayerId, text: string) {
    const now = Date.now()
    const last = this.chatCooldowns.get(playerId) ?? 0
    if (now - last < 1500) return  // 1.5 秒冷却
    this.chatCooldowns.set(playerId, now)
    // 阶段限制：只在情报/出牌/结算阶段允许
    if (this.phase === 'LOBBY') return
    const safeText = (text || '').trim().slice(0, 40)
    if (!safeText) return
    const name = this.playerNames.get(playerId) ?? `玩家${playerId}`
    this.broadcast({
      type: 'CHAT',
      fromId: playerId,
      fromName: name,
      text: safeText,
      ts: now,
    })
  }

  // ── 提议契约 ──
  handleProposePact(proposerId: PlayerId, targetId: PlayerId, action: BaseAction) {
    if (this.phase !== 'INTEL_PHASE' && this.phase !== 'SUBMITTING') return
    if (proposerId === targetId) return
    if (!this.activePlayerIds.includes(targetId)) return
    if (this.cpuPlayerIds.has(targetId)) return  // 不能跟 CPU 立约

    // 每人每回合最多发起 1 个 pending 契约
    const existing = this.pacts.find(p => p.proposerId === proposerId && p.status === 'pending')
    if (existing) return

    const pact: Pact = {
      id: makePactId(),
      round: this.global.roundNumber,
      proposerId,
      targetId,
      action,
      status: 'pending',
      proposedAt: Date.now(),
    }
    this.pacts.push(pact)

    // 通知双方
    const proposerName = this.playerNames.get(proposerId) ?? `玩家${proposerId}`
    const targetName = this.playerNames.get(targetId) ?? `玩家${targetId}`
    const proposerWs = this.connections.get(proposerId)
    const targetWs = this.connections.get(targetId)
    if (proposerWs) this.sendTo(proposerWs, { type: 'PACT_PROPOSAL', pact, proposerName, targetName })
    if (targetWs) this.sendTo(targetWs, { type: 'PACT_PROPOSAL', pact, proposerName, targetName })
  }

  // ── 接受/拒绝契约 ──
  handleRespondPact(playerId: PlayerId, pactId: string, accept: boolean) {
    const pact = this.pacts.find(p => p.id === pactId)
    if (!pact || pact.status !== 'pending') return
    if (pact.targetId !== playerId) return  // 只有目标方可以响应
    pact.status = accept ? 'accepted' : 'declined'

    // 通知双方
    const proposerWs = this.connections.get(pact.proposerId)
    const targetWs = this.connections.get(pact.targetId)
    const update: ServerMessage = { type: 'PACT_UPDATE', pact }
    if (proposerWs) this.sendTo(proposerWs, update)
    if (targetWs) this.sendTo(targetWs, update)
  }

  // ── 表情反应广播 ──
  private reactionCooldowns: Map<PlayerId, number> = new Map()

  handleReaction(playerId: PlayerId, emoji: string, phrase?: string) {
    // 限制：每人 800ms 冷却防刷屏
    const now = Date.now()
    const last = this.reactionCooldowns.get(playerId) ?? 0
    if (now - last < 800) return
    this.reactionCooldowns.set(playerId, now)

    // 安全性：限制长度
    const safeEmoji = (emoji || '').slice(0, 8)
    const safePhrase = phrase ? phrase.slice(0, 20) : undefined
    if (!safeEmoji && !safePhrase) return

    const name = this.playerNames.get(playerId) ?? `玩家${playerId}`
    this.broadcast({
      type: 'REACTION',
      fromId: playerId,
      fromName: name,
      emoji: safeEmoji,
      phrase: safePhrase,
      ts: now,
    })
  }

  // ── 加入房间 ──
  handleJoin(ws: WebSocket, playerName: string, roomCode: string) {
    if (roomCode !== this.roomCode) {
      this.sendTo(ws, { type: 'ERROR', message: '房间号不正确' })
      return
    }

    // 检查是否是断线重连
    for (const [id, existingWs] of this.connections) {
      if (existingWs === ws) return // 已连接
    }

    // 检查是否有同名玩家断线，允许重连
    for (const [id, name] of this.playerNames) {
      if (name === playerName && !this.connections.has(id)) {
        this.connections.set(id, ws)
        this.sendTo(ws, { type: 'JOINED', playerId: id, roomCode: this.roomCode, players: this.getPlayerSlots() })
        this.broadcast({ type: 'LOBBY_UPDATE', players: this.getPlayerSlots() })

        // 如果游戏进行中，发送当前状态
        if (this.phase !== 'LOBBY') {
          this.sendCurrentState(id)
        }
        return
      }
    }

    const slot = this.getNextAvailableSlot()
    if (!slot) {
      this.sendTo(ws, { type: 'ERROR', message: '房间已满（最多4人）' })
      return
    }

    this.connections.set(slot, ws)
    this.playerNames.set(slot, playerName)

    // 第一个加入的是房主
    if (slot === 'A') {
      this.hostWs = ws
    }

    this.sendTo(ws, { type: 'JOINED', playerId: slot, roomCode: this.roomCode, players: this.getPlayerSlots() })
    this.broadcast({ type: 'LOBBY_UPDATE', players: this.getPlayerSlots() })
  }

  // ── 选择主题 ──
  handleSelectTheme(themeId: string) {
    this.themeId = themeId
    this.broadcast({ type: 'THEME_SELECTED', themeId })
  }

  // ── 开始游戏 ──
  handleStartGame() {
    if (this.playerNames.size < 1) return
    if (!this.themeId) return

    try {
      this.theme = getTheme(this.themeId)
    } catch {
      return
    }

    // 确定活跃玩家：真人 + 电脑补满至少4人
    const humanIds = this.getActivePlayerIds()
    const MIN_PLAYERS = 4
    this.cpuPlayerIds = new Set<PlayerId>()
    if (humanIds.length < MIN_PLAYERS) {
      const allIds: PlayerId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as PlayerId[]
      for (const id of allIds) {
        if (humanIds.length + this.cpuPlayerIds.size >= MIN_PLAYERS) break
        if (!humanIds.includes(id)) {
          this.cpuPlayerIds.add(id)
        }
      }
    }
    this.activePlayerIds = [...humanIds, ...this.cpuPlayerIds]
    // Sort by player ID order
    const idOrder: PlayerId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as PlayerId[]
    this.activePlayerIds.sort((a, b) => idOrder.indexOf(a) - idOrder.indexOf(b))
    const playerCount = this.activePlayerIds.length

    this.global = { ...INITIAL_GLOBAL_STATE, eventQueue: this.theme.events }

    // PvE 模式：选第一个 CPU 作为 Boss，初始份额加倍
    this.bossId = null
    if (this.pveMode) {
      const firstCpu = [...this.cpuPlayerIds][0] ?? null
      this.bossId = firstCpu
    }

    this.players = createInitialPlayerStates(playerCount).map(p => {
      const isCpu = this.cpuPlayerIds.has(p.id)
      const isBoss = this.pveMode && p.id === this.bossId
      const themeName = this.theme!.playerNames?.[p.id] ?? p.name
      const name = isBoss
        ? `🦖 巨头 ${themeName}`
        : isCpu
          ? `${themeName}🤖`
          : (this.playerNames.get(p.id) ?? themeName)
      return {
        ...p,
        name,
        // Boss 享受 40% 起始份额，其余玩家分剩下 60%
        marketShare: isBoss
          ? 0.40
          : (this.pveMode && this.bossId
              ? 0.60 / (playerCount - 1)
              : p.marketShare),
        // Boss 还附带初始品牌热度和动量
        brandHeat: isBoss ? 50 : p.brandHeat,
        marketMomentum: isBoss ? 1.5 : p.marketMomentum,
      }
    })
    this.resetPendingInputs()
    this.auditLogs = []
    this.roundNarrations = []
    this.phase = 'INTEL_PHASE'

    // 生成情报（旧系统兼容）
    this.generatedIntel = this.theme.generateIntel()
    this.intelTruth = {}
    for (const ri of this.generatedIntel) {
      this.intelTruth[ri.round] = ri.cards.map(c => c.isTrue)
    }

    // 生成市场风向
    this.generatedForecasts = this.theme.generateForecast()
    this.pledges = []

    // 分配暗牌
    this.wildCards = this.distributeWildCards(playerCount)

    // 分配秘密目标（每人一张）
    this.objectives = assignObjectives(this.activePlayerIds)
    this.pledgesHistory = []

    // 生成差异化私有情报
    this.privateIntel = generatePrivateIntel(this.activePlayerIds, INITIAL_GLOBAL_STATE.maxRounds)

    this.broadcast({
      type: 'GAME_START',
      themeId: this.themeId,
      global: this.global,
      players: this.players,
      forecasts: this.generatedForecasts,
      intel: this.generatedIntel,
      intelTruth: this.intelTruth,
      wildCards: this.wildCards,
      beginnerMode: this.beginnerMode,
      pveMode: this.pveMode,
      bossId: this.bossId,
    })

    // 私聊：给每个真人玩家发他的秘密目标
    for (const [playerId, ws] of this.connections.entries()) {
      const objective = this.objectives[playerId]
      if (objective) {
        this.sendTo(ws, { type: 'OBJECTIVE_ASSIGNED', objective })
      }
    }

    // 进入情报讨论阶段
    this.startIntelPhase()
  }

  // ── 提交动作 ──
  handleAction(playerId: PlayerId, action: BaseAction, finalShift: FinalShift, useWildCard?: boolean) {
    if (this.phase !== 'SUBMITTING') return

    this.pendingInputs[playerId] = { action, finalShift, useWildCard: !!useWildCard }
    this.broadcastRoundState()

    // 检查是否所有活跃玩家都提交了
    const allSubmitted = this.activePlayerIds.every(id => {
      // CPU 玩家由 scheduleCpuActions 处理
      if (this.cpuPlayerIds.has(id)) {
        return this.pendingInputs[id]?.action !== null
      }
      if (!this.connections.has(id)) {
        // 断线真人玩家自动选HOLD
        if (!this.pendingInputs[id] || this.pendingInputs[id].action === null) {
          this.pendingInputs[id] = { action: 'HOLD', finalShift: 'NONE', useWildCard: false }
        }
        return true
      }
      return this.pendingInputs[id]?.action !== null
    })

    if (allSubmitted) {
      this.resolveCurrentRound()
    }
  }

  // ── 撤回动作 ──
  handleClearAction(playerId: PlayerId) {
    if (this.phase !== 'SUBMITTING') return
    this.pendingInputs[playerId] = { action: null, finalShift: 'NONE', useWildCard: false }
    this.broadcastRoundState()
  }

  // ── 立誓 ──
  handlePledge(playerId: PlayerId, action: BaseAction | null) {
    if (this.phase !== 'SUBMITTING' && this.phase !== 'INTEL_PHASE') return
    this.pledges = this.pledges.filter(p => p.playerId !== playerId)
    if (action) {
      this.pledges.push({ playerId, pledgedAction: action })
    }
    if (this.phase === 'INTEL_PHASE') {
      this.broadcastIntelPhase()
    } else {
      this.broadcastRoundState()
    }
  }

  // ── 结算回合 ──
  resolveCurrentRound() {
    if (!this.theme) return

    const usedWildCardIds: PlayerId[] = []
    const inputs: RoundInput[] = this.activePlayerIds.map(id => {
      const pi = this.pendingInputs[id]
      const wc = this.wildCards[id]
      const useWild = pi?.useWildCard && wc && !wc.used
      if (useWild) usedWildCardIds.push(id)
      return {
        playerId: id,
        action: pi?.action ?? 'HOLD',
        finalShift: pi?.finalShift ?? 'NONE',
        wildCard: useWild ? wc.type : null,
      }
    })

    const currentIntel = this.generatedIntel.find(r => r.round === this.global.roundNumber)
    const roundIntelCards = currentIntel
      ? currentIntel.cards.map(card => ({ impliedAction: card.impliedAction, isTrue: card.isTrue }))
      : undefined

    // 风向参数
    const currentForecast = this.generatedForecasts.find(f => f.round === this.global.roundNumber) ?? null
    const forecastParam = currentForecast
      ? { signal: currentForecast.signal, isTrue: currentForecast.isTrue }
      : null
    const pledgeParam = this.pledges.length > 0 ? this.pledges : undefined

    const { newGlobal, newPlayers, auditLog } = resolveRound(
      this.global, this.players, inputs, roundIntelCards,
      this.theme.configOverrides, forecastParam, pledgeParam
    )
    const narration = generateRoundNarration(auditLog, this.players, this.theme)

    // 标记已使用的暗牌
    for (const id of usedWildCardIds) {
      if (this.wildCards[id]) {
        this.wildCards[id] = { ...this.wildCards[id], used: true }
      }
    }

    this.global = newGlobal
    this.players = newPlayers
    this.auditLogs.push(auditLog)
    this.roundNarrations.push(narration)
    this.pledgesHistory.push([...this.pledges])

    // ── 评估本回合的契约（已接受的）──
    const actualActions: Record<string, BaseAction> = {}
    for (const p of auditLog.players) {
      actualActions[p.id] = p.action
    }
    const acceptedPacts = this.pacts.filter(p => p.status === 'accepted')
    const pactResults: PactResult[] = []
    for (const pact of acceptedPacts) {
      const result = evaluatePact(pact, actualActions as Record<PlayerId, BaseAction>)
      pactResults.push(result)
      // 把奖励/惩罚加到玩家累计利润上
      const proposer = this.players.find(p => p.id === pact.proposerId)
      const target = this.players.find(p => p.id === pact.targetId)
      if (proposer) proposer.cumulativeProfit += result.proposerDelta
      if (target) target.cumulativeProfit += result.targetDelta
    }

    const isGameOver = auditLog.round >= INITIAL_GLOBAL_STATE.maxRounds

    // 保存本轮 forecast/pledges 供结果展示
    const roundForecast = currentForecast
    const roundPledges = [...this.pledges]

    if (isGameOver) {
      this.phase = 'GAME_OVER'

      // 评估每个人的秘密目标 + 把奖励加到 cumulativeProfit
      const objectiveResults: Record<string, ObjectiveResult> = {}
      for (const id of this.activePlayerIds) {
        const obj = this.objectives[id]
        if (!obj) continue
        const result = evaluateObjective(id, obj, this.players, this.auditLogs, this.pledgesHistory)
        objectiveResults[id] = result
        if (result.achieved) {
          const player = this.players.find(p => p.id === id)
          if (player) player.cumulativeProfit += obj.bonus
        }
      }

      const gameNarration = generateGameNarration(this.players, this.auditLogs, this.theme)
      this.broadcast({
        type: 'GAME_OVER',
        players: this.players,
        auditLogs: this.auditLogs,
        gameNarration,
        pledgesHistory: this.pledgesHistory,
      })
      // 单独广播目标结果（公开所有人的目标，强化"原来他是这么想的"恍然大悟感）
      this.broadcast({ type: 'OBJECTIVE_RESULTS', results: objectiveResults })
    } else {
      this.phase = 'ROUND_RESULT'
      this.broadcast({
        type: 'ROUND_RESULT',
        global: this.global,
        players: this.players,
        auditLog,
        narration,
        forecast: roundForecast,
        pledges: roundPledges,
      })
    }

    // 广播契约结果（如果有）
    if (pactResults.length > 0) {
      this.broadcast({ type: 'PACT_RESULTS', results: pactResults })
    }
    // 清空本回合的契约和情报市场
    this.pacts = []
    this.intelListings = []
    this.broadcastMarketUpdate()
  }

  // ── 下一回合 ─��
  handleNextRound() {
    if (this.phase !== 'ROUND_RESULT') return
    this.pledges = []
    this.resetPendingInputs()
    this.startIntelPhase()
  }

  // ── 情报讨论阶段 ──
  startIntelPhase() {
    this.phase = 'INTEL_PHASE'
    // 新手模式：不设倒计时（endsAt 设为极大值），由房主手动跳过
    this.intelPhaseEndsAt = this.beginnerMode ? Date.now() + 999_999_000 : Date.now() + INTEL_PHASE_DURATION

    // 广播 INTEL_PHASE
    this.broadcastIntelPhase()

    // 非新手模式：自动倒计时结束后进入出牌
    if (this.intelPhaseTimer) clearTimeout(this.intelPhaseTimer)
    if (!this.beginnerMode) {
      this.intelPhaseTimer = setTimeout(() => {
        if (this.phase === 'INTEL_PHASE') {
          this.endIntelPhase()
        }
      }, INTEL_PHASE_DURATION)
    }
  }

  endIntelPhase() {
    if (this.phase !== 'INTEL_PHASE') return
    if (this.intelPhaseTimer) {
      clearTimeout(this.intelPhaseTimer)
      this.intelPhaseTimer = null
    }
    this.phase = 'SUBMITTING'
    this.broadcastRoundState()
    // 电脑玩家延迟自动出牌
    this.scheduleCpuActions()
  }

  handleSkipIntel() {
    this.endIntelPhase()
  }

  broadcastIntelPhase() {
    const currentForecast = this.generatedForecasts.find(f => f.round === this.global.roundNumber) ?? null
    this.broadcast({
      type: 'INTEL_PHASE',
      global: this.global,
      players: this.players,
      currentForecast,
      pledges: this.pledges,
      endsAt: this.intelPhaseEndsAt,
    })
    // 私聊：每人发自己本回合的私有情报
    this.sendPrivateIntelForCurrentRound()
  }

  // 私聊每人本回合的私有情报
  private sendPrivateIntelForCurrentRound() {
    const round = this.global.roundNumber
    for (const [playerId, ws] of this.connections.entries()) {
      const intelList = this.privateIntel[playerId]
      if (!intelList) continue
      const intel = intelList.find(i => i.round === round)
      if (intel) {
        this.sendTo(ws, { type: 'PRIVATE_INTEL', intel })
      }
    }
  }

  // ── 重置游戏 ──
  handleReset() {
    if (this.intelPhaseTimer) { clearTimeout(this.intelPhaseTimer); this.intelPhaseTimer = null }
    this.phase = 'LOBBY'
    this.themeId = null
    this.theme = null
    this.auditLogs = []
    this.roundNarrations = []
    this.generatedIntel = []
    this.intelTruth = {}
    this.generatedForecasts = []
    this.pledges = []
    this.pledgesHistory = []
    this.objectives = {}
    this.privateIntel = {}
    this.pacts = []
    this.intelListings = []
    this.wildCards = {}
    this.cpuPlayerIds = new Set()
    this.beginnerMode = false
    this.pveMode = false
    this.bossId = null
    this.readyStartPlayers.clear()
    this.readyNextPlayers.clear()
    this.broadcast({ type: 'LOBBY_UPDATE', players: this.getPlayerSlots() })
  }

  // ── 准备开始（所有人就绪后开始游戏） ──
  handleReadyStart(playerId: PlayerId) {
    if (this.phase !== 'LOBBY' || !this.themeId) return
    this.readyStartPlayers.add(playerId)
    const humanIds = this.getHumanPlayerIds()
    this.broadcast({
      type: 'READY_UPDATE',
      readyPlayers: [...this.readyStartPlayers],
      totalHumans: humanIds.length,
      context: 'start',
    })
    // 所有真人都准备好了 → 开始游戏
    if (humanIds.every(id => this.readyStartPlayers.has(id))) {
      this.readyStartPlayers.clear()
      this.handleStartGame()
    }
  }

  // ── 准备下一回合（所有人就绪后进入下一回合） ──
  handleReadyNextRound(playerId: PlayerId) {
    if (this.phase !== 'ROUND_RESULT' && this.phase !== 'GAME_OVER') return
    this.readyNextPlayers.add(playerId)
    const humanIds = this.getHumanPlayerIds()
    this.broadcast({
      type: 'READY_UPDATE',
      readyPlayers: [...this.readyNextPlayers],
      totalHumans: humanIds.length,
      context: 'next_round',
    })
    // 所有真人都准备好了 → 下一回合
    if (humanIds.every(id => this.readyNextPlayers.has(id))) {
      this.readyNextPlayers.clear()
      this.handleNextRound()
    }
  }

  // 获取当前已连接的真人玩家 ID 列表
  private getHumanPlayerIds(): PlayerId[] {
    return [...this.connections.keys()].filter(id => !this.cpuPlayerIds.has(id))
  }

  // ── 广播回合状态 ──
  broadcastRoundState() {
    const pendingStatus: Record<string, boolean> = {}
    for (const id of this.activePlayerIds) {
      pendingStatus[id] = this.pendingInputs[id]?.action !== null
    }

    const currentForecast = this.generatedForecasts.find(f => f.round === this.global.roundNumber) ?? null
    this.broadcast({
      type: 'ROUND_STATE',
      phase: 'SUBMITTING',
      global: this.global,
      players: this.players,
      pendingStatus,
      currentForecast,
      pledges: this.pledges,
    })
  }

  // ── 断线重连时发送当前状态 ──
  sendCurrentState(playerId: PlayerId) {
    const ws = this.connections.get(playerId)
    if (!ws || !this.theme || !this.themeId) return

    // 先发游戏初始化
    this.sendTo(ws, {
      type: 'GAME_START',
      themeId: this.themeId,
      global: this.global,
      players: this.players,
      forecasts: this.generatedForecasts,
      intel: this.generatedIntel,
      intelTruth: this.intelTruth,
      wildCards: this.wildCards,
      beginnerMode: this.beginnerMode,
      pveMode: this.pveMode,
      bossId: this.bossId,
    })

    // 重发秘密目标
    const objective = this.objectives[playerId]
    if (objective) {
      this.sendTo(ws, { type: 'OBJECTIVE_ASSIGNED', objective })
    }

    // 重发当前回合的私有情报（如果游戏已开始）
    const intelList = this.privateIntel[playerId]
    const currentIntel = intelList?.find(i => i.round === this.global.roundNumber)
    if (currentIntel) {
      this.sendTo(ws, { type: 'PRIVATE_INTEL', intel: currentIntel })
    }

    // 再发当前阶段
    if (this.phase === 'INTEL_PHASE') {
      const currentForecast = this.generatedForecasts.find(f => f.round === this.global.roundNumber) ?? null
      this.sendTo(ws, {
        type: 'INTEL_PHASE',
        global: this.global,
        players: this.players,
        currentForecast,
        pledges: this.pledges,
        endsAt: this.intelPhaseEndsAt,
      })
    } else if (this.phase === 'SUBMITTING') {
      const pendingStatus: Record<string, boolean> = {}
      for (const id of this.activePlayerIds) {
        pendingStatus[id] = this.pendingInputs[id]?.action !== null
      }
      const currentForecast = this.generatedForecasts.find(f => f.round === this.global.roundNumber) ?? null
      this.sendTo(ws, {
        type: 'ROUND_STATE',
        phase: 'SUBMITTING',
        global: this.global,
        players: this.players,
        pendingStatus,
        currentForecast,
        pledges: this.pledges,
      })
    } else if (this.phase === 'ROUND_RESULT') {
      const auditLog = this.auditLogs[this.auditLogs.length - 1]
      const narration = this.roundNarrations[this.roundNarrations.length - 1] || ''
      const lastForecast = this.generatedForecasts.find(f => f.round === auditLog?.round) ?? null
      if (auditLog) {
        this.sendTo(ws, {
          type: 'ROUND_RESULT',
          global: this.global,
          players: this.players,
          auditLog,
          narration,
          forecast: lastForecast,
          pledges: this.pledges,
        })
      }
    } else if (this.phase === 'GAME_OVER') {
      const gameNarration = generateGameNarration(this.players, this.auditLogs, this.theme)
      this.sendTo(ws, {
        type: 'GAME_OVER',
        players: this.players,
        auditLogs: this.auditLogs,
        gameNarration,
      })
    }
  }

  // ── 处理断线 ──
  handleDisconnect(ws: WebSocket) {
    for (const [id, conn] of this.connections) {
      if (conn === ws) {
        this.connections.delete(id)
        this.broadcast({ type: 'LOBBY_UPDATE', players: this.getPlayerSlots() })
        break
      }
    }

    // 检查是否所有真人玩家都已断线
    const humanConnected = [...this.connections.keys()].filter(id => !this.cpuPlayerIds.has(id))
    if (humanConnected.length === 0) {
      console.log(`[房间 ${this.roomCode}] 所有玩家已退出，重置房间`)
      // 清理定时器
      if (this.intelPhaseTimer) { clearTimeout(this.intelPhaseTimer); this.intelPhaseTimer = null }
      // 重置所有状态
      this.phase = 'LOBBY'
      this.themeId = null
      this.theme = null
      this.hostWs = null
      this.connections.clear()
      this.playerNames.clear()
      this.activePlayerIds = []
      this.auditLogs = []
      this.roundNarrations = []
      this.generatedIntel = []
      this.intelTruth = {}
      this.generatedForecasts = []
      this.pledges = []
      this.wildCards = {}
      this.cpuPlayerIds = new Set()
      this.beginnerMode = false
      this.pendingInputs = {}
      // 生成新房间号
      this.roomCode = generateRoomCode()
      console.log(`[新房间号] ${this.roomCode}`)
    }
  }

  // ── 工具方法 ──

  private getPlayerIdByWs(ws: WebSocket): PlayerId | null {
    for (const [id, conn] of this.connections) {
      if (conn === ws) return id
    }
    return null
  }

  private resetPendingInputs() {
    this.pendingInputs = {}
    for (const id of this.activePlayerIds) {
      this.pendingInputs[id] = { action: null, finalShift: 'NONE', useWildCard: false }
    }
  }

  // ── 电脑玩家自动出牌 ──
  private scheduleCpuActions() {
    if (this.cpuPlayerIds.size === 0) return
    // 每个电脑玩家随机延迟 1-3 秒后出牌
    for (const cpuId of this.cpuPlayerIds) {
      const delay = 1000 + Math.random() * 2000
      setTimeout(() => {
        if (this.phase !== 'SUBMITTING') return
        if (this.pendingInputs[cpuId]?.action !== null) return
        const { action, finalShift, useWild } = this.cpuChooseAction(cpuId)
        this.pendingInputs[cpuId] = { action, finalShift, useWildCard: useWild }
        this.broadcastRoundState()
        // 重新检查是否所有人都提交了
        const allSubmitted = this.activePlayerIds.every(id =>
          this.pendingInputs[id]?.action !== null
        )
        if (allSubmitted) {
          this.resolveCurrentRound()
        }
      }, delay)
    }
  }

  /**
   * 高级 AI 策略：小型蒙特卡洛前瞻 + 规则启发式
   * 对每个可选动作模拟 N 次（假设对手随机），取期望净利润最高的
   */
  private cpuChooseAction(cpuId: PlayerId): { action: BaseAction; finalShift: FinalShift; useWild: boolean } {
    const player = this.players.find(p => p.id === cpuId)
    if (!player) return { action: 'HOLD', finalShift: 'NONE', useWild: false }

    const isFinalRound = this.global.roundNumber === this.global.maxRounds
    const roundsLeft = this.global.maxRounds - this.global.roundNumber
    const candidates: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
    const SIMS_PER_ACTION = 30 // 每个动作模拟 30 次

    // ── 收集其他已提交的真实动作 ──
    const knownActions: Record<string, BaseAction | null> = {}
    for (const id of this.activePlayerIds) {
      if (id === cpuId) continue
      knownActions[id] = this.pendingInputs[id]?.action ?? null
    }

    // ── 对手随机动作生成器 ──
    const randomOpAction = (): BaseAction => candidates[Math.floor(Math.random() * 4)]

    // ── 评估每个候选动作 ──
    const scores: Record<string, number> = {}
    for (const testAction of candidates) {
      let totalScore = 0

      for (let sim = 0; sim < SIMS_PER_ACTION; sim++) {
        // 构建本次模拟的输入
        const inputs: RoundInput[] = this.activePlayerIds.map(id => {
          if (id === cpuId) {
            return { playerId: id, action: testAction, finalShift: 'NONE' as FinalShift }
          }
          // 已提交的玩家用真实动作，未提交的随机
          const known = knownActions[id]
          return {
            playerId: id,
            action: known ?? randomOpAction(),
            finalShift: 'NONE' as FinalShift,
          }
        })

        try {
          const { newPlayers } = resolveRound(
            this.global, this.players, inputs,
            undefined, this.theme?.configOverrides
          )
          const me = newPlayers.find(p => p.id === cpuId)
          if (me) {
            // 综合评分：利润 + 份额价值
            const profitGain = me.cumulativeProfit - player.cumulativeProfit
            const shareValue = (me.marketShare - player.marketShare) * 500000 // 份额折算价值
            totalScore += profitGain + shareValue
          }
        } catch {
          // 模拟失败忽略
        }
      }
      scores[testAction] = totalScore / SIMS_PER_ACTION
    }

    // ── 规则修正：长期战略加成 ──
    // QUA 加分：品质投资有延迟收益，模拟只看一步会低估
    if (roundsLeft >= 2) {
      scores['QUA'] += 15000 * roundsLeft // 越早研发越有价值
    }
    // 品质蓄量高时 QUA 的爆发价值
    if (player.qualityCharge >= 2 && isFinalRound) {
      scores['QUA'] += 30000
    }

    // MKT 加分：品牌热度有累积效应
    if (player.brandHeat < 40 && roundsLeft >= 2) {
      scores['MKT'] += 10000
    }

    // ATK 冷却惩罚：连续 ATK 效率衰减
    if (player.lastAction === 'ATK') {
      scores['ATK'] *= 0.85
    }

    // HOLD 惩罚：连续 HOLD 的动量损失和压力成本
    if (player.consecutiveHoldCount >= 1) {
      scores['HOLD'] -= 8000 * player.consecutiveHoldCount
    }

    // 落后追赶：份额低于均值时加大进攻倾向
    const avgShare = 1 / this.activePlayerIds.length
    if (player.marketShare < avgShare * 0.8) {
      scores['ATK'] += 20000
      scores['MKT'] += 15000
    }

    // 领先保护：份额远高于均值时品质和守势更有价值
    if (player.marketShare > avgShare * 1.3) {
      scores['QUA'] += 12000
      scores['HOLD'] += 8000
    }

    // ── 选择最优动作 ──
    let bestAction: BaseAction = 'HOLD'
    let bestScore = -Infinity
    for (const a of candidates) {
      // 添加微小随机扰动，避免完全确定性
      const finalScore = scores[a] + (Math.random() - 0.5) * 3000
      if (finalScore > bestScore) {
        bestScore = finalScore
        bestAction = a
      }
    }

    // ── 终盘转向：基于条件选最佳 ──
    let finalShift: FinalShift = 'NONE'
    if (isFinalRound) {
      // 品质蓄量 ≥ 1 → QUALITY_CONVERT（爆发力极强）
      if (player.qualityCharge >= 1 && bestAction === 'QUA') {
        finalShift = 'QUALITY_CONVERT'
      }
      // 品牌热度高 → BRAND_MONETIZE
      else if (player.brandHeat >= 50 && (bestAction === 'MKT' || bestAction === 'HOLD')) {
        finalShift = 'BRAND_MONETIZE'
      }
      // 落后大 → FINAL_PUSH 全力冲刺
      else if (player.marketShare < avgShare * 0.85) {
        finalShift = 'FINAL_PUSH'
      }
      // 领先选 HOLD → DEFENSIVE_LOCK
      else if (bestAction === 'HOLD' && player.marketShare > avgShare * 1.2) {
        finalShift = 'DEFENSIVE_LOCK'
      }
      // 默认用 FINAL_PUSH（除非 HOLD）
      else if (bestAction !== 'HOLD') {
        finalShift = Math.random() < 0.6 ? 'FINAL_PUSH' : 'NONE'
      }
    }

    // ── 暗牌策略 ──
    const wc = this.wildCards[cpuId]
    let useWild = false
    if (wc && !wc.used) {
      // 根据暗牌类型和当前状况决定使用时机
      switch (wc.type) {
        case 'DOUBLE_DOWN':
          // 高利润回合使用（终盘或赌注倍数高时）
          useWild = isFinalRound || this.global.roundNumber >= 4
          break
        case 'COST_CUT':
          // 高成本动作时使用（QUA 成本 75k, MKT 成本 50k）
          useWild = bestAction === 'QUA' || bestAction === 'MKT'
          break
        case 'SHIELD':
          // 领先且可能被抢份额时使用
          useWild = player.marketShare > avgShare * 1.1
          break
        case 'MOMENTUM_SURGE':
          // 配合 MKT 使用效果最佳
          useWild = bestAction === 'MKT'
          break
        case 'QUALITY_BOOST':
          // 品质投资时使用
          useWild = bestAction === 'QUA' || isFinalRound
          break
        case 'SCOUT':
          // 竞争激烈或落后时使用（+4 竞争力很强）
          useWild = player.marketShare < avgShare || isFinalRound
          break
        default:
          useWild = isFinalRound
      }
    }

    return { action: bestAction, finalShift, useWild }
  }

  private distributeWildCards(playerCount: number): Record<string, WildCard> {
    const ids = this.activePlayerIds
    const pool = [...WILD_CARD_POOL]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const result: Record<string, WildCard> = {}
    for (let i = 0; i < ids.length; i++) {
      const card = pool[i % pool.length]
      result[ids[i]] = { ...card, used: false }
    }
    return result
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg)
    for (const ws of this.connections.values()) {
      try { ws.send(data) } catch { /* 忽略发送失败 */ }
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    try { ws.send(JSON.stringify(msg)) } catch { /* 忽略 */ }
  }
}
