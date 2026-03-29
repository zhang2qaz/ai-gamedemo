'use client'

import { useState, useEffect } from 'react'
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

const PLAYER_COLORS: Record<string, {
  text: string; border: string; bg: string; ring: string; dot: string
}> = {
  A: { text: 'text-amber-400',   border: 'border-amber-700',   bg: 'bg-amber-950/30',   ring: 'ring-amber-500/40',   dot: 'bg-amber-400' },
  B: { text: 'text-sky-400',     border: 'border-sky-700',     bg: 'bg-sky-950/30',     ring: 'ring-sky-500/40',     dot: 'bg-sky-400' },
  C: { text: 'text-emerald-400', border: 'border-emerald-700', bg: 'bg-emerald-950/30', ring: 'ring-emerald-500/40', dot: 'bg-emerald-400' },
  D: { text: 'text-purple-400',  border: 'border-purple-700',  bg: 'bg-purple-950/30',  ring: 'ring-purple-500/40',  dot: 'bg-purple-400' },
}

export default function GameBoard() {
  const {
    phase, theme, global, players, pendingInputs,
    auditLogs, roundNarrations, gameNarration,
    currentRoundResult, showAuditLog, generatedIntel, intelTruth,
    selectTheme, setAction, clearAction, setFinalShift, submitRound,
    nextRound, resetGame, backToThemeSelect, toggleAuditLog, ensureIntel,
  } = useGameStore()

  // 客户端首次渲染时生成情报
  useEffect(() => { ensureIntel() }, [ensureIntel])

  // 当前正在输入的玩家（全屏遮罩）
  const [activeInput, setActiveInput] = useState<PlayerId | null>(null)

  // ── 主题选择页 ──
  if (phase === 'THEME_SELECT') {
    return <ThemeSelect onSelect={selectTheme} />
  }

  const isFinalRound = global.roundNumber === global.maxRounds
  const isSubmitting = phase === 'SUBMITTING'
  const isRoundResult = phase === 'ROUND_RESULT'
  const isGameOver = phase === 'GAME_OVER'

  const allSubmitted = (['A', 'B', 'C', 'D'] as PlayerId[]).every(id => pendingInputs[id].action !== null)
  const submittedCount = (['A', 'B', 'C', 'D'] as PlayerId[]).filter(id => pendingInputs[id].action !== null).length

  const currentNarration = roundNarrations[roundNarrations.length - 1] ?? ''
  const rankingOrder = getFinalRanking(players)
  const rankMap = Object.fromEntries(rankingOrder.map((p, i) => [p.id, i + 1]))
  const signal = isSubmitting ? getSignalForRound(global.eventQueue, global.roundNumber) : null

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

          {/* 状态文字 */}
          <div className="text-sm whitespace-nowrap shrink-0">
            {isSubmitting && <span className="text-amber-400 font-bold">R{global.roundNumber} · 选牌</span>}
            {isRoundResult && <span className="text-green-400 font-bold">R{global.roundNumber - 1} · 结算完毕</span>}
            {isGameOver && <span className="text-yellow-400 font-bold">⚑ 终局</span>}
            {isFinalRound && isSubmitting && <span className="ml-1 text-purple-400 font-bold">⚡终盘</span>}
          </div>

          {/* 市场参数 */}
          {isSubmitting && (() => {
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
            {auditLogs.length > 0 && (
              <button onClick={toggleAuditLog} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800 transition-all">
                📋 审计
              </button>
            )}
            <button onClick={backToThemeSelect} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-lg border border-stone-800 transition-all">
              🏠 换场景
            </button>
            <button onClick={resetGame} className="px-3 py-1.5 text-xs bg-stone-900 hover:bg-red-950 text-stone-600 hover:text-red-400 rounded-lg border border-stone-800 hover:border-red-900 transition-all">
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
          </>
          )
        })()}

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
                    ⚡ 第 5 回合 · 可选终盘转向
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

              <div className="grid grid-cols-4 gap-3">
                {players.map(player => {
                  const isLocked = pendingInputs[player.id].action !== null
                  const c = PLAYER_COLORS[player.id]
                  return (
                    <button
                      key={player.id}
                      onClick={() => { if (!isLocked) setActiveInput(player.id as PlayerId) }}
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
                  onClick={submitRound}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base uppercase tracking-wider transition-all"
                >
                  ⚔ 同步亮牌
                </button>
              ) : (
                <div className="text-center text-stone-600 text-xs">
                  {submittedCount}/4 已锁定 · 等待所有玩家完成选择
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
          <div className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-start overflow-y-auto py-6 px-4 gap-4">
            <div className={`text-center px-6 py-3 rounded-xl border ${c.bg} ${c.border} w-full max-w-sm`}>
              <div className={`font-black text-xl ${c.text}`}>{player.name}</div>
              <div className="text-stone-400 text-sm mt-1">请选择本回合动作</div>
              <div className="text-stone-600 text-xs mt-0.5">其他玩家请背对屏幕</div>
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
                onSelectAction={(action: BaseAction) => setAction(activeInput, action)}
                onSelectFinalShift={(shift: FinalShift) => setFinalShift(activeInput, shift)}
                onClearAction={() => clearAction(activeInput)}
              />
            </div>

            {pendingInputs[activeInput].action === null && (
              <button
                onClick={() => setActiveInput(null)}
                className="text-stone-600 hover:text-stone-400 text-sm transition-all py-2"
              >
                ← 返回（暂不选）
              </button>
            )}
          </div>
        )
      })()}

      {showAuditLog && <AuditLogPanel logs={auditLogs} onClose={toggleAuditLog} />}
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
      const t = setTimeout(() => setActiveInput(null), 800)
      return () => clearTimeout(t)
    }
  }, [pendingInputs, activeInput, setActiveInput])

  useEffect(() => {
    setActiveInput(null)
  }, [roundNumber, setActiveInput])

  return null
}
