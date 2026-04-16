// =====================
// 弈战 - 多人联机协议
// =====================

import type { PlayerId, BaseAction, FinalShift, PlayerState, GlobalState, RoundAuditLog, MarketForecast, Pledge, WildCard, WildCardType } from '@/engine/types'
import type { RoundIntel } from '@/engine/themes/types'
import type { Objective, ObjectiveResult } from '@/engine/objectives'
import type { PrivateIntel } from '@/engine/privateIntel'
import type { Pact, PactResult } from '@/engine/pacts'
import type { IntelListing } from '@/engine/intelMarket'

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
  | { type: 'HOST_START_GAME'; beginnerMode?: boolean; pveMode?: boolean }
  | { type: 'HOST_SKIP_INTEL' }
  | { type: 'HOST_NEXT_ROUND' }
  | { type: 'HOST_RESET' }
  | { type: 'READY_START' }       // 任何玩家：准备开始
  | { type: 'READY_NEXT_ROUND' }  // 任何玩家：准备下一回合
  | { type: 'REACTION'; emoji: string; phrase?: string }  // 发送表情/短语
  | { type: 'CHAT'; text: string }                         // 公开聊天
  | { type: 'PROPOSE_PACT'; targetId: PlayerId; action: BaseAction }  // 提议契约
  | { type: 'RESPOND_PACT'; pactId: string; accept: boolean }          // 接受/拒绝
  | { type: 'LIST_INTEL'; price: number }                              // 挂牌出售本回合私有情报
  | { type: 'UNLIST_INTEL' }                                            // 撤回挂牌
  | { type: 'BUY_INTEL'; listingId: string }                           // 购买情报
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
      pveMode: boolean
      bossId: PlayerId | null
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
      pledgesHistory?: Pledge[][]   // 每回合的立誓历史，用于关系图谱分析
    }
  | { type: 'READY_UPDATE'; readyPlayers: string[]; totalHumans: number; context: 'start' | 'next_round' }
  | { type: 'REACTION'; fromId: PlayerId; fromName: string; emoji: string; phrase?: string; ts: number }
  | { type: 'OBJECTIVE_ASSIGNED'; objective: Objective }      // 私聊：你的秘密目标
  | { type: 'OBJECTIVE_RESULTS'; results: Record<string, ObjectiveResult> }  // 终局揭示所有人
  | { type: 'PRIVATE_INTEL'; intel: PrivateIntel }            // 私聊：本回合私有情报
  | { type: 'CHAT'; fromId: PlayerId; fromName: string; text: string; ts: number }
  | { type: 'PACT_PROPOSAL'; pact: Pact; proposerName: string; targetName: string }
  | { type: 'PACT_UPDATE'; pact: Pact }                       // 状态变化（接受/拒绝/失效）
  | { type: 'PACT_RESULTS'; results: PactResult[] }           // 回合结算时的契约结果
  | { type: 'INTEL_MARKET'; listings: IntelListing[] }        // 当前可购买的情报列表
  | { type: 'INTEL_PURCHASED'; intel: PrivateIntel; from: PlayerId; price: number }  // 私聊：你购买的情报
  | { type: 'INTEL_SOLD'; price: number; toName: string }     // 私聊：你的情报被买了
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
