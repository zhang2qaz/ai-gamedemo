// =====================
// 弈战 - 多人联机状态
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, MarketForecast, Pledge, WildCard } from '@/engine/types'
import type { RoundIntel } from '@/engine/themes/types'
import type { PlayerSlot, ServerMessage } from '@/lib/multiplayer/protocol'
import { wsClient } from '@/lib/multiplayer/wsClient'
import type { ThemeConfig } from '@/engine/themes/types'
import { getTheme } from '@/engine/themes'
import { useGameStore } from '@/store/gameStore'

export type MultiplayerPhase =
  | 'MODE_SELECT'   // 选择模式
  | 'LOBBY'         // 大厅等待
  | 'THEME_SELECT'  // 房主选主题
  | 'INTEL_PHASE'   // 风向讨论
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

  // 风向与立誓
  generatedForecasts: MarketForecast[]
  currentForecast: MarketForecast | null
  pledges: Pledge[]
  lastRoundForecast: MarketForecast | null
  lastRoundPledges: Pledge[]

  // 暗牌
  wildCards: Record<string, WildCard>
  useWildCard: boolean

  // 情报阶段
  intelPhaseEndsAt: number
  beginnerMode: boolean

  // 准备状态（所有人投票）
  readyPlayers: string[]
  readyTotal: number
  readyContext: 'start' | 'next_round' | null

  // 回合间对比 & UI
  prevRoundPlayers: PlayerState[]
  prevRoundGlobal: GlobalState | null
  showAuditLog: boolean
  theme: ThemeConfig | null

  // Actions
  setMode: (mode: GameMode) => void
  setBeginnerMode: (v: boolean) => void
  hostGame: (playerName: string) => Promise<void>
  joinGame: (host: string, port: number, roomCode: string, playerName: string) => Promise<void>
  selectTheme: (themeId: string) => void
  startGame: (beginnerMode?: boolean) => void
  submitAction: (action: BaseAction, finalShift: FinalShift) => void
  submitPledge: (action: BaseAction | null) => void
  toggleWildCard: () => void
  skipIntel: () => void
  clearAction: () => void
  nextRound: () => void
  readyStart: () => void
  readyNextRound: () => void
  resetGame: () => void
  backToModeSelect: () => void
  toggleAuditLog: () => void
  handleServerMessage: (msg: ServerMessage) => void
}

