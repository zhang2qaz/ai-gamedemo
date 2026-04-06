'use client'

import type { PlayerState, RoundAuditLog } from '@/engine/types'
import { formatMoney, formatPercent } from '@/lib/format'
import { getFinalRanking, getShareRanking } from '@/engine/resolveGame'
import { useGameStore } from '@/store/gameStore'

type Props = {
  players: PlayerState[]
  logs: RoundAuditLog[]
  gameNarration: string
  onReset: () => void
  onShowAuditLog: () => void
}

import { PLAYER_COLORS, MEDALS } from '@/lib/playerColors'

export default function GameOverPanel({ players, logs, gameNarration, onReset, onShowAuditLog }: Props) {
  const theme = useGameStore(s => s.theme)
  const t = theme?.terms
  const profitRanked = getFinalRanking(players)
  const shareRanked = getShareRanking(players)
  const winner = profitRanked[0]

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 冠军宣告 */}
      <div className="relative text-center space-y-3 py-8 glass-card rounded-2xl overflow-hidden">
        {/* 背景光效 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber-500/[0.08] blur-[80px]" />
        </div>

        <div className="relative z-10">
          <div className="text-stone-400 text-xs uppercase tracking-[0.3em] font-bold mb-2">最终胜者</div>
          <div className="text-5xl mb-3 animate-float">🏆</div>
          <div
            className={`text-4xl font-black ${PLAYER_COLORS[winner.id]?.text ?? 'text-white'} animate-slide-in-scale`}
            style={{ textShadow: '0 0 30px currentColor' }}
          >
            {winner.name}
          </div>
          <div className="text-white text-2xl font-mono font-bold mt-2 text-glow-amber animate-count-up" style={{ animationDelay: '300ms' }}>
            {formatMoney(winner.cumulativeProfit)}
          </div>
        </div>
      </div>

      {/* 双排名 */}
      <div className="grid grid-cols-2 gap-3">
        <RankingTable title={`${t?.cumulativeProfit ?? '累计利润'}排名`} players={profitRanked} getValue={p => formatMoney(p.cumulativeProfit)} delay={100} />
        <RankingTable title={`${t?.marketShare ?? '市场份额'}排名`} players={shareRanked} getValue={p => formatPercent(p.marketShare)} delay={200} />
      </div>

      {/* 局后复盘 */}
      <div className="glass-card rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold mb-3">局后复盘</div>
        <div className="border-l-2 border-amber-600/30 pl-3">
          <pre className="text-stone-300 text-xs font-mono leading-relaxed whitespace-pre-wrap">{gameNarration}</pre>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-center animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <button
          onClick={onShowAuditLog}
          className="px-6 py-2.5 glass-card hover:bg-stone-700/40 text-stone-200 font-bold rounded-xl text-sm transition-all"
        >
          📋 审计日志
        </button>
        <button
          onClick={onReset}
          className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold rounded-xl text-sm transition-all btn-3d"
        >
          ↺ 重开一局
        </button>
      </div>
    </div>
  )
}

function RankingTable({
  title,
  players,
  getValue,
  delay = 0,
}: {
  title: string
  players: PlayerState[]
  getValue: (p: PlayerState) => string
  delay?: number
}) {
  return (
    <div className="glass-card rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-stone-400 text-xs uppercase tracking-[0.15em] font-bold mb-3">{title}</div>
      <div className="space-y-2.5">
        {players.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between animate-fade-in-up"
            style={{ animationDelay: `${delay + (i + 1) * 80}ms` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{MEDALS[i]}</span>
              <span className={`font-bold text-sm ${PLAYER_COLORS[p.id]?.text ?? 'text-white'}`} style={{ textShadow: '0 0 8px currentColor' }}>{p.name}</span>
            </div>
            <span className="text-white font-mono text-sm font-bold">{getValue(p)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
