'use client'

import { useRef, useEffect, useState } from 'react'
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

  // Track previous shares for trend arrows
  const prevSharesRef = useRef<Record<string, number>>({})
  const [trends, setTrends] = useState<Record<string, 'up' | 'down' | 'flat'>>({})
  useEffect(() => {
    const prev = prevSharesRef.current
    const newTrends: Record<string, 'up' | 'down' | 'flat'> = {}
    for (const p of players) {
      const oldShare = prev[p.id]
      if (oldShare === undefined) {
        newTrends[p.id] = 'flat'
      } else if (p.marketShare > oldShare + 0.005) {
        newTrends[p.id] = 'up'
      } else if (p.marketShare < oldShare - 0.005) {
        newTrends[p.id] = 'down'
      } else {
        newTrends[p.id] = 'flat'
      }
    }
    setTrends(newTrends)
    prevSharesRef.current = Object.fromEntries(players.map(p => [p.id, p.marketShare]))
  }, [players])

  const trendIcon = (id: string) => {
    const t = trends[id]
    if (t === 'up') return <span className="text-green-400 text-xs ml-0.5">▲</span>
    if (t === 'down') return <span className="text-red-400 text-xs ml-0.5">▼</span>
    return null
  }

  return (
    <div className="glass-card rounded-xl px-4 py-3 space-y-2.5">
      {/* 市场份额条 */}
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0 font-bold">{t?.marketShare ?? '份额'}</span>
        <div className="flex flex-1 h-8 rounded-lg overflow-hidden gap-[2px] bg-stone-800/50">
          {players.map(p => {
            const pct = p.marketShare * 100
            return (
              <div
                key={p.id}
                className={`bg-gradient-to-r ${PLAYER_COLORS[p.id]?.gradient ?? 'from-stone-500 to-stone-400'} flex items-center justify-center`}
                style={{
                  width: `${pct.toFixed(1)}%`,
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                title={`${p.name}：${pct.toFixed(1)}%`}
              >
                {pct >= 8 ? (
                  <span className="text-black text-xs font-black leading-none select-none drop-shadow-sm flex items-center">
                    {pct.toFixed(0)}%
                    {trendIcon(p.id)}
                  </span>
                ) : pct >= 4 ? (
                  <span className="text-black text-xs font-black leading-none select-none drop-shadow-sm">
                    {pct.toFixed(0)}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* 品牌名称图例 + 利润排行 */}
      <div className="flex items-center gap-2">
        <span className="text-stone-500 text-xs w-14 shrink-0 font-bold">{t?.profit ?? '利润'}榜</span>
        <div className="flex flex-1 gap-3 flex-wrap">
          {sorted.map((p, i) => {
            const medalStyle = ['text-gradient-gold', 'text-gradient-silver', 'text-gradient-bronze'][i] ?? 'text-stone-600'
            const medal = MEDAL_NUMBERS[i] ?? `${i + 1}`
            const profitK = Math.round(p.cumulativeProfit / 1000)
            return (
              <div key={p.id} className="flex items-center gap-1" style={{ transition: 'all 0.5s ease' }}>
                <span className={`text-sm font-black ${medalStyle}`}>{medal}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${PLAYER_COLORS[p.id]?.dot ?? 'bg-stone-500'}`} />
                <span className={`text-xs font-bold ${PLAYER_COLORS[p.id]?.text ?? 'text-stone-400'}`}>{p.name.slice(0, 2)}</span>
                <span className={`text-xs font-mono ${p.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {profitK >= 0 ? '+' : ''}¥{profitK}K
                </span>
                {trendIcon(p.id)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
