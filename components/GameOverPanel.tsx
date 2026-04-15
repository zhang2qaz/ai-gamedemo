'use client'

import { useState, useEffect, useRef } from 'react'
import type { PlayerState, RoundAuditLog, BaseAction } from '@/engine/types'
import { formatMoney, formatPercent } from '@/lib/format'
import { getFinalRanking, getShareRanking } from '@/engine/resolveGame'
import { useGameStore } from '@/store/gameStore'
import { recordGame, getHistory, getAllAchievements, getAchievementDetails } from '@/lib/gameHistory'
import type { GameHistoryData } from '@/lib/gameHistory'

type Props = {
  players: PlayerState[]
  logs: RoundAuditLog[]
  gameNarration: string
  onReset: () => void
  onShowAuditLog: () => void
}

import { PLAYER_COLORS, MEDALS } from '@/lib/playerColors'

// ── 回合奖项计算 ──
type Award = { emoji: string; title: string; player: string; detail: string }

function computeAwards(players: PlayerState[], logs: RoundAuditLog[]): Award[] {
  const awards: Award[] = []

  // 最具攻击性
  const atkCounts: Record<string, number> = {}
  const mktCounts: Record<string, number> = {}
  const quaCounts: Record<string, number> = {}
  const holdCounts: Record<string, number> = {}
  const biggestSwing = { player: '', delta: 0 }

  for (const log of logs) {
    for (const p of log.players) {
      atkCounts[p.id] = (atkCounts[p.id] || 0) + (p.action === 'ATK' ? 1 : 0)
      mktCounts[p.id] = (mktCounts[p.id] || 0) + (p.action === 'MKT' ? 1 : 0)
      quaCounts[p.id] = (quaCounts[p.id] || 0) + (p.action === 'QUA' ? 1 : 0)
      holdCounts[p.id] = (holdCounts[p.id] || 0) + (p.action === 'HOLD' ? 1 : 0)

      const shareDelta = Math.abs(p.newShare - p.oldShare)
      if (shareDelta > biggestSwing.delta) {
        biggestSwing.player = p.id
        biggestSwing.delta = shareDelta
      }
    }
  }

  const getName = (id: string) => players.find(p => p.id === id)?.name ?? id

  // 最高单回合利润
  let bestRoundProfit = { player: '', profit: 0, round: 0 }
  for (const log of logs) {
    for (const p of log.players) {
      if (p.netProfit > bestRoundProfit.profit) {
        bestRoundProfit = { player: p.id, profit: p.netProfit, round: log.round }
      }
    }
  }
  if (bestRoundProfit.player) {
    awards.push({
      emoji: '💎',
      title: '单回合之王',
      player: getName(bestRoundProfit.player),
      detail: `第${bestRoundProfit.round}回合赚 ${formatMoney(bestRoundProfit.profit)}`,
    })
  }

  // 最具攻击性
  const topAtk = Object.entries(atkCounts).sort((a, b) => b[1] - a[1])[0]
  if (topAtk && topAtk[1] >= 2) {
    awards.push({
      emoji: '⚔️',
      title: '价格战狂人',
      player: getName(topAtk[0]),
      detail: `${topAtk[1]} 次促销攻击`,
    })
  }

  // 品质大师
  const topQua = Object.entries(quaCounts).sort((a, b) => b[1] - a[1])[0]
  if (topQua && topQua[1] >= 2) {
    awards.push({
      emoji: '🔬',
      title: '品质大师',
      player: getName(topQua[0]),
      detail: `${topQua[1]} 次研发投入`,
    })
  }

  // 营销达人
  const topMkt = Object.entries(mktCounts).sort((a, b) => b[1] - a[1])[0]
  if (topMkt && topMkt[1] >= 2) {
    awards.push({
      emoji: '📣',
      title: '营销达人',
      player: getName(topMkt[0]),
      detail: `${topMkt[1]} 次品牌推广`,
    })
  }

  // 最大份额波动
  if (biggestSwing.player) {
    awards.push({
      emoji: '🎢',
      title: '过山车',
      player: getName(biggestSwing.player),
      detail: `单回合份额变动 ${(biggestSwing.delta * 100).toFixed(1)}%`,
    })
  }

  // 最稳健
  const topHold = Object.entries(holdCounts).sort((a, b) => b[1] - a[1])[0]
  if (topHold && topHold[1] >= 3) {
    awards.push({
      emoji: '🧘',
      title: '稳如泰山',
      player: getName(topHold[0]),
      detail: `${topHold[1]} 次稳健`,
    })
  }

  return awards.slice(0, 4) // max 4 awards
}

