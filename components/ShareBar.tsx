'use client'

import type { PlayerState } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'
import { PLAYER_COLORS, MEDAL_NUMBERS } from '@/lib/playerColors'

type Props = {
  players: PlayerState[]
}

export default function ShareBar({ players }: Props) {
  const theme = useGameStore(s => s.theme)
  const sorted = [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const t = theme?.terms

  return (
    <div className="glass-card rounded-xl px-4 py-3 space-y-2.5">
      {/* 市场份额条 */}
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0 font-bold">{t?.marketShare ?? '份额'}</span>
        <div className="flex flex-1 h-7 rounded-lg overflow-hidden gap-[2px] bg-stone-800/50">
          {players.map(p => (
            <div
              key={p.id}
              className={`bg-gradient-to-r ${PLAYER_COLORS[p.id]?.gradient ?? 'from-stone-500 to-stone-400'} flex items-center justify-center transition-all duration-700 ease-out animate-bar-grow`}
              style={{ width: `${(p.marketShare * 100).toFixed(1)}%` }}
              title={`${p.name}：${(p.marketShare * 100).toFixed(1)}%`}
            >
              <span className="text-black text-xs font-black leading-none select-none drop-shadow-sm">
                {(p.marketShare * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2.5 shrink-0">
          {players.map(p => (
            <span key={p.id} className={`text-xs font-bold ${PLAYER_COLORS[p.id]?.text ?? 'text-stone-400'}`} title={p.name} style={{ textShadow: '0 0 6px currentColor' }}>
              {p.name.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      {/* 利润排行 */}
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0 font-bold">{t?.profit ?? '利润'}榜</span>
        <div className="flex flex-1 gap-3 flex-wrap">
          {sorted.map((p, i) => {
            const medalStyle = ['text-gradient-gold', 'text-gradient-silver', 'text-gradient-bronze'][i] ?? 'text-stone-600'
            const medal = MEDAL_NUMBERS[i] ?? `${i + 1}`
            return (
              <div key={p.id} className="flex items-center gap-1">
                <span className={`text-sm font-black ${medalStyle}`}>{medal}</span>
                <span className={`text-xs font-bold ${PLAYER_COLORS[p.id]?.text ?? 'text-stone-400'}`}>{p.name.slice(0, 2)}</span>
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
