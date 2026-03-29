'use client'

import type { PlayerState } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'

type Props = {
  players: PlayerState[]
}

const PLAYER_FILL: Record<string, string> = {
  A: 'bg-amber-500',
  B: 'bg-sky-500',
  C: 'bg-emerald-500',
  D: 'bg-purple-500',
}

const PLAYER_TEXT: Record<string, string> = {
  A: 'text-amber-400',
  B: 'text-sky-400',
  C: 'text-emerald-400',
  D: 'text-purple-400',
}

export default function ShareBar({ players }: Props) {
  const theme = useGameStore(s => s.theme)
  const sorted = [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const t = theme?.terms

  return (
    <div className="bg-stone-900 border border-stone-700/60 rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0">{t?.marketShare ?? '市场份额'}</span>
        <div className="flex flex-1 h-6 rounded overflow-hidden gap-px">
          {players.map(p => (
            <div
              key={p.id}
              className={`${PLAYER_FILL[p.id]} flex items-center justify-center transition-all duration-500`}
              style={{ width: `${(p.marketShare * 100).toFixed(1)}%` }}
              title={`${p.name}：${(p.marketShare * 100).toFixed(1)}%`}
            >
              <span className="text-black text-xs font-black leading-none select-none">
                {(p.marketShare * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 shrink-0">
          {players.map(p => (
            <span key={p.id} className={`text-xs font-bold ${PLAYER_TEXT[p.id]}`} title={p.name}>
              {p.name.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0">{t?.profit ?? '利润'}榜</span>
        <div className="flex flex-1 gap-3 flex-wrap">
          {sorted.map((p, i) => {
            const medalColor = ['text-yellow-400', 'text-stone-300', 'text-amber-600', 'text-stone-600'][i]
            const medal = ['①', '②', '③', '④'][i]
            return (
              <div key={p.id} className="flex items-center gap-1">
                <span className={`text-sm font-black ${medalColor}`}>{medal}</span>
                <span className={`text-xs font-bold ${PLAYER_TEXT[p.id]}`}>{p.name.slice(0, 2)}</span>
                <span className={`text-xs font-mono ${p.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.cumulativeProfit >= 0 ? '+' : ''}¥{Math.round(p.cumulativeProfit / 1000)}K
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
