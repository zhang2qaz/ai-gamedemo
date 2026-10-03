// =====================
// 剧本杀 - 联机协议（与引擎解耦）
// =====================

import type { Seat, MysteryAction, SeatView } from '@/engine/mystery/types'

export type ClientMsg =
  | { type: 'CREATE'; name: string }
  | { type: 'JOIN'; code: string; name: string }
  | { type: 'RESUME'; code: string; token: string }
  | { type: 'ACT'; action: MysteryAction }
  | { type: 'LEAVE' }
  | { type: 'PING' }

export type ServerMsg =
  | { type: 'WELCOME'; code: string; seat: Seat; token: string }
  | { type: 'VIEW'; view: SeatView }
  | { type: 'ERROR'; message: string; fatal?: boolean }
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
