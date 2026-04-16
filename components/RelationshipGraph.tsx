'use client'

import { useMemo } from 'react'
import type { PlayerState, RoundAuditLog, Pledge } from '@/engine/types'
import { analyzeRelationships } from '@/engine/relationships'
import { PLAYER_COLORS } from '@/lib/playerColors'

type Props = {
  players: PlayerState[]
  logs: RoundAuditLog[]
  pledgesHistory?: Pledge[][]   // 单机/联机都可以传
}

/**
 * 终局关系图谱：宿敌 / 盟友 / 风向标 / 大冤种 ……
 * 让玩家不只记得排名，还记得"我和 XX 的故事"。
 */
export default function RelationshipGraph({ players, logs, pledgesHistory = [] }: Props) {
  const relationships = useMemo(
    () => analyzeRelationships(players, logs, pledgesHistory),
    [players, logs, pledgesHistory],
  )

  if (relationships.length === 0) return null

  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? id

  return (
    <div className="glass-card border-amber-700/40 rounded-xl p-4 space-y-3 animate-fade-in-up">
      <div className="text-center">
        <div className="text-lg font-black text-amber-300">📜 战局复盘 · 关系图谱</div>
        <div className="text-xs text-stone-500 mt-0.5">这一局留下的故事</div>
      </div>

      <div className="space-y-2">
        {relationships.map((r, idx) => {
          const cPri = PLAYER_COLORS[r.primary as keyof typeof PLAYER_COLORS]
          const cSec = r.secondary ? PLAYER_COLORS[r.secondary as keyof typeof PLAYER_COLORS] : null

          return (
            <div
              key={idx}
              className="rounded-lg px-3 py-2 bg-stone-900/50 border border-stone-700/40 hover:border-amber-700/40 transition-all"
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl shrink-0">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-bold text-amber-300">{r.title}</span>
                    <span className="text-[10px] text-stone-600">·</span>
                    <span className={`text-xs font-bold ${cPri?.text ?? 'text-stone-300'}`}>
                      {nameOf(r.primary)}
                    </span>
                    {r.secondary && (
                      <>
                        <span className="text-[10px] text-stone-600">↔</span>
                        <span className={`text-xs font-bold ${cSec?.text ?? 'text-stone-300'}`}>
                          {nameOf(r.secondary)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400 leading-relaxed">
                    {r.description}
                  </div>
                  <div className="text-[10px] text-stone-600 mt-0.5">
                    {r.evidence}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
