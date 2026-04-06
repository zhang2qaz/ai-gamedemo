// =====================
// 弈战 - 多人联机协议
// =====================

import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog } from '@/engine/types'
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
  | { type: 'ACTION'; action: BaseAction; finalShift: FinalShift }
  | { type: 'CLEAR_ACTION' }
  | { type: 'HOST_SELECT_THEME'; themeId: string }
  | { type: 'HOST_START_GAME' }
  | { type: 'HOST_NEXT_ROUND' }
  | { type: 'HOST_RESET' }
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
      intel: RoundIntel[]
      intelTruth: Record<number, boolean[]>
    }
  | {
      type: 'ROUND_STATE'
      phase: 'SUBMITTING'
      global: GlobalState
      players: PlayerState[]
      pendingStatus: Record<string, boolean>
    }
  | {
      type: 'ROUND_RESULT'
      global: GlobalState
      players: PlayerState[]
      auditLog: RoundAuditLog
      narration: string
    }
  | {
      type: 'GAME_OVER'
      players: PlayerState[]
      auditLogs: RoundAuditLog[]
      gameNarration: string
    }
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
