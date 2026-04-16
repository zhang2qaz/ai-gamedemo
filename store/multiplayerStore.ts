// =====================
// 弈战 - 多人联机状态
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, MarketForecast, Pledge, WildCard } from '@/engine/types'
import type { RoundIntel } from '@/engine/themes/types'
import type { Objective, ObjectiveResult } from '@/engine/objectives'
import type { PrivateIntel } from '@/engine/privateIntel'
import type { Pact, PactResult } from '@/engine/pacts'
import type { IntelListing } from '@/engine/intelMarket'
import { incrementStat } from '@/lib/gameHistory'
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

export type Reaction = {
  id: string
  fromId: PlayerId
  fromName: string
  emoji: string
  phrase?: string
  ts: number
}

export type ChatMessage = {
  id: string
  fromId: PlayerId
  fromName: string
  text: string
  ts: number
}

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
  pledgesHistory: Pledge[][]
  lastRoundForecast: MarketForecast | null
  lastRoundPledges: Pledge[]

  // 暗牌
  wildCards: Record<string, WildCard>
  useWildCard: boolean

  // 情报阶段
  intelPhaseEndsAt: number
  beginnerMode: boolean

  // PvE 巨头模式
  pveMode: boolean
  bossId: PlayerId | null

  // 准备状态（所有人投票）
  readyPlayers: string[]
  readyTotal: number
  readyContext: 'start' | 'next_round' | null

  // 实时表情/短语（归属感）
  reactions: Reaction[]

  // 秘密目标（自主感）
  myObjective: Objective | null
  objectiveResults: Record<string, ObjectiveResult> | null

  // 差异化私有情报（自主感）
  myPrivateIntel: PrivateIntel | null

  // 公开聊天 + 双人契约（归属感 / 自主感）
  chatMessages: ChatMessage[]
  pacts: Pact[]
  lastPactResults: PactResult[]
  intelListings: IntelListing[]
  purchasedIntel: PrivateIntel[]   // 我买到的别人的情报
  lastSoldNotice: { price: number; toName: string } | null

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
  startGame: (beginnerMode?: boolean, pveMode?: boolean) => void
  setPveMode: (v: boolean) => void
  submitAction: (action: BaseAction, finalShift: FinalShift) => void
  submitPledge: (action: BaseAction | null) => void
  toggleWildCard: () => void
  skipIntel: () => void
  clearAction: () => void
  nextRound: () => void
  readyStart: () => void
  readyNextRound: () => void
  sendReaction: (emoji: string, phrase?: string) => void
  dismissReaction: (id: string) => void
  sendChat: (text: string) => void
  proposePact: (targetId: PlayerId, action: BaseAction) => void
  respondPact: (pactId: string, accept: boolean) => void
  listIntel: (price: number) => void
  unlistIntel: () => void
  buyIntel: (listingId: string) => void
  dismissSoldNotice: () => void
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
  pledgesHistory: [] as Pledge[][],
  lastRoundForecast: null as MarketForecast | null,
  lastRoundPledges: [] as Pledge[],
  wildCards: {} as Record<string, WildCard>,
  useWildCard: false,
  intelPhaseEndsAt: 0,
  beginnerMode: false,
  pveMode: false,
  bossId: null as PlayerId | null,
  readyPlayers: [] as string[],
  readyTotal: 0,
  readyContext: null as 'start' | 'next_round' | null,
  reactions: [] as Reaction[],
  myObjective: null as Objective | null,
  objectiveResults: null as Record<string, ObjectiveResult> | null,
  myPrivateIntel: null as PrivateIntel | null,
  chatMessages: [] as ChatMessage[],
  pacts: [] as Pact[],
  lastPactResults: [] as PactResult[],
  intelListings: [] as IntelListing[],
  purchasedIntel: [] as PrivateIntel[],
  lastSoldNotice: null as { price: number; toName: string } | null,
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
  setPveMode: (v) => set({ pveMode: v }),

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

  startGame: (beginnerMode, pveMode) => {
    wsClient.send({ type: 'HOST_START_GAME', beginnerMode, pveMode })
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
    // 房主先发送配置（新手模式 + PvE 模式），再投票准备
    if (state.mode === 'host') {
      wsClient.send({ type: 'HOST_START_GAME', beginnerMode: state.beginnerMode, pveMode: state.pveMode })
    }
    wsClient.send({ type: 'READY_START' })
  },

  readyNextRound: () => {
    wsClient.send({ type: 'READY_NEXT_ROUND' })
  },

  sendReaction: (emoji, phrase) => {
    wsClient.send({ type: 'REACTION', emoji, phrase })
  },

  dismissReaction: (id) => {
    set(s => ({ reactions: s.reactions.filter(r => r.id !== id) }))
  },

  sendChat: (text) => {
    wsClient.send({ type: 'CHAT', text })
  },

  proposePact: (targetId, action) => {
    wsClient.send({ type: 'PROPOSE_PACT', targetId, action })
  },

  respondPact: (pactId, accept) => {
    wsClient.send({ type: 'RESPOND_PACT', pactId, accept })
  },

  listIntel: (price) => {
    wsClient.send({ type: 'LIST_INTEL', price })
  },

  unlistIntel: () => {
    wsClient.send({ type: 'UNLIST_INTEL' })
  },

  buyIntel: (listingId) => {
    wsClient.send({ type: 'BUY_INTEL', listingId })
  },

  dismissSoldNotice: () => set({ lastSoldNotice: null }),

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
          pveMode: msg.pveMode ?? false,
          bossId: msg.bossId ?? null,
          readyPlayers: [],
          readyTotal: 0,
          readyContext: null,
          objectiveResults: null,
          myPrivateIntel: null,
          chatMessages: [],
          pacts: [],
          lastPactResults: [],
          intelListings: [],
          purchasedIntel: [],
          lastSoldNotice: null,
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

      case 'GAME_OVER': {
        set({
          phase: 'GAME_OVER',
          players: msg.players,
          allAuditLogs: msg.auditLogs,
          gameNarration: msg.gameNarration,
          pledgesHistory: msg.pledgesHistory ?? [],
        })
        // 检查 PvE 胜利和"变形金刚"成就
        const state = get()
        const myId = state.myPlayerId
        if (state.pveMode && state.bossId && myId) {
          const boss = msg.players.find(p => p.id === state.bossId)
          if (boss && boss.marketShare < 0.30) {
            incrementStat('pveWins')
          }
        }
        if (myId) {
          const myActions = new Set<string>()
          for (const log of msg.auditLogs) {
            const me = log.players.find(p => p.id === myId)
            if (me) myActions.add(me.action)
          }
          if (myActions.size === 4) incrementStat('shapeshifterCount')
        }
        break
      }

      case 'READY_UPDATE':
        set({
          readyPlayers: msg.readyPlayers,
          readyTotal: msg.totalHumans,
          readyContext: msg.context,
        })
        break

      case 'OBJECTIVE_ASSIGNED':
        set({ myObjective: msg.objective })
        break

      case 'OBJECTIVE_RESULTS': {
        set({ objectiveResults: msg.results })
        // 如果我达成了目标 → 累计成就计数
        const myId = get().myPlayerId
        if (myId && msg.results[myId]?.achieved) {
          incrementStat('objectivesAchieved')
        }
        break
      }

      case 'PRIVATE_INTEL':
        set({ myPrivateIntel: msg.intel })
        break

      case 'CHAT': {
        const newMsg: ChatMessage = {
          id: `${msg.fromId}-${msg.ts}-${Math.random().toString(36).slice(2, 6)}`,
          fromId: msg.fromId,
          fromName: msg.fromName,
          text: msg.text,
          ts: msg.ts,
        }
        set(s => ({ chatMessages: [...s.chatMessages, newMsg].slice(-30) }))
        break
      }

      case 'PACT_PROPOSAL':
        set(s => ({ pacts: [...s.pacts.filter(p => p.id !== msg.pact.id), msg.pact] }))
        break

      case 'PACT_UPDATE':
        set(s => ({ pacts: s.pacts.map(p => p.id === msg.pact.id ? msg.pact : p) }))
        break

      case 'PACT_RESULTS': {
        set({ lastPactResults: msg.results, pacts: [] })
        // 累计契约统计
        const myId = get().myPlayerId
        if (myId) {
          for (const r of msg.results) {
            const involved = r.pact.proposerId === myId || r.pact.targetId === myId
            if (!involved) continue
            const myKept = r.pact.proposerId === myId ? r.proposerKept : r.targetKept
            if (myKept) incrementStat('pactsKept')
            else incrementStat('pactsBroken')
          }
        }
        break
      }

      case 'INTEL_MARKET':
        set({ intelListings: msg.listings })
        break

      case 'INTEL_PURCHASED':
        set(s => ({ purchasedIntel: [...s.purchasedIntel, msg.intel] }))
        incrementStat('intelBought')
        break

      case 'INTEL_SOLD':
        incrementStat('intelSold')
        set({ lastSoldNotice: { price: msg.price, toName: msg.toName } })
        // 自动消失
        setTimeout(() => {
          const cur = get().lastSoldNotice
          if (cur && cur.price === msg.price && cur.toName === msg.toName) {
            set({ lastSoldNotice: null })
          }
        }, 5000)
        break

      case 'REACTION': {
        const newReaction: Reaction = {
          id: `${msg.fromId}-${msg.ts}-${Math.random().toString(36).slice(2, 6)}`,
          fromId: msg.fromId,
          fromName: msg.fromName,
          emoji: msg.emoji,
          phrase: msg.phrase,
          ts: msg.ts,
        }
        set(s => ({ reactions: [...s.reactions, newReaction].slice(-20) }))
        // 3 秒后自动清理
        setTimeout(() => {
          get().dismissReaction(newReaction.id)
        }, 3000)
        break
      }

      case 'ERROR':
        set({ error: msg.message })
        break
    }
  },
}))
