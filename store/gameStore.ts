// =====================
// 弈战 v2.4 - Zustand 全局状态（多主题版）
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, RoundInput, WildCard, WildCardType, MarketForecast, Pledge } from '@/engine/types'
import { INITIAL_PLAYER_STATES, INITIAL_GLOBAL_STATE, createInitialPlayerStates } from '@/engine/constants'
import { ALL_PLAYER_IDS, WILD_CARD_POOL } from '@/engine/types'
import { resolveRound } from '@/engine/resolveRound'
import { generateRoundNarration, generateGameNarration } from '@/engine/resolveGame'
import { getTheme } from '@/engine/themes'
import type { ThemeConfig, RoundIntel } from '@/engine/themes'

export type GamePhase = 'THEME_SELECT' | 'INTEL_PHASE' | 'SUBMITTING' | 'ROUND_RESULT' | 'GAME_OVER'

export type PendingInput = {
  action: BaseAction | null
  finalShift: FinalShift
  useWildCard: boolean
}

// P1-1: 情报交易记录
export type IntelShare = {
  from: PlayerId
  to: PlayerId
  cardIdx: number       // round*100+cardIdx encoding
  claimedAction: BaseAction  // 声称的建议动作（可能是真实的，也可能是虚张声势）
  isBluff: boolean       // 是否在故意误导（sharer知道，recipient不知道）
}

// P1-2: 公开宣言
export type Announcement = {
  playerId: PlayerId
  declaredAction: BaseAction
}

type GameStore = {
  phase: GamePhase
  themeId: string | null
  theme: ThemeConfig | null
  playerCount: number
  global: GlobalState
  players: PlayerState[]
  pendingInputs: Record<PlayerId, PendingInput>
  auditLogs: RoundAuditLog[]
  roundNarrations: string[]
  gameNarration: string
  currentRoundResult: RoundAuditLog | null
  prevRoundPlayers: PlayerState[]
  prevRoundGlobal: GlobalState | null
  showAuditLog: boolean
  generatedIntel: RoundIntel[]
  intelTruth: Record<number, boolean[]>
  playerIntel: Record<PlayerId, number[]>
  wildCards: Record<PlayerId, WildCard>

  // v2.5 市场风向系统
  generatedForecasts: MarketForecast[]
  currentForecast: MarketForecast | null
  lastRoundForecast: MarketForecast | null

  // v2.5 立誓系统
  pledges: Pledge[]
  lastRoundPledges: Pledge[]

  // 旧社交系统（保留字段兼容，但不再使用）
  intelShares: IntelShare[]
  lastRoundIntelReport: IntelShare[]
  announcements: Announcement[]
  lastRoundAnnouncements: Announcement[]
  revengeMarks: Partial<Record<PlayerId, PlayerId | null>>
  lastRoundRevengeMarks: Partial<Record<PlayerId, PlayerId | null>>

  // Actions
  selectTheme: (themeId: string, playerCount?: number) => void
  endIntelPhase: () => void
  ensureIntel: () => void
  setAction: (playerId: PlayerId, action: BaseAction) => void
  clearAction: (playerId: PlayerId) => void
  setFinalShift: (playerId: PlayerId, finalShift: FinalShift) => void
  toggleWildCard: (playerId: PlayerId) => void
  setPledge: (playerId: PlayerId, action: BaseAction | null) => void
  shareIntel: (from: PlayerId, to: PlayerId, cardIdx: number, claimedAction: BaseAction, isBluff: boolean) => void
  announce: (playerId: PlayerId, declaredAction: BaseAction | null) => void
  setRevengeMark: (from: PlayerId, target: PlayerId | null) => void
  submitRound: () => void
  nextRound: () => void
  resetGame: () => void
  backToThemeSelect: () => void
  toggleAuditLog: () => void
}

// 从动态生成的情报中提取真假标记
function buildIntelTruth(intel: RoundIntel[]): Record<number, boolean[]> {
  const result: Record<number, boolean[]> = {}
  for (const ri of intel) {
    result[ri.round] = ri.cards.map(c => c.isTrue)
  }
  return result
}

