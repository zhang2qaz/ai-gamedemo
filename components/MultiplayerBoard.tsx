'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { getTheme } from '@/engine/themes'
import type { BaseAction, FinalShift, PlayerId } from '@/engine/types'
import { getFinalRanking } from '@/engine/resolveGame'
import { getSignalForRound } from '@/engine/events'
import PlayerCard from './PlayerCard'
import RoundResultPanel from './RoundResultPanel'
import GameOverPanel from './GameOverPanel'
import ShareBar from './ShareBar'
import IntelFeed from './IntelFeed'
import SpeakBtn from './SpeakBtn'

import { PLAYER_COLORS } from '@/lib/playerColors'

export default function MultiplayerBoard() {
  const phase = useMultiplayerStore(s => s.phase)
  const mode = useMultiplayerStore(s => s.mode)
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const themeId = useMultiplayerStore(s => s.themeId)
  const global = useMultiplayerStore(s => s.global)
  const players = useMultiplayerStore(s => s.players)
  const pendingStatus = useMultiplayerStore(s => s.pendingStatus)
  const generatedIntel = useMultiplayerStore(s => s.generatedIntel)
  const intelTruth = useMultiplayerStore(s => s.intelTruth)
  const currentAuditLog = useMultiplayerStore(s => s.currentAuditLog)
  const currentNarration = useMultiplayerStore(s => s.currentNarration)
  const allAuditLogs = useMultiplayerStore(s => s.allAuditLogs)
  const gameNarration = useMultiplayerStore(s => s.gameNarration)
  const submitAction = useMultiplayerStore(s => s.submitAction)
  const clearAction = useMultiplayerStore(s => s.clearAction)
  const nextRound = useMultiplayerStore(s => s.nextRound)
  const resetGame = useMultiplayerStore(s => s.resetGame)
  const backToModeSelect = useMultiplayerStore(s => s.backToModeSelect)

  const [localAction, setLocalAction] = useState<BaseAction | null>(null)
  const [localFinalShift, setLocalFinalShift] = useState<FinalShift>('NONE')

  const theme = themeId ? getTheme(themeId) : null
  if (!theme || !global || !myPlayerId) return null

  const myPlayer = players.find(p => p.id === myPlayerId)
  if (!myPlayer) return null

  const isFinalRound = global.roundNumber === global.maxRounds
  const isHost = mode === 'host'
  const rankingOrder = getFinalRanking(players)
  const rankMap = Object.fromEntries(rankingOrder.map((p, i) => [p.id, i + 1]))
  const myRank = rankMap[myPlayerId] || 4
  const iSubmitted = pendingStatus[myPlayerId]
  const submittedCount = Object.values(pendingStatus).filter(Boolean).length
  const signal = phase === 'SUBMITTING' ? getSignalForRound(global.eventQueue ?? [], global.roundNumber) : null

  return (
    <div className="min-h-screen text-white flex flex-col relative" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1c1917 0%, #0c0a09 70%)' }}>
      {/* ── 顶栏 ── */}
      <div className="glass-panel border-b border-stone-800/50 sticky top-0 z-20">
        <div className="max-w-screen-sm mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="shrink-0">
            <div className="font-black text-base leading-tight">
              <span className="text-gradient-gold">弈战</span>
              <span className={`text-xs font-bold ml-1.5 ${PLAYER_COLORS[myPlayerId]?.text}`} style={{ textShadow: '0 0 8px currentColor' }}>{myPlayer.name}</span>
            </div>
          </div>

          {/* 回合进度 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {Array.from({ length: global.maxRounds }, (_, i) => i + 1).map(r => {
              const done = phase === 'GAME_OVER' ? true : r < global.roundNumber
              const current = r === global.roundNumber && phase !== 'GAME_OVER'
              return (
                <div key={r} className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all duration-300 ${
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

          <div className="ml-auto shrink-0">
            <button onClick={backToModeSelect} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">退出</button>
          </div>
        </div>
      </div>

      {/* ── 主内容 ── */}
      <div className="flex-1 max-w-screen-sm mx-auto w-full px-4 py-4 flex flex-col gap-3">

        {/* 游戏结束 */}
        {phase === 'GAME_OVER' && (
          <div className="animate-fade-in-up">
            <GameOverPanel
              players={players}
              logs={allAuditLogs}
              gameNarration={gameNarration}
              onReset={isHost ? resetGame : () => {}}
              onShowAuditLog={() => {}}
            />
          </div>
        )}

        {/* 回合结果 */}
        {phase === 'ROUND_RESULT' && currentAuditLog && (
          <div className="space-y-3 animate-fade-in-up">
            <ShareBar players={players} />
            <RoundResultPanel
              log={currentAuditLog}
              players={players}
              narration={currentNarration}
              onNext={isHost ? nextRound : () => {}}
              isGameOver={false}
            />
            {isHost ? (
              <button
                onClick={nextRound}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black rounded-xl text-base transition-all btn-3d"
              >
                下一回合 →
              </button>
            ) : (
              <div className="text-center text-stone-500 text-sm py-3 animate-breathe">等待房主进入下一回合...</div>
            )}
          </div>
        )}

        {/* 出牌阶段 */}
        {phase === 'SUBMITTING' && (
          <div className="space-y-3 animate-fade-in">
            <ShareBar players={players} />

            {/* 情报流 */}
            {(() => {
              const intel = generatedIntel.find(r => r.round === global.roundNumber) ?? null
              return intel ? (
                <IntelFeed
                  intel={intel}
                  truthOverrides={intelTruth[global.roundNumber]}
                  revealed={false}
                />
              ) : null
            })()}

            {/* 事件横幅 */}
            {(signal || isFinalRound) && (
              <div className="flex gap-2 animate-fade-in-up">
                {signal && (
                  <div className="flex-1 glass-card border-amber-800/30 rounded-xl px-4 py-2.5 text-amber-300 text-sm flex items-center gap-2">
                    <span className="flex-1 text-glow-amber">🔔 {signal}</span>
                    <SpeakBtn text={`市场预警：${signal}`} />
                  </div>
                )}
                {isFinalRound && (
                  <div className="glass-card border-purple-800/30 rounded-xl px-4 py-2.5 text-purple-300 text-sm font-bold shrink-0 glow-purple">
                    ⚡ 终盘
                  </div>
                )}
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
                {/* 进度条 */}
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
                <PlayerCard
                  player={myPlayer}
                  rank={myRank}
                  selectedAction={localAction}
                  selectedFinalShift={localFinalShift}
                  isFinalRound={isFinalRound}
                  isSubmitting={true}
                  qualityWeight={global.qualityWeight}
                  priceSensitivity={global.priceSensitivity}
                  onSelectAction={(action: BaseAction) => setLocalAction(action)}
                  onSelectFinalShift={(shift: FinalShift) => setLocalFinalShift(shift)}
                  onClearAction={() => { setLocalAction(null); setLocalFinalShift('NONE') }}
                />
                {localAction && (
                  <button
                    onClick={() => { submitAction(localAction, localFinalShift) }}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black rounded-xl text-base transition-all btn-3d animate-fade-in-up"
                  >
                    🔒 确认提交
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
