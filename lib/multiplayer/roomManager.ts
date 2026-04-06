// =====================
// 弈战 - 房间管理器（服务端）
// =====================

import type { WebSocket } from 'ws'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, RoundInput } from '@/engine/types'
import { ALL_PLAYER_IDS } from '@/engine/types'
import { createInitialPlayerStates, INITIAL_GLOBAL_STATE } from '@/engine/constants'
import { resolveRound } from '@/engine/resolveRound'
import { generateRoundNarration, generateGameNarration } from '@/engine/resolveGame'
import { getTheme } from '@/engine/themes'
import type { ThemeConfig, RoundIntel } from '@/engine/themes/types'
import type { ClientMessage, ServerMessage, PlayerSlot } from './protocol'
import { generateRoomCode } from './protocol'

type PendingInput = {
  action: BaseAction | null
  finalShift: FinalShift
}

type RoomPhase = 'LOBBY' | 'SUBMITTING' | 'ROUND_RESULT' | 'GAME_OVER'

const MAX_PLAYERS = 8

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
        this.handleStartGame()
        break
      case 'ACTION':
        this.handleAction(playerId, msg.action, msg.finalShift)
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
    }
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
    if (this.playerNames.size < 2) return
    if (!this.themeId) return

    try {
      this.theme = getTheme(this.themeId)
    } catch {
      return
    }

    // 确定活跃玩家（只使用已加入的真人玩家，不再填充 AI）
    this.activePlayerIds = this.getActivePlayerIds()
    const playerCount = this.activePlayerIds.length

    this.global = { ...INITIAL_GLOBAL_STATE, eventQueue: this.theme.events }
    this.players = createInitialPlayerStates(playerCount).map(p => ({
      ...p,
      name: this.playerNames.get(p.id) ?? this.theme!.playerNames?.[p.id] ?? p.name,
    }))
    this.resetPendingInputs()
    this.auditLogs = []
    this.roundNarrations = []
    this.phase = 'SUBMITTING'

    // 生成情报
    this.generatedIntel = this.theme.generateIntel()
    this.intelTruth = {}
    for (const ri of this.generatedIntel) {
      this.intelTruth[ri.round] = ri.cards.map(c => c.isTrue)
    }

    this.broadcast({
      type: 'GAME_START',
      themeId: this.themeId,
      global: this.global,
      players: this.players,
      intel: this.generatedIntel,
      intelTruth: this.intelTruth,
    })

    // 发送初始回合状态
    this.broadcastRoundState()
  }

  // ── 提交动作 ──
  handleAction(playerId: PlayerId, action: BaseAction, finalShift: FinalShift) {
    if (this.phase !== 'SUBMITTING') return

    this.pendingInputs[playerId] = { action, finalShift }
    this.broadcastRoundState()

    // 检查是否所有活跃玩家都提交了
    const allSubmitted = this.activePlayerIds.every(id => {
      if (!this.connections.has(id)) {
        // 断线玩家自动选HOLD
        if (!this.pendingInputs[id] || this.pendingInputs[id].action === null) {
          this.pendingInputs[id] = { action: 'HOLD', finalShift: 'NONE' }
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
    this.pendingInputs[playerId] = { action: null, finalShift: 'NONE' }
    this.broadcastRoundState()
  }

  // ── 结算回合 ──
  resolveCurrentRound() {
    if (!this.theme) return

    const inputs: RoundInput[] = this.activePlayerIds.map(id => ({
      playerId: id,
      action: this.pendingInputs[id]?.action ?? 'HOLD',
      finalShift: this.pendingInputs[id]?.finalShift ?? 'NONE',
    }))

    const currentIntel = this.generatedIntel.find(r => r.round === this.global.roundNumber)
    const roundIntelCards = currentIntel
      ? currentIntel.cards.map(card => ({ impliedAction: card.impliedAction, isTrue: card.isTrue }))
      : undefined

    const { newGlobal, newPlayers, auditLog } = resolveRound(this.global, this.players, inputs, roundIntelCards)
    const narration = generateRoundNarration(auditLog, this.players, this.theme)

    this.global = newGlobal
    this.players = newPlayers
    this.auditLogs.push(auditLog)
    this.roundNarrations.push(narration)

    const isGameOver = auditLog.round >= INITIAL_GLOBAL_STATE.maxRounds

    if (isGameOver) {
      this.phase = 'GAME_OVER'
      const gameNarration = generateGameNarration(this.players, this.auditLogs, this.theme)
      this.broadcast({
        type: 'GAME_OVER',
        players: this.players,
        auditLogs: this.auditLogs,
        gameNarration,
      })
    } else {
      this.phase = 'ROUND_RESULT'
      this.broadcast({
        type: 'ROUND_RESULT',
        global: this.global,
        players: this.players,
        auditLog,
        narration,
      })
    }
  }

  // ── 下一回合 ──
  handleNextRound() {
    if (this.phase !== 'ROUND_RESULT') return
    this.phase = 'SUBMITTING'
    this.resetPendingInputs()
    this.broadcastRoundState()
  }

  // ── 重置游戏 ──
  handleReset() {
    this.phase = 'LOBBY'
    this.themeId = null
    this.theme = null
    this.auditLogs = []
    this.roundNarrations = []
    this.generatedIntel = []
    this.intelTruth = {}
    this.broadcast({ type: 'LOBBY_UPDATE', players: this.getPlayerSlots() })
  }

  // ── 广播回合状态 ──
  broadcastRoundState() {
    const pendingStatus: Record<string, boolean> = {}
    for (const id of this.activePlayerIds) {
      pendingStatus[id] = this.pendingInputs[id]?.action !== null
    }

    this.broadcast({
      type: 'ROUND_STATE',
      phase: 'SUBMITTING',
      global: this.global,
      players: this.players,
      pendingStatus,
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
      intel: this.generatedIntel,
      intelTruth: this.intelTruth,
    })

    // 再发当前阶段
    if (this.phase === 'SUBMITTING') {
      const pendingStatus: Record<string, boolean> = {}
      for (const id of this.activePlayerIds) {
        pendingStatus[id] = this.pendingInputs[id]?.action !== null
      }
      this.sendTo(ws, {
        type: 'ROUND_STATE',
        phase: 'SUBMITTING',
        global: this.global,
        players: this.players,
        pendingStatus,
      })
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
      this.pendingInputs[id] = { action: null, finalShift: 'NONE' }
    }
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