function createInitialPendingInputs(playerCount = 4): Record<PlayerId, PendingInput> {
  const ids = ALL_PLAYER_IDS.slice(0, playerCount)
  const result: Partial<Record<PlayerId, PendingInput>> = {}
  for (const id of ids) {
    result[id] = { action: null, finalShift: 'NONE', useWildCard: false }
  }
  return result as Record<PlayerId, PendingInput>
}

function distributeWildCards(playerCount: number): Record<PlayerId, WildCard> {
  const ids = ALL_PLAYER_IDS.slice(0, playerCount)
  // Shuffle the pool and assign one to each player
  const pool = [...WILD_CARD_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const result: Partial<Record<PlayerId, WildCard>> = {}
  for (let i = 0; i < ids.length; i++) {
    const card = pool[i % pool.length]
    result[ids[i]] = { ...card, used: false }
  }
  return result as Record<PlayerId, WildCard>
}

function distributeIntel(intel: RoundIntel[], playerCount: number): Record<PlayerId, number[]> {
  const ids = ALL_PLAYER_IDS.slice(0, playerCount)
  const result: Record<string, number[]> = {}
  for (const id of ids) result[id] = []

  // 每轮情报卡片打乱后分配给各玩家（每人至少1张，允许重叠关键牌）
  for (const ri of intel) {
    const cardIndices = ri.cards.map((_, i) => i)
    // 洗牌
    for (let i = cardIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cardIndices[i], cardIndices[j]] = [cardIndices[j], cardIndices[i]]
    }
    // 轮流分配
    cardIndices.forEach((cardIdx, i) => {
      const playerId = ids[i % playerCount]
      if (!result[playerId].includes(ri.round * 100 + cardIdx)) {
        result[playerId].push(ri.round * 100 + cardIdx)
      }
    })
  }
  return result as Record<PlayerId, number[]>
}

function createGameState(theme: ThemeConfig, playerCount = 4) {
  const basePlayers = createInitialPlayerStates(playerCount)
  return {
    phase: 'INTEL_PHASE' as GamePhase,
    themeId: theme.id,
    theme,
    playerCount,
    global: {
      ...INITIAL_GLOBAL_STATE,
      eventQueue: theme.events,
    },
    players: basePlayers.map(p => ({
      ...p,
      name: theme.playerNames[p.id] ?? p.name,
    })),
    pendingInputs: createInitialPendingInputs(playerCount),
    auditLogs: [] as RoundAuditLog[],
    roundNarrations: [] as string[],
    gameNarration: '',
    currentRoundResult: null as RoundAuditLog | null,
    prevRoundPlayers: [] as PlayerState[],
    prevRoundGlobal: null as GlobalState | null,
    showAuditLog: false,
    // 延迟生成情报：客户端通过 ensureIntel() 填充
    generatedIntel: [] as RoundIntel[],
    intelTruth: {} as Record<number, boolean[]>,
    playerIntel: {} as Record<PlayerId, number[]>,
    wildCards: distributeWildCards(playerCount),
    // v2.5 新社交系统
    generatedForecasts: [] as MarketForecast[],
    currentForecast: null as MarketForecast | null,
    lastRoundForecast: null as MarketForecast | null,
    pledges: [] as Pledge[],
    lastRoundPledges: [] as Pledge[],
    // 旧社交系统（兼容）
    intelShares: [] as IntelShare[],
    lastRoundIntelReport: [] as IntelShare[],
    announcements: [] as Announcement[],
    lastRoundAnnouncements: [] as Announcement[],
    revengeMarks: {} as Partial<Record<PlayerId, PlayerId | null>>,
    lastRoundRevengeMarks: {} as Partial<Record<PlayerId, PlayerId | null>>,
  }
}

