'use client'

import { useState, useEffect, useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { PlayerId } from '@/engine/types'
import type { IntelSource } from '@/engine/themes/types'
import SpeakBtn from './SpeakBtn'

import { PLAYER_COLORS as PC_ALL } from '@/lib/playerColors'
const PLAYER_COLORS: Record<string, { text: string; border: string; bg: string; ring: string; dot: string }> = Object.fromEntries(
  Object.entries(PC_ALL).map(([id, c]) => [id, {
    text: c.text,
    border: c.border,
    bg: c.bg,
    ring: c.border.replace('border-', 'ring-').replace('500', '500/40'),
    dot: c.dot,
  }])
)

const SOURCE_STYLE: Record<IntelSource, { badge: string; icon: string }> = {
  '行业报告':   { badge: 'bg-blue-900/40 text-blue-300 border-blue-800',    icon: '📊' },
  '竞品情报':   { badge: 'bg-red-900/40 text-red-300 border-red-800',       icon: '🕵' },
  '消费者调研': { badge: 'bg-green-900/40 text-green-300 border-green-800', icon: '📋' },
  '内部消息':   { badge: 'bg-orange-900/40 text-orange-300 border-orange-800', icon: '🔓' },
  '分析师预测': { badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-800', icon: '📈' },
  '监管动态':   { badge: 'bg-stone-700/40 text-stone-300 border-stone-600', icon: '🏛' },
}

const INTEL_PHASE_DURATION = 60 // seconds

export default function IntelTradePhase() {
  const theme = useGameStore(s => s.theme)
  const players = useGameStore(s => s.players)
  const global = useGameStore(s => s.global)
  const generatedIntel = useGameStore(s => s.generatedIntel)
  const playerIntel = useGameStore(s => s.playerIntel)
  const endIntelPhase = useGameStore(s => s.endIntelPhase)

  const [timeLeft, setTimeLeft] = useState(INTEL_PHASE_DURATION)
  const [viewingPlayer, setViewingPlayer] = useState<PlayerId | null>(null)
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      endIntelPhase()
      return
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, endIntelPhase])

  const currentIntel = generatedIntel.find(r => r.round === global.roundNumber)

  const ACTION_LABEL: Record<string, string> = theme?.actionNarrative
    ? { ATK: theme.actionNarrative.ATK.title, QUA: theme.actionNarrative.QUA.title, MKT: theme.actionNarrative.MKT.title, HOLD: theme.actionNarrative.HOLD.title }
    : { ATK: '搞促销', QUA: '研发新品', MKT: '做推广', HOLD: '精细运营' }

  // Decode playerIntel: number[] where each is round*100+cardIdx
  const getPlayerCards = useCallback((playerId: PlayerId) => {
    const indices = playerIntel[playerId] ?? []
    if (!currentIntel) return []
    return indices
      .filter(idx => Math.floor(idx / 100) === global.roundNumber)
      .map(idx => {
        const cardIdx = idx % 100
        const card = currentIntel.cards[cardIdx]
        return card ? { cardIdx, card } : null
      })
      .filter(Boolean) as { cardIdx: number; card: typeof currentIntel.cards[0] }[]
  }, [playerIntel, currentIntel, global.roundNumber])

  const toggleReveal = (key: string) => {
    setRevealedCards(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Timer color
  const timerColor = timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-green-400'
  const timerBg = timeLeft <= 10 ? 'bg-red-950/40 border-red-800/50' : timeLeft <= 30 ? 'bg-amber-950/30 border-amber-800/40' : 'bg-stone-900 border-stone-700/50'

  return (
    <div className="space-y-4">
      {/* Timer + Phase Header */}
      <div className={`rounded-xl border p-4 text-center ${timerBg}`}>
        <div className="text-amber-400 font-black text-lg mb-1">📡 情报交易阶段</div>
        <div className="text-stone-400 text-sm mb-3">
          每位玩家手持不同情报，面对面讨论、交易、虚张声势！
        </div>
        <div className={`font-mono font-black text-4xl ${timerColor} tabular-nums`}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <div className="text-stone-600 text-xs mt-1">
          {timeLeft <= 10 ? '⚠ 即将结束！' : timeLeft <= 30 ? '加快讨论节奏...' : '可以谈判、交换情报或故意误导对手'}
        </div>
      </div>

      {/* Player Intel Cards - tap to reveal */}
      <div className={`grid gap-3 ${players.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {players.map(player => {
          const c = PLAYER_COLORS[player.id]
          const cards = getPlayerCards(player.id as PlayerId)
          const isViewing = viewingPlayer === player.id

          return (
            <div
              key={player.id}
              className={`rounded-xl border transition-all ${
                isViewing
                  ? `${c.border} ${c.bg} ring-2 ${c.ring}`
                  : 'border-stone-700/50 bg-stone-900/60'
              }`}
            >
              {/* Player header - tap to toggle view */}
              <button
                onClick={() => setViewingPlayer(isViewing ? null : player.id as PlayerId)}
                className="w-full p-3 text-center cursor-pointer hover:bg-stone-800/30 transition-all rounded-t-xl"
              >
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${c.dot}`} />
                <div className={`font-black text-sm ${c.text}`}>{player.name}</div>
                <div className="text-stone-500 text-xs">
                  {cards.length} 张情报 · {isViewing ? '点击收起' : '点击查看'}
                </div>
              </button>

              {/* Cards (hidden unless viewing) */}
              {isViewing && (
                <div className="p-3 pt-0 space-y-2">
                  <div className="text-xs text-red-400/80 text-center font-bold mb-2">
                    🔒 仅 {player.name} 可看 · 其他人请背对
                  </div>
                  {cards.length === 0 ? (
                    <div className="text-stone-600 text-xs text-center py-2">本轮无情报</div>
                  ) : (
                    cards.map(({ cardIdx, card }) => {
                      const style = SOURCE_STYLE[card.source]
                      const key = `${player.id}-${cardIdx}`
                      const isRevealed = revealedCards.has(key)

                      return (
                        <div
                          key={key}
                          className="bg-stone-950/80 border border-stone-800 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${style.badge}`}>
                              {style.icon} {card.source}
                            </span>
                            <SpeakBtn
                              text={`情报内容：${card.text}。建议选择${ACTION_LABEL[card.impliedAction]}。`}
                            />
                          </div>

                          {!isRevealed ? (
                            <button
                              onClick={() => toggleReveal(key)}
                              className="w-full py-2 text-center text-stone-500 hover:text-stone-300 text-xs border border-stone-700/50 rounded bg-stone-900/50 transition-all"
                            >
                              🃏 点击翻开情报
                            </button>
                          ) : (
                            <>
                              <p className="text-stone-300 text-xs leading-relaxed">
                                {card.text}
                              </p>
                              <div className="flex items-center gap-1">
                                <span className="text-stone-600 text-xs">建议：</span>
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                                  {ACTION_LABEL[card.impliedAction] ?? card.impliedAction}
                                </span>
                              </div>
                              {card.tag && (
                                <div className="text-stone-600 text-xs font-mono">{card.tag}</div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={endIntelPhase}
          className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base transition-all"
        >
          ⚔ 结束讨论 · 进入选牌
        </button>
      </div>

      {/* Tips */}
      <div className="bg-stone-900/40 border border-stone-800/40 rounded-lg p-3">
        <div className="text-stone-600 text-xs space-y-1">
          <div>💡 <strong className="text-stone-500">社交策略提示：</strong></div>
          <div>• 你可以如实分享情报来结盟，也可以故意说谎来误导对手</div>
          <div>• 情报有真有假 — 对手分享的情报未必可信</div>
          <div>• 没有情报的行动方向可能正是对手的盲区</div>
        </div>
      </div>
    </div>
  )
}
