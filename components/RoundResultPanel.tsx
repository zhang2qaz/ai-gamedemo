'use client'

import { useEffect, useState } from 'react'
import type { RoundAuditLog, PlayerState } from '@/engine/types'
import { formatMoney, formatPercent } from '@/lib/format'
import { useGameStore } from '@/store/gameStore'
import SpeakBtn from './SpeakBtn'
import { speak } from '@/lib/tts'

type Props = {
  log: RoundAuditLog
  players: PlayerState[]
  narration: string
  onNext: () => void
  isGameOver: boolean
}

const PLAYER_COLORS: Record<string, { title: string; border: string; bg: string }> = {
  A: { title: 'text-amber-400',  border: 'border-amber-700/60',  bg: 'bg-amber-950/20' },
  B: { title: 'text-sky-400',    border: 'border-sky-700/60',    bg: 'bg-sky-950/20' },
  C: { title: 'text-emerald-400', border: 'border-emerald-700/60', bg: 'bg-emerald-950/20' },
  D: { title: 'text-purple-400', border: 'border-purple-700/60', bg: 'bg-purple-950/20' },
}

const ACTION_BADGE: Record<string, string> = {
  ATK: 'bg-red-900/60 text-red-300 border-red-700',
  QUA: 'bg-blue-900/60 text-blue-300 border-blue-700',
  MKT: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  HOLD: 'bg-stone-700/60 text-stone-300 border-stone-600',
}

const ACTION_EMOJI: Record<string, string> = {
  ATK: '⚔', QUA: '🔬', MKT: '📣', HOLD: '🛡',
}

