// =====================
// 弈战 - 玩家颜色配置（2-8人）
// =====================

import type { PlayerId } from '@/engine/types'

export type PlayerColorSet = {
  text: string
  bg: string
  border: string
  fill: string
  dot: string
  glow: string
  gradient: string
}

export const PLAYER_COLORS: Record<PlayerId, PlayerColorSet> = {
  A: { text: 'text-amber-400',   bg: 'bg-amber-950/20',   border: 'border-amber-500',   fill: 'bg-amber-500',   dot: 'bg-amber-400',   glow: 'glow-amber',   gradient: 'from-amber-500 to-amber-400' },
  B: { text: 'text-sky-400',     bg: 'bg-sky-950/20',     border: 'border-sky-500',     fill: 'bg-sky-500',     dot: 'bg-sky-400',     glow: 'glow-sky',     gradient: 'from-sky-500 to-sky-400' },
  C: { text: 'text-emerald-400', bg: 'bg-emerald-950/20', border: 'border-emerald-500', fill: 'bg-emerald-500', dot: 'bg-emerald-400', glow: 'glow-emerald', gradient: 'from-emerald-500 to-emerald-400' },
  D: { text: 'text-purple-400',  bg: 'bg-purple-950/20',  border: 'border-purple-500',  fill: 'bg-purple-500',  dot: 'bg-purple-400',  glow: 'glow-purple',  gradient: 'from-purple-500 to-purple-400' },
  E: { text: 'text-rose-400',    bg: 'bg-rose-950/20',    border: 'border-rose-500',    fill: 'bg-rose-500',    dot: 'bg-rose-400',    glow: 'glow-amber',   gradient: 'from-rose-500 to-rose-400' },
  F: { text: 'text-cyan-400',    bg: 'bg-cyan-950/20',    border: 'border-cyan-500',    fill: 'bg-cyan-500',    dot: 'bg-cyan-400',    glow: 'glow-sky',     gradient: 'from-cyan-500 to-cyan-400' },
  G: { text: 'text-lime-400',    bg: 'bg-lime-950/20',    border: 'border-lime-500',    fill: 'bg-lime-500',    dot: 'bg-lime-400',    glow: 'glow-emerald', gradient: 'from-lime-500 to-lime-400' },
  H: { text: 'text-orange-400',  bg: 'bg-orange-950/20',  border: 'border-orange-500',  fill: 'bg-orange-500',  dot: 'bg-orange-400',  glow: 'glow-amber',   gradient: 'from-orange-500 to-orange-400' },
}

export const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣']
export const MEDAL_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧']
