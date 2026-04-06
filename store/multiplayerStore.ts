// =====================
// 弈战 - 多人联机状态
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog } from '@/engine/types'
import type { RoundIntel } from '@/engine/themes/types'
import type { PlayerSlot, ServerMessage } from '@/lib/multiplayer/protocol'
import { wsClient } from '@/lib/multiplayer/wsClient'

export type MultiplayerPhase =
  | 'MODE_SELECT'   // 选择模式
  | 'LOBBY'         // 大厅等待
  | 'THEME_SELECT'  // 房主选主题
  | 'SUBMITTING'    // 出牌中
  | 'ROUND_RESULT'  // 结算展示
  | 'GAME_OVER'     // 终局

export type GameMode = 'local' | 'host' | 'player'

type MultiplayerStore = {
  mode: GameMode | null
  phase: MultiplayerPhase
  roomCode: string | null
  hostIp: string | null
  myPlayerId: PlayerId | null
  lobbyPlayers: PlayerSlot[]
  connected: boolean
  error: string | null

  // 游戏数据（从服务器同步）
  themeId: string | null
  global: GlobalState | null
  players: PlayerState[]
  pendingStatus: Record<string, boolean>
  generatedIntel: RoundIntel[]
  intelTruth: Record<number, boolean[]>
  currentAuditLog: RoundAuditLog | null
  currentNarration: string
  allAuditLogs: RoundAuditLog[]
  gameNarration: string

  // Actions
  setMode: (mode: GameMode) => void
  hostGame: (playerName: string) => Promise<void>
  joinGame: (host: string, port: number, roomCode: string, playerName: string) => Promise<void>
  selectTheme: (themeId: string) => void
  startGame: () => void
  submitAction: (action: BaseAction, finalShift: FinalShift) => void
  clearAction: () => void
  nextRound: () => void
  resetGame: () => void
  backToModeSelect: () => void
  handleServerMessage: (msg: ServerMessage) => void
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  mode: null,
  phase: 'MODE_SELECT',
  roomCode: null,
  hostIp: null,
  myPlayerId: null,
  lobbyPlayers: [],
  connected: false,
  error: null,

  themeId: null,
  global: null,
  players: [],
  pendingStatus: {},
  generatedIntel: [],
  intelTruth: {},
  currentAuditLog: null,
  currentNarration: '',
  allAuditLogs: [],
  gameNarration: '',

  setMode: (mode) => {
    set({ mode, phase: mode === 'local' ? 'MODE_SELECT' : 'MODE_SELECT' })
  },

  hostGame: async (playerName) => {
    try {
      // 获取网络信息
      const res = await fetch('/api/network-info')
      const info = await res.json()

      // 连接自己的 WebSocket
      await wsClient.connect(window.location.hostname, info.port)

      // 监听消息
      wsClient.onMessage((msg) => get().handleServerMessage(msg))

      // 加入房间
      wsClient.send({ type: 'JOIN', playerName, roomCode: info.roomCode })

      set({
        mode: 'host',
        phase: 'LOBBY',
        roomCode: info.roomCode,
        hostIp: info.ip,
        connected: true,
        error: null,
      })
    } catch (err) {
      set({ error: '创建房间失败' })
    }
  },

  joinGame: async (host, port, roomCode, playerName) => {
    try {
      await wsClient.connect(host, port)
      wsClient.onMessage((msg) => get().handleServerMessage(msg))
      wsClient.send({ type: 'JOIN', playerName, roomCode })

      set({
        mode: 'player',
        phase: 'LOBBY',
        roomCode,
        connected: true,
        error: null,
      })
    } catch {
      set({ error: '连接失败，请检查地址和房间号' })
    }
  },

  selectTheme: (themeId) => {
    wsClient.send({ type: 'HOST_SELECT_THEME', themeId })
  },

  startGame: () => {
    wsClient.send({ type: 'HOST_START_GAME' })
  },

  submitAction: (action, finalShift) => {
    wsClient.send({ type: 'ACTION', action, finalShift })
  },

  clearAction: () => {
    wsClient.send({ type: 'CLEAR_ACTION' })
  },

  nextRound: () => {
    wsClient.send({ type: 'HOST_NEXT_ROUND' })
  },

  resetGame: () => {
    wsClient.send({ type: 'HOST_RESET' })
  },

  backToModeSelect: () => {
    wsClient.disconnect()
    set({
      mode: null,
      phase: 'MODE_SELECT',
      roomCode: null,
      hostIp: null,
      myPlayerId: null,
      lobbyPlayers: [],
      connected: false,
      error: null,
      themeId: null,
      global: null,
      players: [],
      pendingStatus: {},
      generatedIntel: [],
      intelTruth: {},
      currentAuditLog: null,
      currentNarration: '',
      allAuditLogs: [],
      gameNarration: '',
    })
  },

  handleServerMessage: (msg) => {
    switch (msg.type) {
      case 'JOINED':
        set({
          myPlayerId: msg.playerId,
          roomCode: msg.roomCode,
          lobbyPlayers: msg.players,
        })
        break

      case 'LOBBY_UPDATE':
        set({ lobbyPlayers: msg.players, phase: 'LOBBY' })
        break

      case 'THEME_SELECTED':
        set({ themeId: msg.themeId, phase: 'THEME_SELECT' })
        break

      case 'GAME_START':
        set({
          themeId: msg.themeId,
          global: msg.global,
          players: msg.players,
          generatedIntel: msg.intel,
          intelTruth: msg.intelTruth,
          phase: 'SUBMITTING',
          allAuditLogs: [],
          gameNarration: '',
        })
        break

      case 'ROUND_STATE':
        set({
          phase: 'SUBMITTING',
          global: msg.global,
          players: msg.players,
          pendingStatus: msg.pendingStatus,
        })
        break

      case 'ROUND_RESULT':
        set(state => ({
          phase: 'ROUND_RESULT',
          global: msg.global,
          players: msg.players,
          currentAuditLog: msg.auditLog,
          currentNarration: msg.narration,
          allAuditLogs: [...state.allAuditLogs, msg.auditLog],
        }))
        break

      case 'GAME_OVER':
        set({
          phase: 'GAME_OVER',
          players: msg.players,
          allAuditLogs: msg.auditLogs,
          gameNarration: msg.gameNarration,
        })
        break

      case 'ERROR':
        set({ error: msg.message })
        break
    }
  },
}))
