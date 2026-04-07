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

const INTEL_PHASE_DURATION = 90

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
  // Full-screen private overlay — only one player views at a time
  const [activePlayer, setActivePlayer] = useState<PlayerId | null>(null)
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set())
  // Share modal state (inside overlay)
  const [sharingCard, setSharingCard] = useState<{ from: PlayerId; cardIdx: number; realAction: BaseAction } | null>(null)
  const [shareTarget, setShareTarget] = useState<PlayerId | null>(null)
  const [shareClaimedAction, setShareClaimedAction] = useState<BaseAction | null>(null)
  // Track which players have viewed their intel
  const [viewedPlayers, setViewedPlayers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (timeLeft <= 0) {
      setActivePlayer(null)
      endIntelPhase()
      return
    }
    // Pause timer while a player overlay is open
    if (activePlayer) return
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, endIntelPhase, activePlayer])

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
    setShareClaimedAction(realAction)
  }

  const handleConfirmShare = () => {
    if (!sharingCard || !shareTarget || !shareClaimedAction) return
    const isBluff = shareClaimedAction !== sharingCard.realAction
    shareIntel(sharingCard.from, shareTarget, sharingCard.cardIdx, shareClaimedAction, isBluff)
    setSharingCard(null)
    setShareTarget(null)
    setShareClaimedAction(null)
  }

  const handleOpenPlayer = (id: PlayerId) => {
    setActivePlayer(id)
    setViewedPlayers(prev => new Set(prev).add(id))
    setSharingCard(null)
  }

  const handleCloseOverlay = () => {
    setActivePlayer(null)
    setSharingCard(null)
  }

  const playerAnnouncement = useMemo(() => {
    const map: Record<string, BaseAction> = {}
    for (const a of announcements) map[a.playerId] = a.declaredAction
    return map
  }, [announcements])

  const timerColor = timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-green-400'
  const timerBg = timeLeft <= 10 ? 'bg-red-950/40 border-red-800/50' : timeLeft <= 30 ? 'bg-amber-950/30 border-amber-800/40' : 'bg-stone-900 border-stone-700/50'

  return (
    <>
      <div className="space-y-4">
        {/* Timer + Phase Header */}
        <div className={`rounded-xl border p-4 text-center ${timerBg}`}>
          <div className="text-amber-400 font-black text-lg mb-1">📡 情报交易阶段</div>
          <div className="text-stone-400 text-sm mb-3">
            第 {global.roundNumber} 回合 · 每位玩家轮流查看自己的情报
          </div>
          <div className={`font-mono font-black text-4xl ${timerColor} tabular-nums`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
          <div className="text-stone-600 text-xs mt-1">
            {timeLeft <= 10 ? '⚠ 即将结束！' : timeLeft <= 30 ? '加快节奏...' : '点击你的名字查看私密情报'}
          </div>
        </div>

        {/* Player buttons — tap to open private overlay */}
        <div className="bg-stone-900/60 border border-stone-700/50 rounded-xl p-5 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-stone-200 font-bold">轮流查看情报</div>
            <div className="text-stone-500 text-sm">
              点击自己的按钮查看私密情报、分享给他人、宣布意图
            </div>
          </div>

          <div className={`grid gap-3 ${players.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {players.map(player => {
              const c = PLAYER_COLORS[player.id]
              const hasViewed = viewedPlayers.has(player.id)
              const cards = getPlayerCards(player.id as PlayerId)
              const received = getReceivedShares(player.id as PlayerId)
              const ann = playerAnnouncement[player.id]
              const mark = revengeMarks[player.id as PlayerId]

              return (
                <button
                  key={player.id}
                  onClick={() => handleOpenPlayer(player.id as PlayerId)}
                  className={`relative rounded-xl border p-4 text-center transition-all select-none cursor-pointer active:scale-95 ${
                    hasViewed
                      ? 'bg-stone-800/30 border-stone-700/50 hover:bg-stone-800/50'
                      : `${c.bg} ${c.border} hover:ring-2 ${c.ring}`
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${c.dot}`} />
                  <div className={`font-black text-sm leading-tight mb-1 ${c.text}`}>
                    {player.name}
                  </div>
                  <div className="text-stone-500 text-xs">
                    {cards.length} 张情报
                    {received.length > 0 && ` · ${received.length} 收到`}
                  </div>
                  {hasViewed && (
                    <div className="text-stone-600 text-xs mt-1">✓ 已查看</div>
                  )}
                  {/* Public status badges */}
                  <div className="flex gap-1 justify-center mt-2 flex-wrap">
                    {ann && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/50">
                        📢 {ACTION_LABEL[ann]}
                      </span>
                    )}
                    {mark && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/50">
                        🎯 已标记
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Public announcements summary (visible to all) */}
        {announcements.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-4 py-3">
            <div className="text-amber-400 text-xs font-bold mb-1.5">📢 公开宣言</div>
            <div className="flex flex-wrap gap-2">
              {announcements.map(ann => {
                const c = PLAYER_COLORS[ann.playerId]
                const player = players.find(p => p.id === ann.playerId)
                return (
                  <span key={ann.playerId} className="text-xs">
                    <span className={c?.text ?? ''}>{player?.name}</span>
                    <span className="text-stone-600"> → </span>
                    <span className="text-stone-300 font-bold">{ACTION_LABEL[ann.declaredAction]}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Revenge marks summary (visible to all) */}
        {Object.values(revengeMarks).some(Boolean) && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3">
            <div className="text-red-400 text-xs font-bold mb-1">🎯 复仇标记（公开）</div>
            {Object.entries(revengeMarks).map(([markerId, targetId]) => {
              if (!targetId) return null
              const marker = players.find(p => p.id === markerId)
              const target = players.find(p => p.id === targetId)
              return (
                <div key={markerId} className="text-xs text-stone-400">
                  <span className={PLAYER_COLORS[markerId]?.text ?? ''}>{marker?.name}</span>
                  <span className="text-stone-600"> → 标记 </span>
                  <span className={PLAYER_COLORS[targetId]?.text ?? ''}>{target?.name}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => { setActivePlayer(null); endIntelPhase() }}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base transition-all"
          >
            ⚔ 结束讨论 · 进入选牌
          </button>
        </div>

        {/* Tips */}
        <div className="bg-stone-900/40 border border-stone-800/40 rounded-lg p-3">
          <div className="text-stone-600 text-xs space-y-1">
            <div>💡 <strong className="text-stone-500">本轮互动：</strong>
              {intelShares.length} 次情报交易 ·
              {announcements.length} 条宣言 ·
              {Object.values(revengeMarks).filter(Boolean).length} 个标记
            </div>
            <div>• 情报只有你自己能看 — 面对面讨论时可以说真话也可以说假话</div>
            <div>• 宣言言行一致 +¥10k，食言 -¥10k（风险对等）</div>
            <div>• 标记对手后选ATK可获 +¥15k，但对手也选ATK则标记无效</div>
          </div>
        </div>
      </div>

      {/* ═══ Full-screen Private Overlay ═══ */}
      {activePlayer && (() => {
        const player = players.find(p => p.id === activePlayer)!
        const c = PLAYER_COLORS[activePlayer]
        const cards = getPlayerCards(activePlayer)
        const received = getReceivedShares(activePlayer)
        const currentAnn = playerAnnouncement[activePlayer]
        const currentMark = revengeMarks[activePlayer]

        return (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-start overflow-y-auto py-6 px-4 gap-4">
            {/* Header */}
            <div className={`text-center px-6 py-3 rounded-xl border ${c.bg} ${c.border} w-full max-w-md`}>
              <div className={`font-black text-xl ${c.text}`}>{player.name}</div>
              <div className="text-stone-400 text-sm mt-1">🔒 私密情报面板 · 其他人请背对</div>
              <div className={`font-mono text-sm mt-1 ${timerColor}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>

            {/* ── 我的情报卡 ── */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-stone-500 text-xs font-bold">🃏 我的情报 ({cards.length} 张)</div>

              {/* Share modal */}
              {sharingCard && (
                <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-3 space-y-2">
                  <div className="text-amber-400 font-bold text-sm">📤 分享给谁？</div>
                  <div className="text-stone-500 text-xs">可以如实分享，也可以篡改建议动作来误导</div>
                  <div className="flex flex-wrap gap-2">
                    {players.filter(p => p.id !== activePlayer).map(p => {
                      const tc = PLAYER_COLORS[p.id]
                      return (
                        <button
                          key={p.id}
                          onClick={() => setShareTarget(p.id as PlayerId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            shareTarget === p.id
                              ? `${tc.border} ${tc.bg} ${tc.text}`
                              : 'border-stone-700 text-stone-400 hover:border-stone-500'
                          }`}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
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
                            : 'border-stone-700 text-stone-500'
                        }`}
                      >
                        {ACTION_LABEL[a]}
                        {shareClaimedAction === a && a !== sharingCard.realAction && <span className="ml-1 text-red-400">虚</span>}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSharingCard(null)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-400 text-xs font-bold">取消</button>
                    <button
                      onClick={handleConfirmShare}
                      disabled={!shareTarget || !shareClaimedAction}
                      className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 text-black text-xs font-bold transition-all"
                    >
                      {shareClaimedAction !== sharingCard?.realAction ? '🎭 发送虚假情报' : '✅ 如实分享'}
                    </button>
                  </div>
                </div>
              )}

              {cards.length === 0 ? (
                <div className="text-stone-600 text-xs text-center py-3 bg-stone-900/40 rounded-lg">本轮无情报</div>
              ) : (
                cards.map(({ cardIdx, fullIdx, card }) => {
                  const style = SOURCE_STYLE[card.source]
                  const key = `${activePlayer}-${cardIdx}`
                  const isRevealed = revealedCards.has(key)
                  const alreadyShared = intelShares.some(s => s.from === activePlayer && s.cardIdx === fullIdx)

                  return (
                    <div key={key} className="bg-stone-950/80 border border-stone-800 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${style.badge}`}>
                          {style.icon} {card.source}
                        </span>
                        <SpeakBtn text={`情报内容：${card.text}。建议选择${ACTION_LABEL[card.impliedAction]}。`} />
                      </div>
                      {!isRevealed ? (
                        <button
                          onClick={() => toggleReveal(key)}
                          className="w-full py-2 text-center text-stone-500 hover:text-stone-300 text-xs border border-stone-700/50 rounded bg-stone-900/50 transition-all"
                        >
                          🃏 点击翻开
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
                            {!alreadyShared ? (
                              <button
                                onClick={() => handleStartShare(activePlayer, fullIdx, card.impliedAction)}
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

              {/* Received intel */}
              {received.length > 0 && (
                <div className="pt-2 border-t border-stone-800/50">
                  <div className="text-xs text-stone-500 font-bold mb-1.5">📩 收到的情报：</div>
                  {received.map((share, i) => {
                    const sender = players.find(p => p.id === share.from)
                    const sc = PLAYER_COLORS[share.from]
                    return (
                      <div key={i} className="bg-stone-900/60 border border-stone-800/50 rounded-lg p-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-stone-500'}`} />
                          <span className={`text-xs font-bold ${sc?.text ?? 'text-stone-400'}`}>{sender?.name}</span>
                          <span className="text-stone-600 text-xs">建议</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-800 text-amber-300">
                            {ACTION_LABEL[share.claimedAction]}
                          </span>
                          <span className="text-stone-600 text-xs">（真假未知）</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── 宣言 ── */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-stone-500 text-xs font-bold">📢 公开宣言（可选）</div>
              <div className="text-stone-600 text-xs">言行一致 +¥10k · 食言 -¥10k</div>
              <div className="flex gap-2">
                {ACTION_OPTIONS.map(a => (
                  <button
                    key={a}
                    onClick={() => announce(activePlayer, currentAnn === a ? null : a)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                      currentAnn === a
                        ? 'border-amber-500 bg-amber-900/30 text-amber-300 ring-1 ring-amber-500/30'
                        : 'border-stone-700 text-stone-500 hover:border-stone-500'
                    }`}
                  >
                    {ACTION_LABEL[a]}
                  </button>
                ))}
              </div>
              {currentAnn && (
                <div className="text-xs text-amber-400/80 text-center">
                  📢 将公开宣布：<strong>{ACTION_LABEL[currentAnn]}</strong>
                </div>
              )}
            </div>

            {/* ── 复仇标记 ── */}
            <div className="w-full max-w-md space-y-2">
              <div className="text-stone-500 text-xs font-bold">🎯 标记对手（可选）</div>
              <div className="text-stone-600 text-xs">标记后选ATK +¥15k · 但对手也选ATK则无效</div>
              <div className="flex gap-2">
                {players.filter(p => p.id !== activePlayer).map(target => {
                  const tc = PLAYER_COLORS[target.id]
                  const isMarked = currentMark === target.id
                  return (
                    <button
                      key={target.id}
                      onClick={() => setRevengeMark(activePlayer, isMarked ? null : target.id as PlayerId)}
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
            </div>

            {/* Close button */}
            <button
              onClick={handleCloseOverlay}
              className="w-full max-w-md py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold rounded-xl text-sm transition-all border border-stone-600"
            >
              ✓ 完成 · 交给下一位
            </button>
          </div>
        )
      })()}
    </>
  )
}