export default function RoundResultPanel({ log, players, narration, onNext, isGameOver }: Props) {
  const theme = useGameStore(s => s.theme)
  const sorted = [...log.players].sort((a, b) => b.netProfit - a.netProfit)
  const winner = sorted[0]
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null)

  const an = theme?.actionNarrative
  const fsn = theme?.finalShiftNarrative
  const t = theme?.terms
  const unit = t?.unit ?? '杯'

  // 从主题获取 action emoji
  const getEmoji = (action: string) => theme?.actionCards?.[action as keyof typeof theme.actionCards]?.emoji ?? ACTION_EMOJI[action] ?? '?'
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? action

  useEffect(() => {
    const summaryLines = sorted.map((p, i) => {
      const ps = players.find(pl => pl.id === p.id)!
      const actionName = getLabel(p.action)
      const profit = p.netProfit >= 0 ? `赚了${formatMoney(p.netProfit)}` : `亏了${formatMoney(Math.abs(p.netProfit))}`
      return `第${i + 1}名，${ps.name}，选了${actionName}，本轮${profit}。`
    }).join(' ')
    const autoText = `第${log.round}回合结算完毕。${summaryLines} ${narration}`
    const timer = setTimeout(() => speak(autoText, 1.0), 400)
    return () => clearTimeout(timer)
  }, [log.round]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-amber-400 font-black text-xl uppercase tracking-wider">第 {log.round} 回合结算</h2>
          {log.global.eventApplied && (
            <div className="text-xs bg-orange-950/50 text-orange-300 border border-orange-700/50 px-3 py-1 rounded-full">
              ⚡ {log.global.eventApplied}
            </div>
          )}
        </div>
        <button
          onClick={onNext}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl uppercase tracking-wider text-sm transition-all"
        >
          {isGameOver ? '查看最终结果 →' : `第 ${log.round + 1} 回合 →`}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {log.players.map((p) => {
          const col = PLAYER_COLORS[p.id]
          const isTopProfit = p.id === winner.id
          const shareDelta = p.newShare - p.oldShare
          const playerState = players.find(pl => pl.id === p.id)!
          return (
            <div
              key={p.id}
              className={`border-2 rounded-xl p-4 space-y-3 ${col.border} ${col.bg} ${isTopProfit ? 'ring-2 ring-yellow-500/40' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-black text-base leading-tight ${col.title}`}>{playerState.name}</span>
                {isTopProfit && <span className="text-xs text-yellow-400 font-bold">🏆 本轮最高</span>}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${ACTION_BADGE[p.action]}`}>
                  {getEmoji(p.action)} {getLabel(p.action)}
                </span>
                {p.finalShift !== 'NONE' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded border border-purple-700 bg-purple-900/50 text-purple-300">
                    ⚡ {fsn?.[p.finalShift]?.title ?? p.finalShift}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-stone-500 text-xs">本轮净{t?.profit ?? '利润'}</div>
                  <div className="text-stone-600 text-xs">
                    {Math.round(p.newShare * log.global.totalCustomers).toLocaleString()} {unit}
                  </div>
                </div>
                <div className={`text-2xl font-black font-mono ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.netProfit >= 0 ? '+' : ''}{formatMoney(p.netProfit)}
                </div>
                <button
                  onClick={() => setExpandedFormula(expandedFormula === p.id ? null : p.id)}
                  className="mt-1 text-stone-700 hover:text-stone-500 text-xs transition-all"
                >
                  {expandedFormula === p.id ? '▲ 收起' : '▼ 查看计算'}
                </button>
                {expandedFormula === p.id && (() => {
                  const cups = Math.round(p.newShare * log.global.totalCustomers)
                  const marginPct = Math.round(p.margin * 100)
                  return (
                    <div className="mt-1.5 space-y-0.5 text-xs font-mono border-t border-stone-700/40 pt-1.5">
                      <div className="text-stone-500">{cups.toLocaleString()} {unit} × ¥{p.unitPrice} = <span className="text-stone-300">¥{Math.round(p.revenue).toLocaleString()}</span></div>
                      <div className="text-stone-500">× {t?.profit ?? '利润'}率 {marginPct}% = <span className="text-stone-300">¥{Math.round(p.grossProfit).toLocaleString()}</span></div>
                      {p.revenueBonus > 0 && (
                        <div className="text-stone-500">+ 口碑溢价 = <span className="text-purple-300">+¥{Math.round(p.revenueBonus).toLocaleString()}</span></div>
                      )}
                      {p.actionCost > 0 && (
                        <div className="text-stone-500">− 行动成本 = <span className="text-red-400">-¥{p.actionCost.toLocaleString()}</span></div>
                      )}
                      <div className="border-t border-stone-700/40 pt-0.5 text-stone-400">
                        净{t?.profit ?? '利润'} = <span className={p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {p.netProfit >= 0 ? '+' : ''}¥{Math.round(p.netProfit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-stone-500 text-xs">{t?.marketShare ?? '份额'}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-white text-sm font-bold font-mono">{formatPercent(p.newShare)}</span>
                    <span className={`text-xs font-mono ${shareDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ({shareDelta >= 0 ? '+' : ''}{(shareDelta * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 rounded-l bg-stone-700" style={{ width: `${(p.oldShare * 4 * 100).toFixed(0)}%`, minWidth: '2px' }} />
                  {shareDelta >= 0
                    ? <div className="h-2 rounded-r bg-green-500" style={{ width: `${(shareDelta * 4 * 100).toFixed(0)}%`, minWidth: shareDelta > 0 ? '2px' : '0' }} />
                    : <div className="h-2 rounded-r bg-red-600" style={{ width: `${(Math.abs(shareDelta) * 4 * 100).toFixed(0)}%`, minWidth: '2px' }} />
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-700/40">
                <div>
                  <div className="text-stone-600 text-xs">{t?.competitiveness ?? '竞争力'}</div>
                  <div className="text-white font-mono font-bold text-sm">{p.competitiveness.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-stone-600 text-xs">{t?.cumulativeProfit ?? '累计利润'}</div>
                  <div className={`font-mono font-bold text-sm ${playerState.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(playerState.cumulativeProfit)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-stone-900 border border-stone-700/50 rounded-xl px-4 py-3 flex items-center gap-4">
        <span className="text-stone-500 text-xs uppercase tracking-wider font-bold shrink-0">本轮{t?.profit ?? '利润'}</span>
        <div className="flex gap-4 flex-1">
          {sorted.map((p, i) => {
            const col = PLAYER_COLORS[p.id]
            const medals = ['🥇', '🥈', '🥉', '　']
            const playerState = players.find(pl => pl.id === p.id)!
            return (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className="text-sm">{medals[i]}</span>
                <span className={`font-bold text-sm ${col.title}`}>{playerState.name}</span>
                <span className={`font-mono text-sm ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatMoney(p.netProfit)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 text-sm leading-relaxed whitespace-pre-line relative">
        <div className="absolute top-3 right-3">
          <SpeakBtn text={narration} size="md" />
        </div>
        {narration}
      </div>
    </div>
  )
}
