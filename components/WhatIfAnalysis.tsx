'use client'

import { useState, useMemo } from 'react'
import type { RoundAuditLog, PlayerState, BaseAction, PlayerId } from '@/engine/types'
import { resolveRound } from '@/engine/resolveRound'
import { useGameStore } from '@/store/gameStore'
import { formatMoney, formatPercent } from '@/lib/format'
import { PLAYER_COLORS } from '@/lib/playerColors'

type Props = {
  log: RoundAuditLog
  prevPlayers: PlayerState[]     // Players BEFORE this round
  prevGlobal: { roundNumber: number; maxRounds: number; totalCustomers: number; priceSensitivity: number; qualityWeight: number; eventQueue: import('@/engine/types').GameEvent[] }
}

const ACTIONS: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
const ACTION_EMOJI: Record<string, string> = { ATK: '⚔', QUA: '🔬', MKT: '📣', HOLD: '🛡' }

export default function WhatIfAnalysis({ log, prevPlayers, prevGlobal }: Props) {
  const theme = useGameStore(s => s.theme)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerId | null>(null)
  const [altAction, setAltAction] = useState<BaseAction | null>(null)

  const an = theme?.actionNarrative
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? action

  // Compute counterfactual
  const counterfactual = useMemo(() => {
    if (!selectedPlayer || !altAction) return null

    const actualCalc = log.players.find(p => p.id === selectedPlayer)
    if (!actualCalc || actualCalc.action === altAction) return null

    // Rebuild inputs with the alt action for the selected player
    const inputs = log.players.map(p => ({
      playerId: p.id as PlayerId,
      action: p.id === selectedPlayer ? altAction : p.action,
      finalShift: p.finalShift,
    }))

    try {
      const { newPlayers } = resolveRound(prevGlobal, prevPlayers, inputs, undefined, theme?.configOverrides)
      const altPlayer = newPlayers.find(p => p.id === selectedPlayer)
      const actualPlayer = prevPlayers.find(p => p.id === selectedPlayer)
      if (!altPlayer || !actualPlayer) return null

      const actualProfit = actualCalc.netProfit
      const altProfit = altPlayer.cumulativeProfit - actualPlayer.cumulativeProfit
      const actualShare = actualCalc.newShare
      const altShare = altPlayer.marketShare

      return {
        actualAction: actualCalc.action,
        altAction,
        actualProfit,
        altProfit,
        profitDelta: altProfit - actualProfit,
        actualShare,
        altShare,
        shareDelta: altShare - actualShare,
      }
    } catch {
      return null
    }
  }, [selectedPlayer, altAction, log, prevPlayers, prevGlobal, theme])

  return (
    <div className="bg-stone-900/60 border border-stone-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-purple-400 font-bold text-sm">🔮 如果当时...</span>
          <span className="text-stone-600 text-xs">选择不同动作会怎样？</span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Player selector */}
        <div className="flex gap-2 flex-wrap">
          {log.players.map(p => {
            const pc = PLAYER_COLORS[p.id]
            const player = prevPlayers.find(pl => pl.id === p.id)
            const isSelected = selectedPlayer === p.id
            return (
              <button
                key={p.id}
                onClick={() => { setSelectedPlayer(p.id as PlayerId); setAltAction(null) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? `${pc?.bg} ${pc?.border} border ring-1 ${pc?.border?.replace('border-', 'ring-')}`
                    : 'bg-stone-800 border border-stone-700/50 text-stone-400 hover:border-stone-600'
                }`}
              >
                <span className={isSelected ? pc?.text : ''}>{player?.name ?? p.id}</span>
                <span className="text-stone-600 ml-1">{ACTION_EMOJI[p.action]}</span>
              </button>
            )
          })}
        </div>

        {/* Alt action selector */}
        {selectedPlayer && (() => {
          const actualCalc = log.players.find(p => p.id === selectedPlayer)
          return (
            <div className="flex items-center gap-2">
              <span className="text-stone-500 text-xs">实际选了 <strong>{getLabel(actualCalc?.action ?? '')}</strong>，如果改选：</span>
              <div className="flex gap-1.5">
                {ACTIONS.filter(a => a !== actualCalc?.action).map(a => (
                  <button
                    key={a}
                    onClick={() => setAltAction(a)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      altAction === a
                        ? 'bg-purple-900/50 border border-purple-600 text-purple-300'
                        : 'bg-stone-800 border border-stone-700/50 text-stone-400 hover:border-stone-600'
                    }`}
                  >
                    {ACTION_EMOJI[a]} {getLabel(a)}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Result */}
        {counterfactual && (
          <div className="bg-stone-950/60 border border-stone-800 rounded-lg p-3 animate-fade-in-up">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-stone-600 text-xs mb-1">利润变化</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-stone-400 text-xs line-through">{formatMoney(counterfactual.actualProfit)}</span>
                  <span className="text-stone-400">→</span>
                  <span className={`font-bold font-mono ${counterfactual.altProfit >= counterfactual.actualProfit ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(counterfactual.altProfit)}
                  </span>
                </div>
                <div className={`text-xs font-bold mt-0.5 ${counterfactual.profitDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {counterfactual.profitDelta >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(counterfactual.profitDelta))}
                </div>
              </div>
              <div>
                <div className="text-stone-600 text-xs mb-1">份额变化</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-stone-400 text-xs line-through">{formatPercent(counterfactual.actualShare)}</span>
                  <span className="text-stone-400">→</span>
                  <span className={`font-bold font-mono ${counterfactual.altShare >= counterfactual.actualShare ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(counterfactual.altShare)}
                  </span>
                </div>
                <div className={`text-xs font-bold mt-0.5 ${counterfactual.shareDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {counterfactual.shareDelta >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(counterfactual.shareDelta))}
                </div>
              </div>
            </div>
            <div className="text-stone-600 text-xs mt-2 pt-2 border-t border-stone-800">
              {counterfactual.profitDelta > 0
                ? `选 ${getLabel(counterfactual.altAction)} 本轮会多赚 ${formatMoney(counterfactual.profitDelta)}`
                : counterfactual.profitDelta < 0
                ? `选 ${getLabel(counterfactual.altAction)} 本轮会少赚 ${formatMoney(Math.abs(counterfactual.profitDelta))}`
                : `选 ${getLabel(counterfactual.altAction)} 利润基本持平`
              }
              {Math.abs(counterfactual.profitDelta) > 50000 && ' — 关键决策!'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
