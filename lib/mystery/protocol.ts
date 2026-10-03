// =====================
// 剧本杀 - 联机协议（与引擎解耦）
// =====================

import type { Seat, MysteryAction, SeatView } from '@/engine/mystery/types'

export type ClientMsg =
  | { type: 'CREATE'; name: string }
  | { type: 'JOIN'; code: string; name: string }
  | { type: 'RESUME'; code: string; token: string }
  /** at：发出操作时客户端看到的步骤序号；与服务器不一致（阶段已推进）时操作作废，防止双击/迟到的操作落到下一阶段 */
  | { type: 'ACT'; action: MysteryAction; at?: number }
  | { type: 'LEAVE' }
  | { type: 'PING' }

/**
 * ERROR 的原因：
 * - stale：操作发出时的阶段已经过去，被丢弃（客户端可静默忽略）
 * - superseded：同一身份在别的窗口登录，本连接被顶下线（不要清除本地会话）
 * - expired / auth：房间已失效 / 身份校验失败（清除本地会话）
 * - rate：操作太频繁
 */
export type ErrorReason = 'stale' | 'superseded' | 'expired' | 'auth' | 'rate'

export type ServerMsg =
  | { type: 'WELCOME'; code: string; seat: Seat; token: string }
  | { type: 'VIEW'; view: SeatView }
  | { type: 'ERROR'; message: string; fatal?: boolean; reason?: ErrorReason }
  | { type: 'PONG' }

export const MYSTERY_WS_PATH = '/ws-mystery'

// 去掉易混淆字符
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode(rand: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
  return code
}

export function normalizeRoomCode(raw: string): string {
  return (raw || '').trim().toUpperCase().slice(0, 4)
}

export function sanitizeName(raw: string): string {
  return (raw || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 12)
}
