'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import type { BaseAction, FinalShift, PlayerId, PlayerState } from '@/engine/types'
import { getFinalRanking } from '@/engine/resolveGame'
import { getSignalForRound } from '@/engine/events'
import { predictOutcome } from '@/lib/prediction'
import PlayerCard from './PlayerCard'
import PredictionHint from './PredictionHint'
import ReactionBar from './ReactionBar'
import ReactionFeed from './ReactionFeed'
import ObjectiveCard from './ObjectiveCard'
import ObjectiveReveal from './ObjectiveReveal'
import PrivateIntelCard from './PrivateIntelCard'
import RelationshipGraph from './RelationshipGraph'
import SkillRadar from './SkillRadar'
import ChatPanel from './ChatPanel'
import PactPanel from './PactPanel'
import PactResults from './PactResults'
import IntelMarket from './IntelMarket'
import BossBanner from './BossBanner'
import PveOutcome from './PveOutcome'
import RoundResultPanel from './RoundResultPanel'
import GameOverPanel from './GameOverPanel'
import ShareBar from './ShareBar'
import ForecastBanner from './ForecastBanner'
import SpeakBtn from './SpeakBtn'
import AuditLogPanel from './AuditLogPanel'
import CoachPanel from './CoachPanel'
import WhatIfAnalysis from './WhatIfAnalysis'
import { sfxSelect, sfxLock, sfxReveal, sfxVictory, sfxWildCard, sfxTick, sfxTimeout, toggleMute } from '@/lib/sounds'

import { PLAYER_COLORS } from '@/lib/playerColors'

const SELECTION_TIME_LIMIT = 60 // 联机每人 60 秒

