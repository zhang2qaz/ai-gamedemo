'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'

export default function ReactionFeed() {
  const reactions = useMultiplayerStore(s => s.reactions)

  if (reactions.length === 0) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 z-40 pointer-events-none flex flex-col items-center gap-1 px-4">
      {reactions.slice(-6).map((r, idx) => {
        const c = PLAYER_COLORS[r.fromId]
        return (
          <div
            key={r.id}
            className="glass-card border-stone-600/50 rounded-full px-3 py-1.5 text-sm animate-reaction-float shadow-lg"
            style={{
              opacity: Math.max(0.4, 1 - idx * 0.1),
              animationDelay: `${idx * 50}ms`,
            }}
          >
            <span className={`font-bold mr-1.5 ${c?.text ?? 'text-stone-300'}`}>
              {r.fromName}
            </span>
            <span className="text-lg mr-1 align-middle">{r.emoji}</span>
            {r.phrase && <span className="text-stone-200 text-xs">{r.phrase}</span>}
          </div>
        )
      })}
    </div>
  )
}
