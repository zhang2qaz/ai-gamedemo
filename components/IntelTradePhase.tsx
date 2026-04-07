'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { PlayerId, BaseAction } from '@/engine/types'
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

const ACTION_OPTIONS: BaseAction[] = ['ATK', 'MKT', 'QUA', 'HOLD']

const INTEL_PHASE_DURATION = 90 // increased from 60 to allow trading

export default function IntelTradePhase() {
  const theme = useGameStore(s => s.theme)
  const players = useGameStore(s => s.players)
  const global = useGameStore(s => s.global)
  const generatedIntel = useGameStore(s => s.generatedIntel)
  const playerIntel = useGameStore(s => s.playerIntel)
  const intelShares = useGameStore(s => s.intelShares)
  const announcements = useGameStore(s => s.announcements)
  const revengeMarks = useGameStore(s => s.revengeMarks)
  const endIntelPhase = useGameStore(s => s.endIntelPhase)
  const shareIntel = useGameStore(s => s.shareIntel)
  const announce = useGameStore(s => s.announce)
  const setRevengeMark = useGameStore(s => s.setRevengeMark)

  const [timeLeft, setTimeLeft] = useState(INTEL_PHASE_DURATION)
  const [activeTab, setActiveTab] = useState<'intel' | 'announce' | 'revenge'>('intel')
  const [viewingPlayer, setViewingPlayer] = useState<PlayerId | null>(null)
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())
  // Share modal state
  const [sharingCard, setSharingCard] = useState<{ from: PlayerId; cardIdx: number; realAction: BaseAction } | null>(null)
  const [shareTarget, setShareTarget] = useState<PlayerId | null>(null)
  const [shareClaimedAction, setShareClaimedAction] = useState<BaseAction | null>(null)

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

  const getPlayerCards = useCallback((playerId: PlayerId) => {
    const indices = playerIntel[playerId] ?? []
    if (!currentIntel) return []
    return indices
      .filter(idx => Math.floor(idx / 100) === global.roundNumber)
      .map(idx => {
        const cardIdx = idx % 100
        const card = currentIntel.cards[cardIdx]
        return card ? { cardIdx, fullIdx: idx, card } : null
      })
      .filter(Boolean) as { cardIdx: number; fullIdx: number; card: typeof currentIntel.cards[0] }[]
  }, [playerIntel, currentIntel, global.roundNumber])

  // Cards shared TO a player
  const getReceivedShares = useCallback((playerId: PlayerId) => {
    return intelShares.filter(s => s.to === playerId)
  }, [intelShares])

  const toggleReveal = (key: string) => {
    setRevealedCards(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleStartShare = (from: PlayerId, fullIdx: number, realAction: BaseAction) => {
    setSharingCard({ from, cardIdx: fullIdx, realAction })
    setShareTarget(null)
    setShareClaimedAction(realAction) // default to truth
  }

  const handleConfirmShare = () => {
    if (!sharingCard || !shareTarget || !shareClaimedAction) return
    const isBluff = shareClaimedAction !== sharingCard.realAction
    shareIntel(sharingCard.from, shareTarget, sharingCard.cardIdx, shareClaimedAction, isBluff)
    setSharingCard(null)
    setShareTarget(null)
    setShareClaimedAction(null)
  }

  const playerAnnouncement = useMemo(() => {
    const map: Record<string, BaseAction> = {}
    for (const a of announcements) map[a.playerId] = a.declaredAction
    return map
  }, [announcements])

  // Timer color
  const timerColor = timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-green-400'
  const timerBg = timeLeft <= 10 ? 'bg-red-950/40 border-red-800/50' : timeLeft <= 30 ? 'bg-amber-950/30 border-amber-800/40' : 'bg-stone-900 border-stone-700/50'

  return (
    <div className="space-y-4">
      {/* Timer + Phase Header */}
      <div className={`rounded-xl border p-4 text-center ${timerBg}`}>
        <div className="text-amber-400 font-black text-lg mb-1">📡 情报交易阶段</div>
        <div className="text-stone-400 text-sm mb-3">
          第 {global.roundNumber} 回合 · 交换情报、宣布意图、标记对手
        </div>
        <div className={`font-mono font-black text-4xl ${timerColor} tabular-nums`}>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
        <div className="text-stone-600 text-xs mt-1">
          {timeLeft <= 10 ? '⚠ 即将结束！' : timeLeft <= 30 ? '加快节奏...' : '讨论、交易、虚张声势'}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-stone-900 rounded-lg p-1">
        {[
          { key: 'intel' as const, label: '🃏 情报交易', count: intelShares.length },
          { key: 'announce' as const, label: '📢 公开宣言', count: announcements.length },
          { key: 'revenge' as const, label: '🎯 标记对手', count: Object.values(revengeMarks).filter(Boolean).length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-2 rounded-md text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-stone-700 text-white'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'intel' && (
        <div className="space-y-3">
          {/* Share Modal */}
          {sharingCard && (
            <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4 space-y-3">
              <div className="text-amber-400 font-bold text-sm">📤 分享情报给谁？</div>
              <div className="text-stone-400 text-xs">
                你可以如实分享，也可以篡改建议动作来误导对手
              </div>

              {/* Target selection */}
              <div className="flex flex-wrap gap-2">
                {players.filter(p => p.id !== sharingCard.from).map(p => {
                  const c = PLAYER_COLORS[p.id]
                  return (
                    <button
                      key={p.id}
                      onClick={() => setShareTarget(p.id as PlayerId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        shareTarget === p.id
                          ? `${c.border} ${c.bg} ${c.text}`
                          : 'border-stone-700 text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>

              {/* Claimed action (can lie!) */}
              <div>
                <div className="text-stone-500 text-xs mb-1.5">声称的建议动作：</div>
                <div className="flex gap-2">
                  {ACTION_OPTIONS.map(a => (
                    <button
                      key={a}
                      onClick={() => setShareClaimedAction(a)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        shareClaimedAction === a
                          ? a === sharingCard.realAction
                            ? 'border-green-600 bg-green-900/30 text-green-300'
                            : 'border-red-600 bg-red-900/30 text-red-300'
                          : 'border-stone-700 text-stone-500 hover:border-stone-500'
                      }`}
                    >
                      {ACTION_LABEL[a]}
                      {shareClaimedAction === a && a !== sharingCard.realAction && (
                        <span className="ml-1 text-red-500">虚</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSharingCard(null)}
                  className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-400 text-xs font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmShare}
                  disabled={!shareTarget || !shareClaimedAction}
                  className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 text-black text-xs font-bold transition-all"
                >
                  {shareClaimedAction !== sharingCard.realAction ? '🎭 发送虚假情报' : '✅ 如实分享'}
                </button>
              </div>
            </div>
          )}

          {/* Player Intel Cards */}
          <div className={`grid gap-3 ${players.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {players.map(player => {
              const c = PLAYER_COLORS[player.id]
              const cards = getPlayerCards(player.id as PlayerId)
              const received = getReceivedShares(player.id as PlayerId)
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
                  <button
                    onClick={() => setViewingPlayer(isViewing ? null : player.id as PlayerId)}
                    className="w-full p-3 text-center cursor-pointer hover:bg-stone-800/30 transition-all rounded-t-xl"
                  >
                    <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${c.dot}`} />
                    <div className={`font-black text-sm ${c.text}`}>{player.name}</div>
                    <div className="text-stone-500 text-xs">
                      {cards.length} 张情报
                      {received.length > 0 && ` · ${received.length} 收到`}
                    </div>
                  </button>

                  {isViewing && (
                    <div className="p-3 pt-0 space-y-2">
                      <div className="text-xs text-red-400/80 text-center font-bold mb-2">
                        🔒 仅 {player.name} 可看
                      </div>

                      {/* Own cards */}
                      {cards.length === 0 ? (
                        <div className="text-stone-600 text-xs text-center py-2">本轮无情报</div>
                      ) : (
                        cards.map(({ cardIdx, fullIdx, card }) => {
                          const style = SOURCE_STYLE[card.source]
                          const key = `${player.id}-${cardIdx}`
                          const isRevealed = revealedCards.has(key)
                          const alreadyShared = intelShares.some(s => s.from === player.id && s.cardIdx === fullIdx)

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
                                  <p className="text-stone-300 text-xs leading-relaxed">{card.text}</p>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span className="text-stone-600 text-xs">建议：</span>
                                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                                        {ACTION_LABEL[card.impliedAction]}
                                      </span>
                                    </div>
                                    {/* Share button */}
                                    {!alreadyShared ? (
                                      <button
                                        onClick={() => handleStartShare(player.id as PlayerId, fullIdx, card.impliedAction)}
                                        className="text-xs px-2 py-1 rounded bg-amber-900/40 text-amber-400 border border-amber-800/50 hover:bg-amber-800/40 transition-all"
                                      >
                                        📤 分享
                                      </button>
                                    ) : (
                                      <span className="text-xs text-green-500/70">✓ 已分享</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })
                      )}

                      {/* Received intel from others */}
                      {received.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-stone-800/50">
                          <div className="text-xs text-stone-500 font-bold mb-1.5">📩 收到的情报：</div>
                          {received.map((share, i) => {
                            const sender = players.find(p => p.id === share.from)
                            const senderColor = PLAYER_COLORS[share.from]
                            return (
                              <div key={i} className="bg-stone-900/60 border border-stone-800/50 rounded-lg p-2 mb-1.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${senderColor?.dot ?? 'bg-stone-500'}`} />
                                  <span className={`text-xs font-bold ${senderColor?.text ?? 'text-stone-400'}`}>
                                    {sender?.name ?? share.from}
                                  </span>
                                  <span className="text-stone-600 text-xs">分享了情报</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-stone-500 text-xs">建议动作：</span>
                                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-800 text-amber-300">
                                    {ACTION_LABEL[share.claimedAction]}
                                  </span>
                                  <span className="text-stone-600 text-xs ml-1">（真假未知）</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* P1-2: Announcement Tab */}
      {activeTab === 'announce' && (
        <div className="space-y-3">
          <div className="bg-stone-900/60 border border-stone-700/50 rounded-xl p-3">
            <div className="text-stone-400 text-xs mb-2">
              📢 公开宣布你的意图 — 言行一致可获 <span className="text-green-400 font-bold">¥15,000</span> 奖金，食言扣 <span className="text-red-400 font-bold">¥5,000</span>
            </div>
            <div className="text-stone-600 text-xs">
              你也可以故意声东击西来迷惑对手，但要承受小额惩罚
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1">
            {players.map(player => {
              const c = PLAYER_COLORS[player.id]
              const currentAnn = playerAnnouncement[player.id]

              return (
                <div key={player.id} className={`rounded-xl border p-3 ${c.border} ${c.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                      <span className={`font-bold text-sm ${c.text}`}>{player.name}</span>
                    </div>
                    {currentAnn && (
                      <button
                        onClick={() => announce(player.id as PlayerId, null)}
                        className="text-xs text-stone-500 hover:text-red-400"
                      >
                        撤回
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {ACTION_OPTIONS.map(a => (
                      <button
                        key={a}
                        onClick={() => announce(player.id as PlayerId, a)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                          currentAnn === a
                            ? 'border-amber-500 bg-amber-900/30 text-amber-300 ring-1 ring-amber-500/30'
                            : 'border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {ACTION_LABEL[a]}
                      </button>
                    ))}
                  </div>
                  {currentAnn && (
                    <div className="mt-2 text-xs text-amber-400/80 text-center">
                      📢 &ldquo;我这回合打算 <strong>{ACTION_LABEL[currentAnn]}</strong>&rdquo;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* P1-3: Revenge/Mark Tab */}
      {activeTab === 'revenge' && (
        <div className="space-y-3">
          <div className="bg-stone-900/60 border border-stone-700/50 rounded-xl p-3">
            <div className="text-stone-400 text-xs mb-2">
              🎯 标记一个对手 — 如果你本轮选择 <span className="text-red-400 font-bold">促销(ATK)</span> 攻击，额外获得 <span className="text-green-400 font-bold">¥20,000</span> 复仇奖金
            </div>
            <div className="text-stone-600 text-xs">
              每位玩家每轮只能标记一个对手。标记是公开的，被标记者会知道
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1">
            {players.map(player => {
              const c = PLAYER_COLORS[player.id]
              const currentMark = revengeMarks[player.id as PlayerId]

              return (
                <div key={player.id} className={`rounded-xl border p-3 ${currentMark ? c.border + ' ' + c.bg : 'border-stone-700/50 bg-stone-900/60'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className={`font-bold text-sm ${c.text}`}>{player.name}</span>
                    <span className="text-stone-600 text-xs">标记对手：</span>
                  </div>
                  <div className="flex gap-2">
                    {players.filter(p => p.id !== player.id).map(target => {
                      const tc = PLAYER_COLORS[target.id]
                      const isMarked = currentMark === target.id
                      return (
                        <button
                          key={target.id}
                          onClick={() => setRevengeMark(player.id as PlayerId, isMarked ? null : target.id as PlayerId)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                            isMarked
                              ? 'border-red-500 bg-red-900/30 text-red-300 ring-1 ring-red-500/30'
                              : 'border-stone-700 text-stone-500 hover:border-stone-500'
                          }`}
                        >
                          {isMarked && '🎯 '}{target.name}
                        </button>
                      )
                    })}
                  </div>
                  {currentMark && (
                    <div className="mt-2 text-xs text-red-400/80 text-center">
                      🎯 已标记 <strong>{players.find(p => p.id === currentMark)?.name}</strong>
                      {' '}— 选ATK可获复仇奖金
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Show who's being targeted */}
          {Object.values(revengeMarks).some(Boolean) && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
              <div className="text-xs text-red-400 font-bold mb-1">⚠ 被标记的玩家：</div>
              {players.map(p => {
                const markers = Object.entries(revengeMarks)
                  .filter(([_, target]) => target === p.id)
                  .map(([from]) => players.find(pl => pl.id === from)?.name ?? from)
                if (markers.length === 0) return null
                return (
                  <div key={p.id} className="text-xs text-stone-400">
                    <span className={`font-bold ${PLAYER_COLORS[p.id]?.text ?? ''}`}>{p.name}</span>
                    {' ← 被 '}{markers.join('、')}{' 标记'}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={endIntelPhase}
          className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base transition-all"
        >
          ⚔ 结束讨论 · 进入选牌
        </button>
      </div>

      {/* Summary bar */}
      <div className="bg-stone-900/40 border border-stone-800/40 rounded-lg p-3">
        <div className="text-stone-600 text-xs space-y-1">
          <div>💡 <strong className="text-stone-500">本轮互动：</strong>
            {intelShares.length} 次情报交易 ·
            {announcements.length} 条宣言 ·
            {Object.values(revengeMarks).filter(Boolean).length} 个标记
          </div>
          <div>• 分享情报可以是真话也可以是假话 — 对手无法验证</div>
          <div>• 宣言言行一致 +¥15k，食言 -¥5k（值得冒险吗？）</div>
          <div>• 标记对手后选ATK可获 +¥20k 复仇奖金</div>
        </div>
      </div>
    </div>
  )
}