function createInitialState() {
  return {
    phase: 'THEME_SELECT' as GamePhase,
    themeId: null as string | null,
    theme: null as ThemeConfig | null,
    playerCount: 4,
    global: { ...INITIAL_GLOBAL_STATE, eventQueue: [] } as GlobalState,
    players: INITIAL_PLAYER_STATES.map(p => ({ ...p })) as PlayerState[],
    pendingInputs: createInitialPendingInputs(),
    auditLogs: [] as RoundAuditLog[],
    roundNarrations: [] as string[],
    gameNarration: '',
    currentRoundResult: null as RoundAuditLog | null,
    prevRoundPlayers: [] as PlayerState[],
    prevRoundGlobal: null as GlobalState | null,
    showAuditLog: false,
    generatedIntel: [] as RoundIntel[],
    intelTruth: {} as Record<number, boolean[]>,
    playerIntel: {} as Record<PlayerId, number[]>,
    wildCards: distributeWildCards(4),
    generatedForecasts: [] as MarketForecast[],
    currentForecast: null as MarketForecast | null,
    lastRoundForecast: null as MarketForecast | null,
    pledges: [] as Pledge[],
    lastRoundPledges: [] as Pledge[],
    intelShares: [] as IntelShare[],
    lastRoundIntelReport: [] as IntelShare[],
    announcements: [] as Announcement[],
    lastRoundAnnouncements: [] as Announcement[],
    revengeMarks: {} as Partial<Record<PlayerId, PlayerId | null>>,
    lastRoundRevengeMarks: {} as Partial<Record<PlayerId, PlayerId | null>>,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  selectTheme: (themeId: string, playerCount = 4) => {
    try {
      const theme = getTheme(themeId)
      const generatedIntel = theme.generateIntel()
      const playerIntel = distributeIntel(generatedIntel, playerCount)
      const generatedForecasts = theme.generateForecast()
      const currentForecast = generatedForecasts.find(f => f.round === 1) ?? null
      set({
        ...createGameState(theme, playerCount),
        generatedIntel,
        intelTruth: buildIntelTruth(generatedIntel),
        playerIntel,
        generatedForecasts,
        currentForecast,
      })
    } catch (err) {
      console.error('[弈战] selectTheme error:', err)
    }
  },

  endIntelPhase: () => {
    set({ phase: 'SUBMITTING' })
  },

  ensureIntel: () => {
    const state = get()
    if (state.generatedIntel.length > 0 || !state.theme) return
    const generatedIntel = state.theme.generateIntel()
    set({ generatedIntel, intelTruth: buildIntelTruth(generatedIntel) })
  },

  setAction: (playerId, action) => {
    set(state => ({
      pendingInputs: {
        ...state.pendingInputs,
        [playerId]: { ...state.pendingInputs[playerId], action },
      },
    }))
  },

  clearAction: (playerId) => {
    set(state => ({
      pendingInputs: {
        ...state.pendingInputs,
        [playerId]: { ...state.pendingInputs[playerId], action: null, finalShift: 'NONE', useWildCard: false },
      },
    }))
  },

  setFinalShift: (playerId, finalShift) => {
    set(state => ({
      pendingInputs: {
        ...state.pendingInputs,
        [playerId]: { ...state.pendingInputs[playerId], finalShift },
      },
    }))
  },

  toggleWildCard: (playerId) => {
    set(state => ({
      pendingInputs: {
        ...state.pendingInputs,
        [playerId]: {
          ...state.pendingInputs[playerId],
          useWildCard: !state.pendingInputs[playerId].useWildCard,
        },
      },
    }))
  },

  shareIntel: (from, to, cardIdx, claimedAction, isBluff) => {
    set(state => ({
      intelShares: [...state.intelShares, { from, to, cardIdx, claimedAction, isBluff }],
    }))
  },

  announce: (playerId, declaredAction) => {
    set(state => {
      const filtered = state.announcements.filter(a => a.playerId !== playerId)
      if (declaredAction) {
        return { announcements: [...filtered, { playerId, declaredAction }] }
      }
      return { announcements: filtered }
    })
  },

  setPledge: (playerId, action) => {
    set(state => {
      const filtered = state.pledges.filter(p => p.playerId !== playerId)
      if (action) {
        return { pledges: [...filtered, { playerId, pledgedAction: action }] }
      }
      return { pledges: filtered }
    })
  },

  setRevengeMark: (from, target) => {
    set(state => ({
      revengeMarks: { ...state.revengeMarks, [from]: target },
    }))
  },

  submitRound: () => {
    try {
      const state = get()
      const { global, players, pendingInputs, theme } = state
      if (!theme) return

      const playerIds = players.map(p => p.id)
      const allSubmitted = playerIds.every(
        id => pendingInputs[id]?.action !== null
      )
      if (!allSubmitted) return

      // Build inputs with wild card if toggled and not yet used
      const usedWildCardIds: PlayerId[] = []
      const inputs: RoundInput[] = playerIds.map(id => {
        const pi = pendingInputs[id]
        const wc = state.wildCards[id]
        const useWild = pi.useWildCard && wc && !wc.used
        if (useWild) usedWildCardIds.push(id)
        return {
          playerId: id,
          action: pi.action!,
          finalShift: pi.finalShift ?? 'NONE',
          wildCard: useWild ? wc.type : null,
        }
      })

      // v2.5: 使用市场风向 + 立誓系统（替代旧情报系统）
      const currentForecast = state.currentForecast
      const forecastParam = currentForecast
        ? { signal: currentForecast.signal, isTrue: currentForecast.isTrue }
        : null
      const pledgeParam = state.pledges.length > 0 ? state.pledges : undefined

      const { newGlobal, newPlayers, auditLog } = resolveRound(
        global, players, inputs,
        undefined,  // roundIntelCards: 不再使用旧情报
        theme.configOverrides,
        forecastParam,
        pledgeParam,
      )

      const narration = generateRoundNarration(auditLog, players, theme)
      const newAuditLogs = [...state.auditLogs, auditLog]
      const newNarrations = [...state.roundNarrations, narration]

      const isGameOver = global.roundNumber >= global.maxRounds
      let gameNarration = ''
      if (isGameOver) {
        gameNarration = generateGameNarration(newPlayers, newAuditLogs, theme)
      }

      // Mark used wild cards
      const newWildCards = { ...state.wildCards }
      for (const id of usedWildCardIds) {
        newWildCards[id] = { ...newWildCards[id], used: true }
      }

      set({
        global: newGlobal,
        players: newPlayers,
        prevRoundPlayers: players.map(p => ({ ...p })),
        prevRoundGlobal: { ...global },
        auditLogs: newAuditLogs,
        roundNarrations: newNarrations,
        currentRoundResult: auditLog,
        phase: isGameOver ? 'GAME_OVER' : 'ROUND_RESULT',
        gameNarration,
        wildCards: newWildCards,
        // v2.5: 保存本轮风向和立誓记录供结算面板显示
        lastRoundForecast: currentForecast,
        lastRoundPledges: [...state.pledges],
      })
    } catch (err) {
      console.error('[弈战] submitRound error:', err)
    }
  },

  nextRound: () => {
    const state = get()
    const nextRoundNum = state.global.roundNumber
    const nextForecast = state.generatedForecasts.find(f => f.round === nextRoundNum) ?? null
    set({
      phase: 'INTEL_PHASE',
      pendingInputs: createInitialPendingInputs(state.playerCount),
      currentRoundResult: null,
      // v2.5: 设置下一轮风向，清空立誓
      currentForecast: nextForecast,
      pledges: [],
      // 旧系统兼容
      intelShares: [],
      announcements: [],
      revengeMarks: {},
    })
  },

  resetGame: () => {
    try {
      const state = get()
      if (state.theme) {
        const generatedIntel = state.theme.generateIntel()
        const playerIntel = distributeIntel(generatedIntel, state.playerCount)
        const generatedForecasts = state.theme.generateForecast()
        const currentForecast = generatedForecasts.find(f => f.round === 1) ?? null
        set({
          ...createGameState(state.theme, state.playerCount),
          generatedIntel,
          intelTruth: buildIntelTruth(generatedIntel),
          playerIntel,
          generatedForecasts,
          currentForecast,
        })
      } else {
        set(createInitialState())
      }
    } catch (err) {
      console.error('[弈战] resetGame error:', err)
      set(createInitialState())
    }
  },

  backToThemeSelect: () => {
    set(createInitialState())
  },

  toggleAuditLog: () => {
    set(state => ({ showAuditLog: !state.showAuditLog }))
  },
}))
