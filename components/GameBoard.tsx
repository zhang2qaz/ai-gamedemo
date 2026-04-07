'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { PlayerId, BaseAction, FinalShift } from '@/engine/types'
import PlayerCard from './PlayerCard'
import RoundResultPanel from './RoundResultPanel'
import AuditLogPanel from './AuditLogPanel'
import GameOverPanel from './GameOverPanel'
import ShareBar from './ShareBar'
import IntelFeed from './IntelFeed'
import ThemeSelect from './ThemeSelect'
import { getFinalRanking } from '@/engine/resolveGame'
import { getSignalForRound } from '@/engine/events'
import SpeakBtn from './SpeakBtn'
import CoachPanel from './CoachPanel'
import IntelTradePhase from './IntelTradePhase'
import { sfxSelect, sfxLock, sfxReveal, sfxWildCard, sfxTick, sfxTimeout, sfxVictory, toggleMute, isMuted } from '@/lib/sounds'
import WhatIfAnalysis from './WhatIfAnalysis'

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

export default function GameBoard() {
  // 使用独立 selector 避免全量订阅导致的无限重渲染
  const phase = useGameStore(s => s.phase)
  const theme = useGameStore(s => s.theme)
  const global = useGameStore(s => s.global)
  const players = useGameStore(s => s.players)
  const pendingInputs = useGameStore(s => s.pendingInputs)
  const auditLogs = useGameStore(s => s.auditLogs)
  const roundNarrations = useGameStore(s => s.roundNarrations)
  const gameNarration = useGameStore(s => s.gameNarration)
  const currentRoundResult = useGameStore(s => s.currentRoundResult)
  const showAuditLog = useGameStore(s => s.showAuditLog)
  const generatedIntel = useGameStore(s => s.generatedIntel)
  const intelTruth = useGameStore(s => s.intelTruth)
  const prevRoundPlayers = useGameStore(s => s.prevRoundPlayers)
  const prevRoundGlobal = useGameStore(s => s.prevRoundGlobal)
  const wildCards = useGameStore(s => s.wildCards)
  const selectTheme = useGameStore(s => s.selectTheme)
  const setAction = useGameStore(s => s.setAction)
  const clearAction = useGameStore(s => s.clearAction)
  const setFinalShift = useGameStore(s => s.setFinalShift)
  const submitRound = useGameStore(s => s.submitRound)
  const nextRound = useGameStore(s => s.nextRound)
  const resetGame = useGameStore(s => s.resetGame)
  const backToThemeSelect = useGameStore(s => s.backToThemeSelect)
  const toggleAuditLog = useGameStore(s => s.toggleAuditLog)
  const toggleWildCard = useGameStore(s => s.toggleWildCard)
  const ensureIntel = useGameStore(s => s.ensureIntel)

  // 客户端首次渲染时生成情报（空依赖，只执行一次）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { ensureIntel() }, [])

  // 当前正在输入的玩家（全屏遮罩）
  const [activeInput, setActiveInput] = useState<PlayerId | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [showTimeoutBanner, setShowTimeoutBanner] = useState(false)
  // Track elapsed seconds per player to prevent timer exploit (re-entering overlay resets timer)
  const playerElapsedRef = useRef<Record<string, number>>({})
  const lastOpenTimeRef = useRef<number>(0)

  // Play victory sound on game over
  useEffect(() => {
    if (phase === 'GAME_OVER') sfxVictory()
  }, [phase])

  // Reset per-player elapsed time tracking on new round
  useEffect(() => {
    playerElapsedRef.current = {}
  }, [global.roundNumber])

  // Scroll to top on phase change to prevent blank space at top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase])

  // ── 主题选择页 ──
  if (phase === 'THEME_SELECT') {
    return <ThemeSelect onSelect={selectTheme} />
  }

  const isFinalRound = global.roundNumber === global.maxRounds
  const isIntelPhase = phase === 'INTEL_PHASE'
  const isSubmitting = phase === 'SUBMITTING'
  const isRoundResult = phase === 'ROUND_RESULT'
  const isGameOver = phase === 'GAME_OVER'

  const playerIds = players.map(p => p.id)
  const allSubmitted = playerIds.every(id => pendingInputs[id]?.action !== null)
  const submittedCount = playerIds.filter(id => pendingInputs[id]?.action !== null).length

  const currentNarration = roundNarrations[roundNarrations.length - 1] ?? ''
  const rankingOrder = getFinalRanking(players)
  const rankMap = Object.fromEntries(rankingOrder.map((p, i) => [p.id, i + 1]))
  const signal = isSubmitting ? getSignalForRound(global.eventQueue ?? [], global.roundNumber) : null

  const t = theme // 主题简写
  const customersLabel = t?.terms.customers ?? '客流'

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <ActiveInputHandler
        activeInput={activeInput}
        setActiveInput={setActiveInput}
        pendingInputs={pendingInputs}
        roundNumber={global.roundNumber}
      />

      {/* ── 顶栏 ── */}
      <div className="border-b border-stone-800 bg-stone-950/95 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-amber-400 font-black text-base leading-tight">弈战 <span className="text-stone-600 font-mono text-xs">v2.4</span></div>
            <div className="text-stone-600 text-xs leading-tight hidden lg:block">{t?.scenario.title ?? ''}</div>
          </div>

          {/* 回合进度 */}
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: global.maxRounds }, (_, i) => i + 1).map(r => {
              const done = isGameOver ? true : r < global.roundNumber
              const current = r === global.roundNumber && !isGameOver
              return (
                <div key={r} className="flex items-center">
                  <div className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center border transition-all ${
                    done ? 'bg-amber-600 border-amber-500 text-black'
                    : current ? 'bg-amber-400 border-amber-300 text-black ring-2 ring-amber-300/40'
                    : 'bg-stone-900 border-stone-700 text-stone-600'
                  }`}>
                    {done && !current ? '✓' : r}
                  </div>
                  {r < global.maxRounds && <div className={`w-3 h-px mx-0.5 ${done ? 'bg-amber-600' : 'bg-stone-800'}`} />}
                </div>
              )
            })}
          </div>

          {/* 状态文字 + 赌注倍数 */}
          <div className="text-sm whitespace-nowrap shrink-0 flex items-center gap-2">
            <span>
              {isIntelPhase && <span className="text-cyan-400 font-bold">R{global.roundNumber} · 情报交易</span>}
              {isSubmitting && <span className="text-amber-400 font-bold">R{global.roundNumber} · 选牌</span>}
              {isRoundResult && <span className="text-green-400 font-bold">R{global.roundNumber - 1} · 结算完毕</span>}
              {isGameOver && <span className="text-yellow-400 font-bold">⚑ 终局</span>}
              {isFinalRound && (isSubmitting || isIntelPhase) && <span className="ml-1 text-purple-400 font-bold">⚡终盘</span>}
            </span>
            {(isSubmitting || isIntelPhase) && (() => {
              const themeMultipliers = t?.configOverrides?.roundStakesMultiplier
              const defaultMultipliers = [1, 0.8, 0.9, 1.0, 1.2, 1.5]
              const m = (themeMultipliers ?? defaultMultipliers)[global.roundNumber] ?? 1
              const color = m >= 2 ? 'text-red-400' : m >= 1.5 ? 'text-orange-400' : m >= 1 ? 'text-amber-400' : 'text-stone-500'
              const label = m >= 2 ? '🔥' : m >= 1.5 ? '⬆' : m < 1 ? '⬇' : ''
              return (
                <span className={`text-xs font-mono font-bold ${color} bg-stone-800/80 px-1.5 py-0.5 rounded`}>
                  {label}×{m}
                </span>
              )
            })()}
          </div>

          {/* 市场参数 */}
          {(isSubmitting || isIntelPhase) && (() => {
            const ps = global.priceSensitivity
            const qw = global.qualityWeight
            const promoStars = ps >= 0.7 ? '★★★' : ps >= 0.5 ? '★★☆' : '★☆☆'
            const qualStars  = qw >= 0.5 ? '★★★' : qw >= 0.35 ? '★★☆' : '★☆☆'
            const promoColor = ps >= 0.7 ? 'text-red-400' : ps >= 0.5 ? 'text-yellow-400' : 'text-stone-500'
            const qualColor  = qw >= 0.5 ? 'text-blue-400' : qw >= 0.35 ? 'text-stone-300' : 'text-stone-500'
            return (
              <div className="flex items-center gap-3 text-xs min-w-0 overflow-hidden">
                <span className="text-stone-600 shrink-0">{customersLabel} <span className="text-stone-300 font-mono">{(global.totalCustomers / 10000).toFixed(0)}万</span></span>
                <span className="text-stone-700">·</span>
                <span className="text-stone-500 shrink-0">{t?.actionNarrative.ATK.title ?? '促销'}效果 <span className={`font-bold ${promoColor}`}>{promoStars}</span></span>
                <span className="text-stone-700">·</span>
                <span className="text-stone-500 shrink-0">{t?.terms.qualityScore ?? '品质'}加成 <span className={`font-bold ${qualColor}`}>{qualStars}</span></span>
              </div>
            )
          })()}

          {/* 工具按钮 */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={() => { const m = toggleMute(); setSoundMuted(m) }}
              className="px-2 py-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800 transition-all"
              title={soundMuted ? '开启音效' : '静音'}
            >
              {soundMuted ? '🔇' : '����'}
            </button>
            {auditLogs.length > 0 && (
              <button onClick={toggleAuditLog} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800 transition-all">
                📋 审计
              </button>
            )}
            <button onClick={() => { if (global.roundNumber <= 1 || confirm('确定要换场景吗？当前进度将丢失。')) backToThemeSelect() }} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800 transition-all">
              🏠 换场景
            </button>
            <button onClick={() => { if (global.roundNumber <= 1 || confirm('确定要重开吗？当前进度将丢失。')) resetGame() }} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-red-950 text-stone-600 hover:text-red-400 rounded-lg border border-stone-800 hover:border-red-900 transition-all">
              ↺ 重开
            </button>
          </div>
        </div>
      </div>

      {/* ── 主内容 ── */}
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-4 flex flex-col gap-3">

        {/* 游戏结束 */}
        {isGameOver && (
          <GameOverPanel players={players} logs={auditLogs} gameNarration={gameNarration} onReset={resetGame} onShowAuditLog={toggleAuditLog} />
        )}

        {/* 回合结果 */}
        {isRoundResult && currentRoundResult && (() => {
          const prevRound = global.roundNumber - 1
          const intel = generatedIntel.find(r => r.round === prevRound) ?? null
          return (
          <>
            <ShareBar players={players} />
            {intel && (
              <IntelFeed
                intel={intel}
                truthOverrides={intelTruth[prevRound]}
                revealed={true}
              />
            )}
            <RoundResultPanel log={currentRoundResult} players={players} narration={currentNarration} onNext={nextRound} isGameOver={false} />
            {prevRoundPlayers.length > 0 && prevRoundGlobal && (
              <WhatIfAnalysis log={currentRoundResult} prevPlayers={prevRoundPlayers} prevGlobal={prevRoundGlobal} />
            )}
          </>
          )
        })()}

        {/* 情报交易阶段 */}
        {isIntelPhase && (
          <>
            <ShareBar players={players} />

            {/* P3: 终盘入场横幅 */}
            {isFinalRound && (
              <div className="bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 border border-purple-700/50 rounded-xl p-5 text-center space-y-2 animate-fade-in-up">
                <div className="text-3xl font-black text-purple-300 animate-pulse">⚡ 终 盘 决 战 ⚡</div>
                <div className="text-purple-400/80 text-sm">
                  最后一回合 · 赌注 ×{(t?.configOverrides?.roundStakesMultiplier ?? [1, 0.8, 0.9, 1.0, 1.2, 1.5])[global.maxRounds] ?? 1.5} · 品质储备可爆发 · 终盘转向开放
                </div>
                <div className="text-stone-500 text-xs">
                  谨慎选择 — 这是翻盘的最后机会
                </div>
              </div>
            )}

            {/* P3: 回合变化摘要 */}
            {global.roundNumber > 1 && !isFinalRound && (
              <RoundChangeSummary players={players} prevPlayers={prevRoundPlayers} roundNumber={global.roundNumber} />
            )}

            <IntelTradePhase />
          </>
        )}

        {/* 提交阶段 */}
        {isSubmitting && (() => {
          const intel = generatedIntel.find(r => r.round === global.roundNumber) ?? null
          return (
          <>
            <ShareBar players={players} />

            {/* 情报流 */}
            {intel && (
              <IntelFeed
                intel={intel}
                truthOverrides={intelTruth[global.roundNumber]}
                revealed={false}
              />
            )}

            {/* 事件生效 + 终盘 横幅 */}
            {(signal || isFinalRound) && (
              <div className="flex gap-2">
                {signal && (
                  <div className="flex-1 bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-2 text-amber-300 text-sm flex items-center gap-2">
                    <span className="flex-1">🔔 {signal}</span>
                    <SpeakBtn text={`市场预警：${signal}`} />
                  </div>
                )}
                {isFinalRound && (
                  <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl px-4 py-2 text-purple-300 text-sm font-bold shrink-0">
                    ⚡ 第 {global.maxRounds} 回合 · 可选终盘转向
                  </div>
                )}
              </div>
            )}

            {/* ── 轮流选牌面板 ── */}
            <div className="bg-stone-900/60 border border-stone-700/50 rounded-xl p-5 space-y-4">
              <div className="text-center space-y-1">
                <div className="text-stone-200 font-bold">轮流选牌</div>
                <div className="text-stone-500 text-sm">
                  每位玩家依次点击自己的按钮，<span className="text-stone-400">背向其他人</span>完成选择后自动锁定
                </div>
              </div>

              <div className={`grid gap-3 grid-cols-2 ${players.length <= 4 ? 'sm:grid-cols-4' : players.length <= 6 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                {players.map(player => {
                  const isLocked = pendingInputs[player.id]?.action !== null
                  const c = PLAYER_COLORS[player.id]
                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (!isLocked) {
                          lastOpenTimeRef.current = Date.now()
                          setActiveInput(player.id as PlayerId)
                        }
                      }}
                      disabled={isLocked}
                      className={`relative rounded-xl border p-4 text-center transition-all select-none ${
                        isLocked
                          ? 'bg-stone-800/30 border-stone-700/50 cursor-not-allowed'
                          : `${c.bg} ${c.border} hover:ring-2 ${c.ring} cursor-pointer active:scale-95`
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mx-auto mb-2 ${isLocked ? 'bg-stone-600' : c.dot}`} />
                      <div className={`font-black text-sm leading-tight mb-1 ${isLocked ? 'text-stone-500' : c.text}`}>
                        {player.name}
                      </div>
                      {isLocked ? (
                        <div className="text-stone-600 text-xs font-bold">🔒 已锁定</div>
                      ) : (
                        <div className={`text-xs font-bold ${c.text}`}>点击选牌</div>
                      )}
                    </button>
                  )
                })}
              </div>

              {allSubmitted ? (
                <button
                  onClick={() => { sfxReveal(); submitRound() }}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base uppercase tracking-wider transition-all"
                >
                  ⚔ 同步亮牌
                </button>
              ) : (
                <div className="text-center text-stone-600 text-xs">
                  {submittedCount}/{players.length} 已锁定 · 等待所有玩家完成选择
                </div>
              )}
            </div>
          </>
          )
        })()}
      </div>

      {/* ── 全屏输入遮罩 ── */}
      {activeInput && (() => {
        const player = players.find(p => p.id === activeInput)!
        const c = PLAYER_COLORS[activeInput]
        return (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-start overflow-y-auto py-6 px-4 gap-4">
            <div className={`text-center px-6 py-3 rounded-xl border ${c.bg} ${c.border} w-full max-w-sm`}>
              <div className={`font-black text-xl ${c.text}`}>{player.name}</div>
              <div className="text-stone-400 text-sm mt-1">请选择本回合动作</div>
              <SelectionTimer
                isActive={pendingInputs[activeInput].action === null}
                elapsedBefore={playerElapsedRef.current[activeInput] ?? 0}
                onTimeout={() => {
                  setShowTimeoutBanner(true)
                  setTimeout(() => {
                    setAction(activeInput!, 'HOLD')
                    setShowTimeoutBanner(false)
                  }, 1500)
                }}
              />
              {showTimeoutBanner && (
                <div className="mt-2 bg-red-900/60 border border-red-500 rounded-lg px-4 py-2 animate-slide-in-scale">
                  <div className="text-red-300 font-black text-lg">⏰ 时间到！</div>
                  <div className="text-red-400/80 text-sm">自动选择精细运营(HOLD)</div>
                </div>
              )}
            </div>

            <div className="w-full max-w-sm">
              <PlayerCard
                player={player}
                rank={rankMap[activeInput] || 4}
                selectedAction={pendingInputs[activeInput].action}
                selectedFinalShift={pendingInputs[activeInput].finalShift}
                isFinalRound={isFinalRound}
                isSubmitting={isSubmitting}
                qualityWeight={global.qualityWeight}
                priceSensitivity={global.priceSensitivity}
                onSelectAction={(action: BaseAction) => { sfxSelect(); setAction(activeInput, action) }}
                onSelectFinalShift={(shift: FinalShift) => { sfxSelect(); setFinalShift(activeInput, shift) }}
                onClearAction={() => clearAction(activeInput)}
              />
            </div>

            {/* 暗牌 */}
            {wildCards[activeInput] && !wildCards[activeInput].used && (
              <div className="w-full max-w-sm">
                <button
                  onClick={() => { sfxWildCard(); toggleWildCard(activeInput) }}
                  className={`w-full rounded-xl border p-3 text-center transition-all cursor-pointer ${
                    pendingInputs[activeInput].useWildCard
                      ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-400/30'
                      : 'bg-stone-900/60 border-stone-700/50 hover:border-purple-700'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">{wildCards[activeInput].emoji}</span>
                    <span className={`font-bold text-sm ${pendingInputs[activeInput].useWildCard ? 'text-purple-300' : 'text-stone-400'}`}>
                      暗牌：{wildCards[activeInput].name}
                    </span>
                    {pendingInputs[activeInput].useWildCard && <span className="text-purple-400 text-xs">✓ 已激活</span>}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">{wildCards[activeInput].description}</div>
                  <div className="text-xs text-stone-700 mt-0.5">
                    {pendingInputs[activeInput].useWildCard ? '再次点击取消' : '点击本回合使用（一局仅一次）'}
                  </div>
                </button>
              </div>
            )}
            {wildCards[activeInput]?.used && (
              <div className="text-stone-700 text-xs">🃏 暗牌已使用</div>
            )}

            {pendingInputs[activeInput].action === null && (
              <button
                onClick={() => {
                  // Save elapsed time for this player
                  const elapsed = Math.floor((Date.now() - lastOpenTimeRef.current) / 1000)
                  playerElapsedRef.current[activeInput] = (playerElapsedRef.current[activeInput] ?? 0) + elapsed
                  setActiveInput(null)
                }}
                className="text-stone-600 hover:text-stone-400 text-sm transition-all py-2"
              >
                ← 返回（暂不选）
              </button>
            )}
          </div>
        )
      })()}

      {showAuditLog && <AuditLogPanel logs={auditLogs} onClose={toggleAuditLog} />}

      {/* 教练问答浮动面板 */}
      <CoachPanel />
    </div>
  )
}

// 将 useEffect hooks 提取为独立组件，避免条件渲染中使用 hooks
function ActiveInputHandler({
  activeInput,
  setActiveInput,
  pendingInputs,
  roundNumber,
}: {
  activeInput: PlayerId | null
  setActiveInput: (v: PlayerId | null) => void
  pendingInputs: Record<PlayerId, { action: BaseAction | null; finalShift: FinalShift }>
  roundNumber: number
}) {
  useEffect(() => {
    if (activeInput && pendingInputs[activeInput].action !== null) {
      sfxLock()
      const t = setTimeout(() => setActiveInput(null), 800)
      return () => clearTimeout(t)
    }
  }, [pendingInputs, activeInput, setActiveInput])

  useEffect(() => {
    setActiveInput(null)
  }, [roundNumber, setActiveInput])

  return null
}

// P3: 回合间变化摘要
function RoundChangeSummary({
  players,
  prevPlayers,
  roundNumber,
}: {
  players: import('@/engine/types').PlayerState[]
  prevPlayers: import('@/engine/types').PlayerState[]
  roundNumber: number
}) {
  if (prevPlayers.length === 0) return null

  const leader = [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)[0]
  const prevLeader = [...prevPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)[0]
  const leaderChanged = leader.id !== prevLeader.id

  // Find biggest mover (share delta)
  const movers = players.map(p => {
    const prev = prevPlayers.find(pp => pp.id === p.id)
    return { ...p, shareDelta: prev ? p.marketShare - prev.marketShare : 0 }
  }).sort((a, b) => Math.abs(b.shareDelta) - Math.abs(a.shareDelta))
  const bigMover = movers[0]

  const c = PLAYER_COLORS[leader.id]

  return (
    <div className="bg-stone-900/40 border border-stone-700/40 rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs animate-fade-in-up">
      <span className="text-stone-600 font-bold shrink-0">R{roundNumber} 形势</span>
      <span className="text-stone-700">|</span>
      <span className="text-stone-400">
        领先：<span className={`font-bold ${c?.text ?? ''}`}>{leader.name}</span>
        {leaderChanged && <span className="text-amber-400 ml-1">NEW!</span>}
      </span>
      <span className="text-stone-700">|</span>
      <span className="text-stone-400">
        最大变动：<span className="font-bold text-stone-300">{bigMover.name}</span>
        <span className={`ml-1 font-mono ${bigMover.shareDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {bigMover.shareDelta >= 0 ? '+' : ''}{(bigMover.shareDelta * 100).toFixed(1)}%
        </span>
      </span>
    </div>
  )
}

const SELECTION_TIME_LIMIT = 45

function SelectionTimer({
  isActive,
  onTimeout,
  elapsedBefore = 0,
}: {
  isActive: boolean
  onTimeout: () => void
  elapsedBefore?: number
}) {
  const [timeLeft, setTimeLeft] = useState(Math.max(1, SELECTION_TIME_LIMIT - elapsedBefore))
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!isActive) return
    setTimeLeft(Math.max(1, SELECTION_TIME_LIMIT - elapsedBefore))
  }, [isActive, elapsedBefore])

  useEffect(() => {
    if (!isActive) return
    if (timeLeft <= 0) {
      sfxTimeout()
      onTimeoutRef.current()
      return
    }
    if (timeLeft <= 5) sfxTick()
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [isActive, timeLeft])

  if (!isActive) return null

  const pct = (timeLeft / SELECTION_TIME_LIMIT) * 100
  const color = timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-amber-400' : 'text-stone-500'

  return (
    <div className="mt-2 space-y-1">
      <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`text-xs font-mono ${textColor}`}>
        {timeLeft <= 5 ? `⚠ ${timeLeft}秒后自动选择精细运营` : `${timeLeft}秒内完成选择`}
      </div>
    </div>
  )
}
