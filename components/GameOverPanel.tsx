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

const PLAYER_COLORS: Record<string, string> = {
  A: 'text-amber-400',
  B: 'text-sky-400',
  C: 'text-emerald-400',
  D: 'text-purple-400',
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣']

export default function GameOverPanel({ players, logs, gameNarration, onReset, onShowAuditLog }: Props) {
  const theme = useGameStore(s => s.theme)
  const t = theme?.terms
  const profitRanked = getFinalRanking(players)
  const shareRanked = getShareRanking(players)
  const winner = profitRanked[0]

  return (
    <div className="space-y-6">
      {/* 冠军宣告 */}
      <div className="text-center space-y-2 py-4 border border-amber-600/50 bg-amber-900/10 rounded-xl">
        <div className="text-stone-400 text-sm uppercase tracking-widest">最终胜者</div>
        <div className={`text-4xl font-black ${PLAYER_COLORS[winner.id]}`}>
          {winner.name}
        </div>
        <div className="text-white text-xl font-mono">{formatMoney(winner.cumulativeProfit)}</div>
      </div>

      {/* 双排名 */}
      <div className="grid grid-cols-2 gap-4">
        <RankingTable title={`${t?.cumulativeProfit ?? '累计利润'}排名`} players={profitRanked} getValue={p => formatMoney(p.cumulativeProfit)} />
        <RankingTable title={`${t?.marketShare ?? '市场份额'}排名`} players={shareRanked} getValue={p => formatPercent(p.marketShare)} />
      </div>

      {/* 局后复盘 */}
      <div className="bg-stone-800/40 border border-stone-700/50 rounded-lg p-4">
        <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">局后复盘</div>
        <pre className="text-stone-300 text-xs font-mono leading-relaxed whitespace-pre-wrap">{gameNarration}</pre>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onShowAuditLog}
          className="px-6 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold rounded border border-stone-600 uppercase tracking-wider text-sm transition-all"
        >
          📋 查看完整审计日志
        </button>
        <button
          onClick={onReset}
          className="px-6 py-2.5 bg-amber-700 hover:bg-amber-600 text-black font-bold rounded uppercase tracking-wider text-sm transition-all"
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
}: {
  title: string
  players: PlayerState[]
  getValue: (p: PlayerState) => string
}) {
  return (
    <div className="bg-stone-800/40 border border-stone-700/50 rounded-lg p-4">
      <div className="text-stone-400 text-xs uppercase tracking-widest mb-3">{title}</div>
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{MEDALS[i]}</span>
              <span className={`font-bold text-sm ${PLAYER_COLORS[p.id]}`}>{p.name}</span>
            </div>
            <span className="text-white font-mono text-sm">{getValue(p)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