export default function GameOverPanel({ players, logs, gameNarration, onReset, onShowAuditLog }: Props) {
  const theme = useGameStore(s => s.theme)
  const playerCount = useGameStore(s => s.playerCount)
  const t = theme?.terms
  const profitRanked = getFinalRanking(players)
  const shareRanked = getShareRanking(players)
  const winner = profitRanked[0]
  const awards = computeAwards(players, logs)

  const [history, setHistory] = useState<GameHistoryData | null>(null)
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const [showStats, setShowStats] = useState(false)

  // Record game on mount (with deduplication guard)
  const recordedRef = useRef(false)
  useEffect(() => {
    if (recordedRef.current) return
    recordedRef.current = true

    const oldHistory = getHistory()
    const oldAchievements = new Set(oldHistory.stats.achievements)

    const newHistory = recordGame({
      themeId: theme?.id ?? 'unknown',
      playerCount,
      winner: winner.name,
      winnerProfit: winner.cumulativeProfit,
      rounds: logs.length,
      // Keep original player order so playerResults[0] is P1 (not always winner)
      playerResults: players.map(p => {
        const rankIdx = profitRanked.findIndex(pr => pr.id === p.id)
        return { name: p.name, profit: p.cumulativeProfit, rank: rankIdx + 1 }
      }),
    })

    setHistory(newHistory)

    // Find newly unlocked achievements
    const justUnlocked = newHistory.stats.achievements.filter(a => !oldAchievements.has(a))
    setNewAchievements(justUnlocked)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* 冠军宣告 */}
      <div className="relative text-center space-y-3 py-8 glass-card rounded-2xl overflow-hidden">
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

      {/* 新解锁成就 */}
      {newAchievements.length > 0 && (
        <div className="glass-card rounded-xl p-4 animate-fade-in-up border border-amber-700/50" style={{ animationDelay: '150ms' }}>
          <div className="text-amber-400 text-xs uppercase tracking-[0.2em] font-bold mb-3">🎖 新解锁成就!</div>
          <div className="flex gap-3 flex-wrap">
            {newAchievements.map(id => {
              const ach = getAchievementDetails(id)
              return ach ? (
                <div key={id} className="flex items-center gap-2 bg-amber-950/40 rounded-lg px-3 py-2 border border-amber-800/40 animate-slide-in-scale">
                  <span className="text-2xl">{ach.emoji}</span>
                  <span className="text-amber-300 font-bold text-sm">{ach.name}</span>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* 回合奖项 */}
      {awards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {awards.map((award, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-3 text-center animate-fade-in-up"
              style={{ animationDelay: `${250 + i * 100}ms` }}
            >
              <div className="text-2xl mb-1">{award.emoji}</div>
              <div className="text-stone-300 text-xs font-bold">{award.title}</div>
              <div className="text-stone-400 text-xs mt-0.5">{award.player}</div>
              <div className="text-stone-600 text-xs mt-0.5">{award.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* 双排名 */}
      <div className="grid grid-cols-2 gap-3">
        <RankingTable title={`${t?.cumulativeProfit ?? '累计利润'}排名`} players={profitRanked} getValue={p => formatMoney(p.cumulativeProfit)} delay={300} />
        <RankingTable title={`${t?.marketShare ?? '市场份额'}排名`} players={shareRanked} getValue={p => formatPercent(p.marketShare)} delay={400} />
      </div>

      {/* 局后复盘 */}
      <div className="glass-card rounded-xl p-4 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <div className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold mb-3">局后复盘</div>
        <div className="border-l-2 border-amber-600/30 pl-3">
          <pre className="text-stone-300 text-xs font-mono leading-relaxed whitespace-pre-wrap">{gameNarration}</pre>
        </div>
      </div>

      {/* 累计战绩 */}
      {history && (
        <div className="glass-card rounded-xl animate-fade-in-up" style={{ animationDelay: '600ms' }}>
          <button
            onClick={() => setShowStats(s => !s)}
            className="w-full p-4 text-left flex items-center justify-between cursor-pointer hover:bg-stone-800/30 transition-all rounded-xl"
          >
            <div className="flex items-center gap-2">
              <span className="text-stone-400 text-xs uppercase tracking-[0.2em] font-bold">📊 累计战绩</span>
              <span className="text-stone-600 text-xs font-mono">{history.stats.totalGames} 场</span>
            </div>
            <span className="text-stone-600 text-xs">{showStats ? '▲' : '▼'}</span>
          </button>

          {showStats && (
            <div className="px-4 pb-4 space-y-3">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <StatCell label="胜场" value={`${history.stats.wins}`} sub={`${history.stats.totalGames}场中`} />
                <StatCell label="胜率" value={history.stats.totalGames > 0 ? `${Math.round(history.stats.wins / history.stats.totalGames * 100)}%` : '-'} />
                <StatCell label="最佳连胜" value={`${history.stats.bestWinStreak}`} highlight={history.stats.bestWinStreak >= 3} />
                <StatCell label="当前连胜" value={`${history.stats.winStreak}`} highlight={history.stats.winStreak >= 2} />
                <StatCell label="最高利润" value={formatMoney(history.stats.bestProfit)} />
                <StatCell label="最爱场景" value={history.stats.favoriteTheme || '-'} />
              </div>

              {/* Achievements */}
              <div>
                <div className="text-stone-500 text-xs mb-2">成就 ({history.stats.achievements.length}/{getAllAchievements().length})</div>
                <div className="flex gap-2 flex-wrap">
                  {getAllAchievements().map(ach => {
                    const unlocked = history.stats.achievements.includes(ach.id)
                    return (
                      <div
                        key={ach.id}
                        className={`text-xs px-2 py-1 rounded-lg border ${
                          unlocked
                            ? 'bg-amber-950/40 border-amber-800/40 text-amber-300'
                            : 'bg-stone-900/40 border-stone-800/40 text-stone-700'
                        }`}
                        title={ach.name}
                      >
                        {ach.emoji} {unlocked ? ach.name : '???'}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-center flex-wrap animate-fade-in-up" style={{ animationDelay: '700ms' }}>
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
          ⚔ 同场景再战
        </button>
        <button
          onClick={() => useGameStore.getState().backToThemeSelect()}
          className="px-6 py-2.5 glass-card hover:bg-stone-700/40 text-stone-200 font-bold rounded-xl text-sm transition-all"
        >
          🏠 换场景
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

function StatCell({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-stone-900/60 rounded-lg p-2 text-center">
      <div className="text-stone-600 text-xs">{label}</div>
      <div className={`font-bold text-sm font-mono ${highlight ? 'text-amber-400' : 'text-stone-200'}`}>{value}</div>
      {sub && <div className="text-stone-700 text-xs">{sub}</div>}
    </div>
  )
}
