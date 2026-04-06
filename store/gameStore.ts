// =====================
// 弈战 v2.4 - Zustand 全局状态（多主题版）
// =====================

import { create } from 'zustand'
import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, RoundInput } from '@/engine/types'
import { INITIAL_PLAYER_STATES, INITIAL_GLOBAL_STATE, createInitialPlayerStates } from '@/engine/constants'
import { ALL_PLAYER_IDS } from '@/engine/types'
import { resolveRound } from '@/engine/resolveRound'
import { generateRoundNarration, generateGameNarration } from '@/engine/resolveGame'
import { getTheme } from '@/engine/themes'
import type { ThemeConfig, RoundIntel } from '@/engine/themes'

export type GamePhase = 'THEME_SELECT' | 'SUBMITTING' | 'ROUND_RESULT' | 'GAME_OVER'

export type PendingInput = {
  action: BaseAction | null
  finalShift: FinalShift
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
  showAuditLog: boolean
  generatedIntel: RoundIntel[]
  intelTruth: Record<number, boolean[]>

  // Actions
  selectTheme: (themeId: string, playerCount?: number) => void
  ensureIntel: () => void
  setAction: (playerId: PlayerId, action: BaseAction) => void
  clearAction: (playerId: PlayerId) => void
  setFinalShift: (playerId: PlayerId, finalShift: FinalShift) => void
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
    result[id] = { action: null, finalShift: 'NONE' }
  }
  return result as Record<PlayerId, PendingInput>
}

function createGameState(theme: ThemeConfig, playerCount = 4) {
  const basePlayers = createInitialPlayerStates(playerCount)
  return {
    phase: 'SUBMITTING' as GamePhase,
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
    showAuditLog: false,
    // 延迟生成情报：客户端通过 ensureIntel() 填充
    generatedIntel: [] as RoundIntel[],
    intelTruth: {} as Record<number, boolean[]>,
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
    showAuditLog: false,
    generatedIntel: [] as RoundIntel[],
    intelTruth: {} as Record<number, boolean[]>,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  selectTheme: (themeId: string, playerCount = 4) => {
    try {
      const theme = getTheme(themeId)
      const generatedIntel = theme.generateIntel()
      set({
        ...createGameState(theme, playerCount),
        generatedIntel,
        intelTruth: buildIntelTruth(generatedIntel),
      })
    } catch (err) {
      console.error('[弈战] selectTheme error:', err)
    }
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
        [playerId]: { ...state.pendingInputs[playerId], action: null, finalShift: 'NONE' },
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

      const inputs: RoundInput[] = playerIds.map(id => ({
        playerId: id,
        action: pendingInputs[id].action!,
        finalShift: pendingInputs[id].finalShift ?? 'NONE',
      }))

      const currentIntel = (state.generatedIntel ?? []).find(r => r.round === global.roundNumber) ?? null
      const roundIntelCards = currentIntel
        ? currentIntel.cards.map(card => ({
            impliedAction: card.impliedAction,
            isTrue: card.isTrue,
          }))
        : undefined

      const { newGlobal, newPlayers, auditLog } = resolveRound(global, players, inputs, roundIntelCards)
      const narration = generateRoundNarration(auditLog, players, theme)
      const newAuditLogs = [...state.auditLogs, auditLog]
      const newNarrations = [...state.roundNarrations, narration]

      const isGameOver = global.roundNumber >= global.maxRounds
      let gameNarration = ''
      if (isGameOver) {
        gameNarration = generateGameNarration(newPlayers, newAuditLogs, theme)
      }

      set({
        global: newGlobal,
        players: newPlayers,
        auditLogs: newAuditLogs,
        roundNarrations: newNarrations,
        currentRoundResult: auditLog,
        phase: isGameOver ? 'GAME_OVER' : 'ROUND_RESULT',
        gameNarration,
      })
    } catch (err) {
      console.error('[弈战] submitRound error:', err)
    }
  },

  nextRound: () => {
    const state = get()
    set({
      phase: 'SUBMITTING',
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
