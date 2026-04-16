'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'
import { formatMoney } from '@/lib/format'
import type { PlayerState } from '@/engine/types'

type Props = {
  players: PlayerState[]
}

/**
 * 终局时揭示所有人的秘密目标 —— "原来他是这么想的！"
 */
export default function ObjectiveReveal({ players }: Props) {
  const results = useMultiplayerStore(s => s.objectiveResults)

  if (!results) return null

  const entries = Object.entries(results)
  if (entries.length === 0) return null

  return (
    <div className="glass-card border-purple-700/40 rounded-xl p-4 space-y-3 animate-fade-in-up">
      <div className="text-center">
        <div className="text-lg font-black text-purple-300">🎭 秘密目标揭晓</div>
        <div className="text-xs text-stone-500 mt-0.5">每个人都有自己的隐藏任务</div>
      </div>

      <div className="space-y-2">
        {entries.map(([playerId, result]) => {
          const player = players.find(p => p.id === playerId)
          const c = PLAYER_COLORS[playerId as keyof typeof PLAYER_COLORS]
          const achieved = result.achieved

          return (
            <div
              key={playerId}
              className={`rounded-lg px-3 py-2 border ${
                achieved
                  ? 'bg-green-950/30 border-green-700/50'
                  : 'bg-stone-900/50 border-stone-700/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${c?.text ?? 'text-stone-300'}`}>
                    {player?.name ?? playerId}
                  </span>
                  <span className="text-lg">{result.objective.emoji}</span>
                  <span className="text-xs text-stone-400 font-bold">{result.objective.name}</span>
                </div>
                {achieved ? (
                  <span className="text-xs font-bold text-green-400">
                    ✓ 达成 +{formatMoney(result.objective.bonus)}
                  </span>
                ) : (
                  <span className="text-xs text-stone-600">未达成</span>
                )}
              </div>
              <div className="text-[11px] text-stone-500 leading-relaxed">
                {result.objective.description}
              </div>
              <div className="text-[10px] text-stone-600 mt-0.5">
                进度：{result.progress}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
