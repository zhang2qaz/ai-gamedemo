'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'

/**
 * 在结算屏显示本回合契约的结算结果
 */
export default function PactResults() {
  const results = useMultiplayerStore(s => s.lastPactResults)
  const players = useMultiplayerStore(s => s.players)
  const lobbyPlayers = useMultiplayerStore(s => s.lobbyPlayers)

  if (results.length === 0) return null

  const allPlayers = players.length > 0 ? players : lobbyPlayers
  const nameOf = (id: string) => allPlayers.find(p => p.id === id)?.name ?? id

  return (
    <div className="glass-card border-amber-700/40 rounded-xl p-3 space-y-2 animate-fade-in-up">
      <div className="text-xs font-bold text-amber-300">🤝 契约结算</div>
      {results.map((r, i) => {
        const cP = PLAYER_COLORS[r.pact.proposerId]
        const cT = PLAYER_COLORS[r.pact.targetId]
        return (
          <div key={i} className="text-[11px] space-y-0.5">
            <div>
              <span className={`font-bold ${cP?.text}`}>{nameOf(r.pact.proposerId)}</span>
              <span className="text-stone-500"> ↔ </span>
              <span className={`font-bold ${cT?.text}`}>{nameOf(r.pact.targetId)}</span>
              <span className="text-stone-600 ml-1">· 约定 {r.pact.action}</span>
            </div>
            <div className="text-stone-300">{r.summary}</div>
          </div>
        )
      })}
    </div>
  )
}