export default function MultiplayerBoard() {
  const phase = useMultiplayerStore(s => s.phase)
  const mode = useMultiplayerStore(s => s.mode)
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const theme = useMultiplayerStore(s => s.theme)
  const global = useMultiplayerStore(s => s.global)
  const players = useMultiplayerStore(s => s.players)
  const pendingStatus = useMultiplayerStore(s => s.pendingStatus)
  const currentForecast = useMultiplayerStore(s => s.currentForecast)
  const pledges = useMultiplayerStore(s => s.pledges)
  const lastRoundForecast = useMultiplayerStore(s => s.lastRoundForecast)
  const lastRoundPledges = useMultiplayerStore(s => s.lastRoundPledges)
  const currentAuditLog = useMultiplayerStore(s => s.currentAuditLog)
  const currentNarration = useMultiplayerStore(s => s.currentNarration)
  const allAuditLogs = useMultiplayerStore(s => s.allAuditLogs)
  const gameNarration = useMultiplayerStore(s => s.gameNarration)
  const prevRoundPlayers = useMultiplayerStore(s => s.prevRoundPlayers)
  const prevRoundGlobal = useMultiplayerStore(s => s.prevRoundGlobal)
  const showAuditLog = useMultiplayerStore(s => s.showAuditLog)
  const wildCards = useMultiplayerStore(s => s.wildCards)
  const useWildCard = useMultiplayerStore(s => s.useWildCard)
  const submitAction = useMultiplayerStore(s => s.submitAction)
  const submitPledge = useMultiplayerStore(s => s.submitPledge)
  const toggleWildCard = useMultiplayerStore(s => s.toggleWildCard)
  const clearAction = useMultiplayerStore(s => s.clearAction)
  const nextRound = useMultiplayerStore(s => s.nextRound)
  const resetGame = useMultiplayerStore(s => s.resetGame)
  const backToModeSelect = useMultiplayerStore(s => s.backToModeSelect)
  const toggleAuditLog = useMultiplayerStore(s => s.toggleAuditLog)
  const intelPhaseEndsAt = useMultiplayerStore(s => s.intelPhaseEndsAt)
  const skipIntel = useMultiplayerStore(s => s.skipIntel)
  const beginnerMode = useMultiplayerStore(s => s.beginnerMode)
  const readyNextRound = useMultiplayerStore(s => s.readyNextRound)
  const pledgesHistory = useMultiplayerStore(s => s.pledgesHistory)
  const generatedForecasts = useMultiplayerStore(s => s.generatedForecasts)
  const readyPlayers = useMultiplayerStore(s => s.readyPlayers)
  const readyTotal = useMultiplayerStore(s => s.readyTotal)
  const readyContext = useMultiplayerStore(s => s.readyContext)
  const lobbyPlayers = useMultiplayerStore(s => s.lobbyPlayers)

  const [localAction, setLocalAction] = useState<BaseAction | null>(null)
  const [localFinalShift, setLocalFinalShift] = useState<FinalShift>('NONE')
  const [soundMuted, setSoundMuted] = useState(false)

  // Reset selections & scroll to top on phase change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // 新回合开始时重置选项
    if (phase === 'INTEL_PHASE' || phase === 'SUBMITTING') {
      setLocalAction(null)
      setLocalFinalShift('NONE')
    }
  }, [phase, global?.roundNumber])

  if (!theme || !global || !myPlayerId) return null

  const myPlayer = players.find(p => p.id === myPlayerId)
  if (!myPlayer) return null

  const isFinalRound = global.roundNumber === global.maxRounds
  const isHost = mode === 'host'
  const isIntelPhase = phase === 'INTEL_PHASE'
  const isSubmitting = phase === 'SUBMITTING'
  const isRoundResult = phase === 'ROUND_RESULT'
  const isGameOver = phase === 'GAME_OVER'
  const rankingOrder = getFinalRanking(players)
  const rankMap = Object.fromEntries(rankingOrder.map((p, i) => [p.id, i + 1]))
  const myRank = rankMap[myPlayerId] || 4
  const iSubmitted = pendingStatus[myPlayerId]
  const submittedCount = Object.values(pendingStatus).filter(Boolean).length
  const signal = isSubmitting ? getSignalForRound(global.eventQueue ?? [], global.roundNumber) : null
  const myPledge = pledges.find(p => p.playerId === myPlayerId)

  const customersLabel = theme?.terms.customers ?? '客流'
  const myWildCard = wildCards[myPlayerId]

  // Stakes multiplier
  const themeMultipliers = theme?.configOverrides?.roundStakesMultiplier
  const defaultMultipliers = [1, 0.8, 0.9, 1.0, 1.2, 1.5]
  const stakesMultiplier = (themeMultipliers ?? defaultMultipliers)[global.roundNumber] ?? 1

  return (
    <div className="min-h-screen text-white flex flex-col relative" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1c1917 0%, #0c0a09 70%)' }}>
      {/* ── 顶栏 ── */}
      <div className="glass-panel border-b border-stone-800/50 sticky top-0 z-20">
        <div className="max-w-screen-sm mx-auto px-3 py-2 flex items-center gap-2">
          <div className="shrink-0">
            <div className="font-black text-sm leading-tight">
              <span className="text-gradient-gold">弈战</span>
              <span className={`text-xs font-bold ml-1 ${PLAYER_COLORS[myPlayerId]?.text}`} style={{ textShadow: '0 0 8px currentColor' }}>{myPlayer.name}</span>
            </div>
          </div>

          {/* 回合进度 */}
          <div className="flex items-center gap-1 shrink-0">
            {Array.from({ length: global.maxRounds }, (_, i) => i + 1).map(r => {
              const done = isGameOver ? true : r < global.roundNumber
              const current = r === global.roundNumber && !isGameOver
              return (
                <div key={r} className={`w-6 h-6 rounded-md text-[10px] font-black flex items-center justify-center transition-all duration-300 ${
                  done
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 text-black border-metallic'
                    : current
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-black border-metallic glow-amber'
                    : 'bg-stone-900/80 border border-stone-700/50 text-stone-600'
                }`}>
                  {done && !current ? '✓' : r}
                </div>
              )
            })}
          </div>

          {/* 状态文字 + 赌注倍数 */}
          <div className="flex items-center gap-1 text-xs shrink-0">
            {isIntelPhase && <span className="text-cyan-400 font-bold">R{global.roundNumber} · 风向讨论</span>}
            {isSubmitting && <span className="text-amber-400 font-bold">R{global.roundNumber} · 选牌</span>}
            {isRoundResult && <span className="text-green-400 font-bold">R{global.roundNumber - 1} · 结算</span>}
            {isGameOver && <span className="text-yellow-400 font-bold">⚑ 终局</span>}
            {isFinalRound && (isSubmitting || isIntelPhase) && <span className="text-purple-400 font-bold">⚡终盘</span>}
            {(isSubmitting || isIntelPhase) && (() => {
              const m = stakesMultiplier
              const color = m >= 2 ? 'text-red-400' : m >= 1.5 ? 'text-orange-400' : m >= 1 ? 'text-amber-400' : 'text-stone-500'
              const label = m >= 2 ? '🔥' : m >= 1.5 ? '⬆' : m < 1 ? '⬇' : ''
              return <span className={`font-mono font-bold ${color} bg-stone-800/80 px-1 py-0.5 rounded text-[10px]`}>{label}×{m}</span>
            })()}
          </div>

          {/* 工具按钮 */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { const m = toggleMute(); setSoundMuted(m) }}
              className="px-1.5 py-1 text-xs bg-stone-900/80 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800/50 transition-all"
              title={soundMuted ? '开启音效' : '静音'}
            >
              {soundMuted ? '🔇' : '🔊'}
            </button>
            {allAuditLogs.length > 0 && (
              <button onClick={toggleAuditLog} className="px-2 py-1 text-xs bg-stone-900/80 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800/50 transition-all">
                📋
              </button>
            )}
            {isHost && (
              <button onClick={() => { if (global.roundNumber <= 1 || confirm('确定要重开吗？')) resetGame() }} className="px-2 py-1 text-xs bg-stone-900/80 hover:bg-red-950 text-stone-600 hover:text-red-400 rounded-lg border border-stone-800/50 hover:border-red-900 transition-all">
                ↺
              </button>
            )}
            <button onClick={backToModeSelect} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">退出</button>
          </div>
        </div>

        {/* 市场参数条 */}
        {(isSubmitting || isIntelPhase) && (
          <div className="max-w-screen-sm mx-auto px-3 pb-1.5 flex items-center gap-2 text-[10px] text-stone-500 overflow-x-auto">
            <span>{customersLabel} <span className="text-stone-300 font-mono">{(global.totalCustomers / 10000).toFixed(0)}万</span></span>
            <span className="text-stone-700">·</span>
            <span>{theme?.actionNarrative.ATK.title ?? '促销'}效果 <span className={`font-bold ${global.priceSensitivity >= 0.7 ? 'text-red-400' : global.priceSensitivity >= 0.5 ? 'text-yellow-400' : 'text-stone-500'}`}>
              {global.priceSensitivity >= 0.7 ? '★★★' : global.priceSensitivity >= 0.5 ? '★★☆' : '★☆☆'}
            </span></span>
            <span className="text-stone-700">·</span>
            <span>{theme?.terms.qualityScore ?? '品质'}加成 <span className={`font-bold ${global.qualityWeight >= 0.5 ? 'text-blue-400' : global.qualityWeight >= 0.35 ? 'text-stone-300' : 'text-stone-500'}`}>
              {global.qualityWeight >= 0.5 ? '★★★' : global.qualityWeight >= 0.35 ? '★★☆' : '★☆☆'}
            </span></span>
          </div>
        )}
      </div>

      {/* ── 主内容 ── */}
      <div className="flex-1 max-w-screen-sm mx-auto w-full px-4 py-4 flex flex-col gap-3">

        {/* PvE 巨头横幅 */}
        {!isGameOver && <BossBanner />}

        {/* 秘密目标卡（始终显示，但默认折叠） */}
        {(isIntelPhase || isSubmitting || isRoundResult) && <ObjectiveCard />}

        {/* 私有线索（每回合刷新，仅本人可见） */}
        {(isIntelPhase || isSubmitting) && <PrivateIntelCard />}

        {/* 双人契约 + 情报市场 + 房间聊天（情报和出牌阶段） */}
        {(isIntelPhase || isSubmitting) && (
          <>
            <PactPanel />
            <IntelMarket />
            <ChatPanel />
          </>
        )}

        {/* 游戏结束 */}
        {isGameOver && (
          <>
            <PveOutcome />
            <GameOverPhase
              players={players}
              allAuditLogs={allAuditLogs}
              gameNarration={gameNarration}
              isHost={isHost}
              resetGame={resetGame}
              toggleAuditLog={toggleAuditLog}
            />
            <ObjectiveReveal players={players} />
            <RelationshipGraph players={players} logs={allAuditLogs} pledgesHistory={pledgesHistory} />
            <SkillRadar
              myPlayerId={myPlayerId}
              logs={allAuditLogs}
              forecasts={generatedForecasts}
              finalPlayers={players}
            />
            <ReactionBar />
          </>
        )}

        {/* 风向讨论阶段 */}
        {isIntelPhase && (
          <IntelPhaseUI
            global={global}
            theme={theme}
            players={players}
            myPlayerId={myPlayerId}
            isFinalRound={isFinalRound}
            isHost={isHost}
            currentForecast={currentForecast}
            pledges={pledges}
            prevRoundPlayers={prevRoundPlayers}
            intelPhaseEndsAt={intelPhaseEndsAt}
            stakesMultiplier={stakesMultiplier}
            submitPledge={submitPledge}
            skipIntel={skipIntel}
            beginnerMode={beginnerMode}
          />
        )}

        {/* 回合结果 */}
        {isRoundResult && currentAuditLog && (
          <div className="space-y-3 animate-fade-in-up">
            <ShareBar players={players} />

            {lastRoundForecast && (
              <ForecastBanner forecast={lastRoundForecast} revealed={true} />
            )}

            <RoundResultPanel
              log={currentAuditLog}
              players={players}
              narration={currentNarration}
              onNext={isHost ? nextRound : () => {}}
              isGameOver={false}
              lastRoundForecast={lastRoundForecast}
              lastRoundPledges={lastRoundPledges}
            />

            {/* 如果当时... */}
            {prevRoundPlayers.length > 0 && prevRoundGlobal && (
              <WhatIfAnalysis
                log={currentAuditLog}
                prevPlayers={prevRoundPlayers}
                prevGlobal={prevRoundGlobal}
                theme={theme}
              />
            )}

            {/* 契约结算 */}
            <PactResults />

            {/* 表情反应栏 */}
            <ReactionBar />

            {/* 所有玩家的"准备下一回合"按钮 */}
            {(() => {
              const iAmReady = readyPlayers.includes(myPlayerId)
              return (
                <div className="space-y-2">
                  <button
                    onClick={() => { sfxReveal(); readyNextRound() }}
                    disabled={iAmReady}
                    className={`w-full py-3.5 font-black rounded-xl text-base transition-all ${
                      iAmReady
                        ? 'bg-green-900/50 border-2 border-green-600/50 text-green-400 cursor-default'
                        : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black btn-3d'
                    }`}
                  >
                    {iAmReady ? '✓ 已准备 · 等待其他玩家' : '准备下一回合 →'}
                  </button>
                  {readyContext === 'next_round' && readyPlayers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <span className="text-stone-400">{readyPlayers.length}/{readyTotal} 已准备</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${(readyPlayers.length / Math.max(readyTotal, 1)) * 100}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {players.map(p => {
                          const ready = readyPlayers.includes(p.id)
                          const c = PLAYER_COLORS[p.id]
                          return (
                            <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${
                              ready
                                ? 'border-green-600/50 bg-green-950/30 text-green-400'
                                : 'border-stone-700/50 bg-stone-900/30 text-stone-600'
                            }`}>
                              {ready ? '✓' : '○'} <span className={c?.text ?? ''}>{p.name}</span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* 出牌阶段 */}
        {isSubmitting && (
          <SubmittingPhase
            global={global}
            theme={theme}
            players={players}
            myPlayerId={myPlayerId}
            myPlayer={myPlayer}
            myRank={myRank}
            isFinalRound={isFinalRound}
            iSubmitted={iSubmitted}
            submittedCount={submittedCount}
            pendingStatus={pendingStatus}
            stakesMultiplier={stakesMultiplier}
            currentForecast={currentForecast}
            signal={signal}
            pledges={pledges}
            myPledge={myPledge}
            prevRoundPlayers={prevRoundPlayers}
            myWildCard={myWildCard}
            useWildCard={useWildCard}
            localAction={localAction}
            localFinalShift={localFinalShift}
            setLocalAction={setLocalAction}
            setLocalFinalShift={setLocalFinalShift}
            submitAction={submitAction}
            submitPledge={submitPledge}
            toggleWildCard={toggleWildCard}
            clearAction={clearAction}
            beginnerMode={beginnerMode}
          />
        )}
      </div>

      {/* 表情反应 · 浮动消息流（全局） */}
      <ReactionFeed />

      {/* 审计日志 */}
      {showAuditLog && <AuditLogPanel logs={allAuditLogs} onClose={toggleAuditLog} />}

      {/* 教练面板 */}
      <CoachPanel
        auditLogs={allAuditLogs}
        players={players}
        theme={theme}
        phase={phase}
      />
    </div>
  )
}

// ── 出牌阶段（独立组件以使用 hooks） ──
function SubmittingPhase({
  global, theme, players, myPlayerId, myPlayer, myRank,
  isFinalRound, iSubmitted, submittedCount, pendingStatus,
  stakesMultiplier, currentForecast, signal, pledges, myPledge,
  prevRoundPlayers, myWildCard, useWildCard,
  localAction, localFinalShift, setLocalAction, setLocalFinalShift,
  submitAction, submitPledge, toggleWildCard, clearAction, beginnerMode,
}: {
  global: import('@/engine/types').GlobalState
  theme: import('@/engine/themes/types').ThemeConfig
  players: PlayerState[]
  myPlayerId: PlayerId
  myPlayer: PlayerState
  myRank: number
  isFinalRound: boolean
  iSubmitted: boolean
  submittedCount: number
  pendingStatus: Record<string, boolean>
  stakesMultiplier: number
  currentForecast: import('@/engine/types').MarketForecast | null
  signal: string | null
  pledges: import('@/engine/types').Pledge[]
  myPledge: import('@/engine/types').Pledge | undefined
  prevRoundPlayers: PlayerState[]
  myWildCard: import('@/engine/types').WildCard | undefined
  useWildCard: boolean
  localAction: BaseAction | null
  localFinalShift: FinalShift
  setLocalAction: (a: BaseAction | null) => void
  setLocalFinalShift: (s: FinalShift) => void
  submitAction: (a: BaseAction, f: FinalShift) => void
  submitPledge: (a: BaseAction | null) => void
  toggleWildCard: () => void
  clearAction: () => void
  beginnerMode: boolean
}) {
  // 倒计时（新手模式不启用）
  const [timeLeft, setTimeLeft] = useState(SELECTION_TIME_LIMIT)
  const onTimeoutDone = useRef(false)

  // Reset timer on new round
  useEffect(() => {
    setTimeLeft(SELECTION_TIME_LIMIT)
    onTimeoutDone.current = false
  }, [global.roundNumber])

  useEffect(() => {
    if (beginnerMode) return // 新手模式无倒计时
    if (iSubmitted) return
    if (timeLeft <= 0) {
      if (!onTimeoutDone.current) {
        onTimeoutDone.current = true
        sfxTimeout()
        setTimeout(() => {
          submitAction('HOLD', 'NONE')
        }, 1000)
      }
      return
    }
    if (timeLeft <= 5) sfxTick()
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, iSubmitted, submitAction, beginnerMode])

  const timerPct = (timeLeft / SELECTION_TIME_LIMIT) * 100
  const timerColor = timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 15 ? 'bg-amber-500' : 'bg-green-500'
  const timerTextColor = timeLeft <= 5 ? 'text-red-400' : timeLeft <= 15 ? 'text-amber-400' : 'text-stone-500'

  // 决策预测：localAction 改变时重新计算
  const prediction = useMemo(() => {
    if (!localAction || iSubmitted) return null
    return predictOutcome({
      global,
      players,
      myId: myPlayerId,
      myAction: localAction,
      myFinalShift: localFinalShift,
      myWildCard: useWildCard && myWildCard && !myWildCard.used ? myWildCard.type : null,
      forecast: currentForecast,
      pledges,
      configOverrides: theme.configOverrides,
    })
  }, [localAction, localFinalShift, useWildCard, iSubmitted, global, players, myPlayerId, myWildCard, currentForecast, pledges, theme])

  return (
    <div className="space-y-3 animate-fade-in">
      <ShareBar players={players} />

      {/* 倒计时条（新手模式隐藏） */}
      {!iSubmitted && !beginnerMode && (
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
          <div className={`text-xs font-mono ${timerTextColor} text-center`}>
            {timeLeft <= 5 ? `⚠ ${timeLeft}秒后自动选择守势` : `${timeLeft}秒内完成选择`}
          </div>
        </div>
      )}

      {/* 新手模式提示 */}
      {!iSubmitted && beginnerMode && (
        <div className="text-center text-green-500/60 text-xs py-1">
          🌱 新手模式 · 不限时间，慢慢选择
        </div>
      )}

      {/* 终盘横幅 */}
      {isFinalRound && (
        <div className="bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 border border-purple-700/50 rounded-xl p-4 text-center space-y-1.5 animate-fade-in-up">
          <div className="text-2xl font-black text-purple-300 animate-pulse">⚡ 终 盘 决 战 ⚡</div>
          <div className="text-purple-400/80 text-xs">
            最后一回合 · 赌注 ×{stakesMultiplier} · 品质储备可爆发 · 终盘转向开放
          </div>
        </div>
      )}

      {/* 回合变化摘要 */}
      {global.roundNumber > 1 && !isFinalRound && prevRoundPlayers.length > 0 && (
        <RoundChangeSummary players={players} prevPlayers={prevRoundPlayers} roundNumber={global.roundNumber} />
      )}

      {/* 风向横幅 */}
      {currentForecast && (
        <ForecastBanner forecast={currentForecast} revealed={false} />
      )}

      {/* 事件横幅 */}
      {signal && (
        <div className="flex gap-2 animate-fade-in-up">
          <div className="flex-1 glass-card border-amber-800/30 rounded-xl px-4 py-2.5 text-amber-300 text-sm flex items-center gap-2">
            <span className="flex-1 text-glow-amber">🔔 {signal}</span>
            <SpeakBtn text={`市场预警：${signal}`} />
          </div>
        </div>
      )}

      {/* 立誓状态 */}
      {pledges.length > 0 && (
        <div className="glass-card border-amber-800/20 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-amber-400 font-bold">⚔ 立誓：</span>
          {pledges.map(p => {
            const player = players.find(pl => pl.id === p.playerId)
            const actionName = theme.actionNarrative[p.pledgedAction]?.title ?? p.pledgedAction
            return (
              <span key={p.playerId} className="ml-2 text-stone-300">
                {player?.name} → {actionName}
              </span>
            )
          })}
        </div>
      )}

      {/* 玩家状态卡片 */}
      <div className="flex gap-2">
        {players.map((p, i) => {
          const isMe = p.id === myPlayerId
          const submitted = pendingStatus[p.id]
          const c = PLAYER_COLORS[p.id]
          return (
            <div
              key={p.id}
              className={`flex-1 rounded-xl px-2 py-2 text-center text-xs transition-all duration-300 animate-fade-in-up ${
                isMe
                  ? 'glass-card border-amber-500/40'
                  : submitted
                  ? 'glass-card border-green-600/40'
                  : 'bg-stone-900/30 border border-stone-800/50 rounded-xl'
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`font-bold ${c.text}`} style={{ textShadow: '0 0 6px currentColor' }}>{p.name}</div>
              <div className={`mt-0.5 ${submitted ? 'text-green-400 text-glow-green' : 'text-stone-600'}`}>
                {isMe ? (iSubmitted ? '🔒 已锁定' : '选牌中') : (submitted ? '🔒' : '思考中...')}
              </div>
            </div>
          )
        })}
      </div>

      {/* 我的选牌面板 */}
      {iSubmitted ? (
        <div className="glass-card border-green-600/30 rounded-xl p-6 text-center space-y-3 glow-green animate-fade-in-up">
          <div className="text-4xl animate-float">🔒</div>
          <div className="text-green-400 font-bold text-glow-green">决策已封存</div>
          <div className="text-stone-500 text-sm">{submittedCount}/{players.length} 已提交 · 等待其他玩家</div>
          <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(submittedCount / players.length) * 100}%` }}
            />
          </div>
          <button
            onClick={() => { clearAction(); setLocalAction(null); setLocalFinalShift('NONE') }}
            className="text-xs text-stone-600 hover:text-stone-400 glass-panel rounded-lg px-3 py-1.5 transition-all hover:border-stone-500/30"
          >
            撤回，重新选
          </button>
        </div>
      ) : (
        <>
          {/* 立誓按钮 */}
          <div className="glass-card border-stone-700/30 rounded-xl px-4 py-3">
            <div className="text-xs text-stone-400 mb-2">
              ⚔ 立誓（可选）· 守誓 +2.5 竞争力，背誓 -3.0
            </div>
            <div className="flex gap-2">
              {(['ATK', 'QUA', 'MKT', 'HOLD'] as const).map(a => {
                const isSelected = myPledge?.pledgedAction === a
                const actionName = theme.actionNarrative[a]?.title ?? a
                return (
                  <button
                    key={a}
                    onClick={() => submitPledge(isSelected ? null : a)}
                    className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300'
                        : 'bg-stone-800/50 border border-stone-700/30 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {actionName}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 暗牌（优先展示） */}
          {myWildCard && !myWildCard.used && (
            <button
              onClick={() => { sfxWildCard(); toggleWildCard() }}
              className={`w-full rounded-xl border p-3 text-center transition-all cursor-pointer ${
                useWildCard
                  ? 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-400/30'
                  : 'bg-stone-900/60 border-stone-700/50 hover:border-purple-700'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">{myWildCard.emoji}</span>
                <span className={`font-bold text-sm ${useWildCard ? 'text-purple-300' : 'text-stone-400'}`}>
                  暗牌：{myWildCard.name}
                </span>
                {useWildCard && <span className="text-purple-400 text-xs">✓ 已激活</span>}
              </div>
              <div className="text-xs text-stone-500 mt-1">{myWildCard.description}</div>
              <div className="text-xs text-stone-700 mt-0.5">
                {useWildCard ? '再次点击取消' : '点击本回合使用（一局仅一次）'}
              </div>
            </button>
          )}
          {myWildCard?.used && (
            <div className="text-stone-700 text-xs text-center">🃏 暗牌已使用</div>
          )}

          {/* 常规动作 + 终盘转向（PlayerCard 内含终盘技能选择） */}
          <PlayerCard
            player={myPlayer}
            rank={myRank}
            selectedAction={localAction}
            selectedFinalShift={localFinalShift}
            isFinalRound={isFinalRound}
            isSubmitting={true}
            qualityWeight={global.qualityWeight}
            priceSensitivity={global.priceSensitivity}
            onSelectAction={(action: BaseAction) => { sfxSelect(); setLocalAction(action) }}
            onSelectFinalShift={(shift: FinalShift) => { sfxSelect(); setLocalFinalShift(shift) }}
            onClearAction={() => { setLocalAction(null); setLocalFinalShift('NONE') }}
          />

          {/* 决策预测（选了动作后显示） */}
          {localAction && prediction && <PredictionHint prediction={prediction} />}

          {localAction && (
            <button
              onClick={() => { sfxLock(); submitAction(localAction, localFinalShift) }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black rounded-xl text-base transition-all btn-3d animate-fade-in-up"
            >
              🔒 确认提交
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── 游戏结束子组件 ──
function GameOverPhase({
  players, allAuditLogs, gameNarration, isHost, resetGame, toggleAuditLog
}: {
  players: PlayerState[]
  allAuditLogs: import('@/engine/types').RoundAuditLog[]
  gameNarration: string
  isHost: boolean
  resetGame: () => void
  toggleAuditLog: () => void
}) {
  useEffect(() => { sfxVictory() }, [])

  return (
    <div className="animate-fade-in-up">
      <GameOverPanel
        players={players}
        logs={allAuditLogs}
        gameNarration={gameNarration}
        onReset={isHost ? resetGame : () => {}}
        onShowAuditLog={toggleAuditLog}
      />
    </div>
  )
}

// ── 风向讨论阶段 ──
function IntelPhaseUI({
  global, theme, players, myPlayerId, isFinalRound, isHost,
  currentForecast, pledges, prevRoundPlayers, intelPhaseEndsAt, stakesMultiplier,
  submitPledge, skipIntel, beginnerMode,
}: {
  global: import('@/engine/types').GlobalState
  theme: import('@/engine/themes/types').ThemeConfig
  players: PlayerState[]
  myPlayerId: PlayerId
  isFinalRound: boolean
  isHost: boolean
  currentForecast: import('@/engine/types').MarketForecast | null
  pledges: import('@/engine/types').Pledge[]
  prevRoundPlayers: PlayerState[]
  intelPhaseEndsAt: number
  stakesMultiplier: number
  submitPledge: (a: BaseAction | null) => void
  skipIntel: () => void
  beginnerMode: boolean
}) {
  const [timeLeft, setTimeLeft] = useState(30)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.ceil((intelPhaseEndsAt - Date.now()) / 1000))
      setTimeLeft(remaining)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [intelPhaseEndsAt])

  const myPledge = pledges.find(p => p.playerId === myPlayerId)
  const timerColor = timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-amber-400' : 'text-green-400'

  const ACTION_LABEL: Record<string, string> = {
    ATK: theme.actionNarrative.ATK.title,
    QUA: theme.actionNarrative.QUA.title,
    MKT: theme.actionNarrative.MKT.title,
    HOLD: theme.actionNarrative.HOLD.title,
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      <ShareBar players={players} />

      {/* 终盘横幅 */}
      {isFinalRound && (
        <div className="bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 border border-purple-700/50 rounded-xl p-4 text-center space-y-1.5 animate-fade-in-up">
          <div className="text-2xl font-black text-purple-300 animate-pulse">⚡ 终 盘 决 战 ⚡</div>
          <div className="text-purple-400/80 text-xs">
            最后一回合 · 赌注 ×{stakesMultiplier} · 品质储备可爆发 · 终盘转向开放
          </div>
        </div>
      )}

      {/* 回合变化摘要 */}
      {global.roundNumber > 1 && !isFinalRound && prevRoundPlayers.length > 0 && (
        <RoundChangeSummary players={players} prevPlayers={prevRoundPlayers} roundNumber={global.roundNumber} />
      )}

      {/* 市场风向卡 */}
      {currentForecast && (
        <div className="bg-gradient-to-br from-cyan-950/40 via-stone-900 to-stone-900 border border-cyan-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-black text-base">📡 本轮市场风向</span>
              <span className="text-stone-600 text-xs font-mono">R{global.roundNumber}</span>
            </div>
            {beginnerMode ? (
              <span className="text-green-500/60 text-xs">🌱 不限时</span>
            ) : (
              <div className={`font-mono font-black text-lg ${timerColor} tabular-nums`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          <div className="text-stone-200 font-bold text-sm">
            {currentForecast.headline}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-500 text-xs">推荐行动：</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">
              {ACTION_LABEL[currentForecast.signal]}
            </span>
            <span className="text-stone-600 text-[10px]">跟风：真 +3 竞争力，假 -2</span>
          </div>

          {showDetail ? (
            <div className="bg-stone-950/60 border border-stone-800/50 rounded-lg p-2.5">
              <p className="text-stone-400 text-xs leading-relaxed">{currentForecast.detail}</p>
              <button onClick={() => setShowDetail(false)} className="text-stone-600 text-xs mt-1.5 hover:text-stone-400 transition-all">
                收起
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDetail(true)} className="text-cyan-600 text-xs hover:text-cyan-400 transition-all">
              展开详细分析 →
            </button>
          )}
        </div>
      )}

      {/* 立誓面板 */}
      <div className="glass-card border-stone-700/30 rounded-xl p-4 space-y-3">
        <div className="text-center space-y-1">
          <div className="text-stone-200 font-bold text-sm">⚔ 立誓（可选）</div>
          <div className="text-stone-500 text-xs">
            公开承诺行动 → 守誓 +2.5 竞争力，背誓 -3.0
          </div>
        </div>

        <div className="flex gap-2">
          {(['ATK', 'QUA', 'MKT', 'HOLD'] as const).map(a => {
            const isSelected = myPledge?.pledgedAction === a
            return (
              <button
                key={a}
                onClick={() => submitPledge(isSelected ? null : a)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-900/30 text-amber-300 ring-1 ring-amber-500/30'
                    : 'border-stone-700 text-stone-500 hover:border-stone-500'
                }`}
              >
                {ACTION_LABEL[a]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 已立誓摘要 */}
      {pledges.length > 0 && (
        <div className="glass-card border-amber-800/20 rounded-xl px-4 py-2.5">
          <div className="text-amber-400 text-xs font-bold mb-1">⚔ 已立誓</div>
          <div className="flex flex-wrap gap-2">
            {pledges.map(p => {
              const c = PLAYER_COLORS[p.playerId]
              const player = players.find(pl => pl.id === p.playerId)
              return (
                <span key={p.playerId} className="text-xs">
                  <span className={c?.text ?? ''}>{player?.name}</span>
                  <span className="text-stone-600"> → </span>
                  <span className="text-stone-300 font-bold">{ACTION_LABEL[p.pledgedAction]}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 跳过 / 提示 */}
      {isHost && (
        <button
          onClick={skipIntel}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm transition-all"
        >
          ⚔ 跳过讨论，进入选牌
        </button>
      )}

      <div className="glass-card border-stone-800/30 rounded-lg p-2.5">
        <div className="text-stone-600 text-[10px] space-y-0.5">
          <div>💡 <strong className="text-stone-500">市场风向：</strong>所有人看到同一条预测，跟风有风险也有收益</div>
          <div>• 立誓是承诺 — 守誓加竞争力，背誓扣竞争力</div>
          <div>• {beginnerMode ? '房主点击按钮手动进入选牌阶段' : '倒计时结束自动进入选牌阶段'}</div>
        </div>
      </div>
    </div>
  )
}

// ── 回合变化摘要 ──
function RoundChangeSummary({
  players, prevPlayers, roundNumber,
}: {
  players: PlayerState[]
  prevPlayers: PlayerState[]
  roundNumber: number
}) {
  if (prevPlayers.length === 0) return null

  const leader = [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)[0]
  const prevLeader = [...prevPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)[0]
  const leaderChanged = leader.id !== prevLeader.id

  const movers = players.map(p => {
    const prev = prevPlayers.find(pp => pp.id === p.id)
    return { ...p, shareDelta: prev ? p.marketShare - prev.marketShare : 0 }
  }).sort((a, b) => Math.abs(b.shareDelta) - Math.abs(a.shareDelta))
  const bigMover = movers[0]

  const c = PLAYER_COLORS[leader.id]

  return (
    <div className="glass-card border-stone-700/40 rounded-xl px-3 py-2 flex items-center gap-2 text-[10px] animate-fade-in-up">
      <span className="text-stone-600 font-bold shrink-0">R{roundNumber}</span>
      <span className="text-stone-700">|</span>
      <span className="text-stone-400">
        领先：<span className={`font-bold ${c?.text ?? ''}`}>{leader.name}</span>
        {leaderChanged && <span className="text-amber-400 ml-1">NEW!</span>}
      </span>
      <span className="text-stone-700">|</span>
      <span className="text-stone-400">
        变动：<span className="font-bold text-stone-300">{bigMover.name}</span>
        <span className={`ml-1 font-mono ${bigMover.shareDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {bigMover.shareDelta >= 0 ? '+' : ''}{(bigMover.shareDelta * 100).toFixed(1)}%
        </span>
      </span>
    </div>
  )
}