const INITIAL_STATE = {
  mode: null as GameMode | null,
  phase: 'MODE_SELECT' as MultiplayerPhase,
  roomCode: null as string | null,
  hostIp: null as string | null,
  myPlayerId: null as PlayerId | null,
  lobbyPlayers: [] as PlayerSlot[],
  connected: false,
  error: null as string | null,
  themeId: null as string | null,
  global: null as GlobalState | null,
  players: [] as PlayerState[],
  pendingStatus: {} as Record<string, boolean>,
  generatedIntel: [] as RoundIntel[],
  intelTruth: {} as Record<number, boolean[]>,
  currentAuditLog: null as RoundAuditLog | null,
  currentNarration: '',
  allAuditLogs: [] as RoundAuditLog[],
  gameNarration: '',
  generatedForecasts: [] as MarketForecast[],
  currentForecast: null as MarketForecast | null,
  pledges: [] as Pledge[],
  lastRoundForecast: null as MarketForecast | null,
  lastRoundPledges: [] as Pledge[],
  wildCards: {} as Record<string, WildCard>,
  useWildCard: false,
  intelPhaseEndsAt: 0,
  beginnerMode: false,
  readyPlayers: [] as string[],
  readyTotal: 0,
  readyContext: null as 'start' | 'next_round' | null,
  prevRoundPlayers: [] as PlayerState[],
  prevRoundGlobal: null as GlobalState | null,
  showAuditLog: false,
  theme: null as ThemeConfig | null,
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  ...INITIAL_STATE,

  setMode: (mode) => {
    set({ mode, phase: mode === 'local' ? 'MODE_SELECT' : 'MODE_SELECT' })
  },

  setBeginnerMode: (v) => set({ beginnerMode: v }),

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

  startGame: (beginnerMode) => {
    wsClient.send({ type: 'HOST_START_GAME', beginnerMode })
  },

  submitAction: (action, finalShift) => {
    const state = get()
    wsClient.send({ type: 'ACTION', action, finalShift, useWildCard: state.useWildCard })
  },

  submitPledge: (action) => {
    wsClient.send({ type: 'PLEDGE', action })
  },

  toggleWildCard: () => {
    set(s => ({ useWildCard: !s.useWildCard }))
  },

  skipIntel: () => {
    wsClient.send({ type: 'HOST_SKIP_INTEL' })
  },

  clearAction: () => {
    wsClient.send({ type: 'CLEAR_ACTION' })
    set({ useWildCard: false })
  },

  nextRound: () => {
    wsClient.send({ type: 'HOST_NEXT_ROUND' })
  },

  readyStart: () => {
    const state = get()
    // 房主先发送配置（新手模式），再投票准备
    if (state.mode === 'host') {
      wsClient.send({ type: 'HOST_START_GAME', beginnerMode: state.beginnerMode })
    }
    wsClient.send({ type: 'READY_START' })
  },

  readyNextRound: () => {
    wsClient.send({ type: 'READY_NEXT_ROUND' })
  },

  resetGame: () => {
    wsClient.send({ type: 'HOST_RESET' })
  },

  toggleAuditLog: () => {
    set(s => ({ showAuditLog: !s.showAuditLog }))
  },

  backToModeSelect: () => {
    wsClient.disconnect()
    // 清除 gameStore 里同步过去的主题
    useGameStore.setState({ theme: null, themeId: null })
    set({ ...INITIAL_STATE })
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

      case 'THEME_SELECTED': {
        let theme: ThemeConfig | null = null
        try { theme = getTheme(msg.themeId) } catch {}
        // 同步主题到 gameStore，让所有共享组件读到正确主题
        useGameStore.setState({ theme, themeId: msg.themeId })
        set({ themeId: msg.themeId, theme, phase: 'THEME_SELECT' })
        break
      }

      case 'GAME_START': {
        let theme: ThemeConfig | null = null
        try { theme = getTheme(msg.themeId) } catch {}
        // 同步主题到 gameStore，让所有共享组件（RoundResultPanel/ShareBar/PlayerCard 等）读到正确主题
        useGameStore.setState({ theme, themeId: msg.themeId })
        set({
          themeId: msg.themeId,
          theme,
          global: msg.global,
          players: msg.players,
          generatedForecasts: msg.forecasts,
          currentForecast: msg.forecasts.find(f => f.round === 1) ?? null,
          pledges: [],
          lastRoundForecast: null,
          lastRoundPledges: [],
          generatedIntel: msg.intel,
          intelTruth: msg.intelTruth,
          phase: 'SUBMITTING',
          allAuditLogs: [],
          currentAuditLog: null,
          currentNarration: '',
          gameNarration: '',
          wildCards: msg.wildCards ?? {},
          useWildCard: false,
          beginnerMode: msg.beginnerMode ?? false,
          readyPlayers: [],
          readyTotal: 0,
          readyContext: null,
          prevRoundPlayers: [],
          prevRoundGlobal: null,
          showAuditLog: false,
        })
        break
      }

      case 'INTEL_PHASE':
        set({
          phase: 'INTEL_PHASE',
          global: msg.global,
          players: msg.players,
          currentForecast: msg.currentForecast,
          pledges: msg.pledges,
          intelPhaseEndsAt: msg.endsAt,
          useWildCard: false,       // 新回合重置暗牌选择
          pendingStatus: {},        // 新回合重置提交状态
          readyPlayers: [],         // 新回合重置准备状态
          readyTotal: 0,
          readyContext: null,
        })
        break

      case 'ROUND_STATE':
        set(state => ({
          phase: 'SUBMITTING',
          global: msg.global,
          players: msg.players,
          pendingStatus: msg.pendingStatus,
          currentForecast: msg.currentForecast,
          pledges: msg.pledges,
          // Reset useWildCard if it's a new round (player not yet submitted)
          useWildCard: msg.pendingStatus[state.myPlayerId ?? ''] ? state.useWildCard : false,
        }))
        break

      case 'ROUND_RESULT':
        set(state => {
          // Mark wild card as used if it was activated this round
          const newWildCards = { ...state.wildCards }
          if (state.useWildCard && state.myPlayerId && newWildCards[state.myPlayerId]) {
            newWildCards[state.myPlayerId] = { ...newWildCards[state.myPlayerId], used: true }
          }
          return {
            phase: 'ROUND_RESULT',
            prevRoundPlayers: state.players,
            prevRoundGlobal: state.global,
            global: msg.global,
            players: msg.players,
            currentAuditLog: msg.auditLog,
            currentNarration: msg.narration,
            allAuditLogs: [...state.allAuditLogs, msg.auditLog],
            lastRoundForecast: msg.forecast,
            lastRoundPledges: msg.pledges,
            wildCards: newWildCards,
            useWildCard: false,
          }
        })
        break

      case 'GAME_OVER':
        set({
          phase: 'GAME_OVER',
          players: msg.players,
          allAuditLogs: msg.auditLogs,
          gameNarration: msg.gameNarration,
        })
        break

      case 'READY_UPDATE':
        set({
          readyPlayers: msg.readyPlayers,
          readyTotal: msg.totalHumans,
          readyContext: msg.context,
        })
        break

      case 'ERROR':
        set({ error: msg.message })
        break
    }
  },
}))
