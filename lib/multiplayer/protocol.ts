// =====================
// 弈战 - 多人联机协议
// =====================

import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, MarketForecast, Pledge, WildCard, WildCardType } from '@/engine/types'
import type { RoundIntel } from '@/engine/themes/types'

// ── 房间类型 ──

export type PlayerSlot = {
  id: PlayerId
  name: string
  connected: boolean
}

// ── 客户端 → 服务器 ──

export type ClientMessage =
  | { type: 'JOIN'; playerName: string; roomCode: string }
  | { type: 'ACTION'; action: BaseAction; finalShift: FinalShift; useWildCard?: boolean }
  | { type: 'PLEDGE'; action: BaseAction | null }
  | { type: 'CLEAR_ACTION' }
  | { type: 'HOST_SELECT_THEME'; themeId: string }
  | { type: 'HOST_START_GAME'; beginnerMode?: boolean }
  | { type: 'HOST_SKIP_INTEL' }
  | { type: 'HOST_NEXT_ROUND' }
  | { type: 'HOST_RESET' }
  | { type: 'READY_START' }       // 任何玩家：准备开始
  | { type: 'READY_NEXT_ROUND' }  // 任何玩家：准备下一回合
  | { type: 'PING' }

// ── 服务器 → 客户端 ──

export type ServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; hostIp: string }
  | { type: 'JOINED'; playerId: PlayerId; roomCode: string; players: PlayerSlot[] }
  | { type: 'LOBBY_UPDATE'; players: PlayerSlot[] }
  | { type: 'THEME_SELECTED'; themeId: string }
  | {
      type: 'GAME_START'
      themeId: string
      global: GlobalState
      players: PlayerState[]
      forecasts: MarketForecast[]
      intel: RoundIntel[]
      intelTruth: Record<number, boolean[]>
      wildCards: Record<string, WildCard>
      beginnerMode: boolean
    }
  | {
      type: 'INTEL_PHASE'
      global: GlobalState
      players: PlayerState[]
      currentForecast: MarketForecast | null
      pledges: Pledge[]
      endsAt: number  // Unix timestamp (ms) when intel phase ends
    }
  | {
      type: 'ROUND_STATE'
      phase: 'SUBMITTING'
      global: GlobalState
      players: PlayerState[]
      pendingStatus: Record<string, boolean>
      currentForecast: MarketForecast | null
      pledges: Pledge[]
    }
  | {
      type: 'ROUND_RESULT'
      global: GlobalState
      players: PlayerState[]
      auditLog: RoundAuditLog
      narration: string
      forecast: MarketForecast | null
      pledges: Pledge[]
    }
  | {
      type: 'GAME_OVER'
      players: PlayerState[]
      auditLogs: RoundAuditLog[]
      gameNarration: string
    }
  | { type: 'READY_UPDATE'; readyPlayers: string[]; totalHumans: number; context: 'start' | 'next_round' }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' }

// ── 工具函数 ──

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
