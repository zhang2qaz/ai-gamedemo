// =====================
// 弈战 v2.4 - Zustand 全局状态（多主题版）
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, RoundInput, WildCard, WildCardType } from '@/engine/types'
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
  prevRoundPlayers: PlayerState[]   // 上一回合结算前的玩家状态（用于 What-If 分析）
  prevRoundGlobal: GlobalState | null
  showAuditLog: boolean
  generatedIntel: RoundIntel[]
  intelTruth: Record<number, boolean[]>
  playerIntel: Record<PlayerId, number[]>   // 每个玩家看到的情报卡片索引
  wildCards: Record<PlayerId, WildCard>     // 每个玩家的暗牌

  // Actions
  selectTheme: (themeId: string, playerCount?: number) => void
  endIntelPhase: () => void
  ensureIntel: () => void
  setAction: (playerId: PlayerId, action: BaseAction) => void
  clearAction: (playerId: PlayerId) => void
  setFinalShift: (playerId: PlayerId, finalShift: FinalShift) => void
  toggleWildCard: (playerId: PlayerId) => void
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
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  selectTheme: (themeId: string, playerCount = 4) => {
    try {
      const theme = getTheme(themeId)
      const generatedIntel = theme.generateIntel()
      const playerIntel = distributeIntel(generatedIntel, playerCount)
      set({
        ...createGameState(theme, playerCount),
        generatedIntel,
        intelTruth: buildIntelTruth(generatedIntel),
        playerIntel,
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

      const currentIntel = (state.generatedIntel ?? []).find(r => r.round === global.roundNumber) ?? null
      const roundIntelCards = currentIntel
        ? currentIntel.cards.map(card => ({
            impliedAction: card.impliedAction,
            isTrue: card.isTrue,
          }))
        : undefined

      const { newGlobal, newPlayers, auditLog } = resolveRound(global, players, inputs, roundIntelCards, theme.configOverrides)
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
      })
    } catch (err) {
      console.error('[弈战] submitRound error:', err)
    }
  },

  nextRound: () => {
    const state = get()
    set({
      phase: 'INTEL_PHASE',
      pendingInputs: createInitialPendingInputs(state.playerCount),
      currentRoundResult: null,
    })
  },

  resetGame: () => {
    try {
      const state = get()
      if (state.theme) {
        const generatedIntel = state.theme.generateIntel()
        set({
          ...createGameState(state.theme, state.playerCount),
          generatedIntel,
          intelTruth: buildIntelTruth(generatedIntel),
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
