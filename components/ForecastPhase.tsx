'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { PlayerId, BaseAction } from '@/engine/types'
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

const FORECAST_PHASE_DURATION = 30

export default function ForecastPhase() {
  const theme = useGameStore(s => s.theme)
  const players = useGameStore(s => s.players)
  const global = useGameStore(s => s.global)
  const currentForecast = useGameStore(s => s.currentForecast)
  const pledges = useGameStore(s => s.pledges)
  const endIntelPhase = useGameStore(s => s.endIntelPhase)
  const setPledge = useGameStore(s => s.setPledge)

  const [timeLeft, setTimeLeft] = useState(FORECAST_PHASE_DURATION)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    setTimeLeft(FORECAST_PHASE_DURATION)
    setShowDetail(false)
  }, [global.roundNumber])

  useEffect(() => {
    if (timeLeft <= 0) {
      endIntelPhase()
      return
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, endIntelPhase])

  const ACTION_LABEL: Record<string, string> = theme?.actionNarrative
    ? { ATK: theme.actionNarrative.ATK.title, QUA: theme.actionNarrative.QUA.title, MKT: theme.actionNarrative.MKT.title, HOLD: theme.actionNarrative.HOLD.title }
    : { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }

  const ACTION_OPTIONS: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']

  const pledgeMap: Record<string, BaseAction> = {}
  for (const p of pledges) pledgeMap[p.playerId] = p.pledgedAction

  const timerColor = timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-amber-400' : 'text-green-400'

  return (
    <div className="space-y-4">
      {/* 市场风向卡 */}
      {currentForecast && (
        <div className="bg-gradient-to-br from-cyan-950/40 via-stone-900 to-stone-900 border border-cyan-800/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-black text-lg">📡 本轮市场风向</span>
              <span className="text-stone-600 text-xs font-mono">R{global.roundNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <SpeakBtn text={`市场风向：${currentForecast.headline}。${currentForecast.detail}。推荐行动：${ACTION_LABEL[currentForecast.signal]}。`} />
              <div className={`font-mono font-black text-lg ${timerColor} tabular-nums`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="text-stone-200 font-bold text-base">
            {currentForecast.headline}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-500 text-sm">推荐行动：</span>
            <span className="text-sm font-bold px-2.5 py-1 rounded-lg bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">
              {ACTION_LABEL[currentForecast.signal]}
            </span>
            <span className="text-stone-600 text-xs">跟风有赌注：风向为真 +3 竞争力，为假 -2 竞争力</span>
          </div>

          {showDetail ? (
            <div className="bg-stone-950/60 border border-stone-800/50 rounded-lg p-3">
              <p className="text-stone-400 text-sm leading-relaxed">{currentForecast.detail}</p>
              <button onClick={() => setShowDetail(false)} className="text-stone-600 text-xs mt-2 hover:text-stone-400 transition-all">
                收起分析
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDetail(true)}
              className="text-cyan-600 text-xs hover:text-cyan-400 transition-all"
            >
              展开详细分析 →
            </button>
          )}
        </div>
      )}

      {/* 立誓面板 */}
      <div className="bg-stone-900/60 border border-stone-700/50 rounded-xl p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-stone-200 font-bold">⚔ 立誓（可选）</div>
          <div className="text-stone-500 text-sm">
            公开承诺你的行动 → 守誓 +2.5 竞争力，背誓 -3.0 竞争力
          </div>
          <div className="text-stone-600 text-xs">
            立誓让你更强但透明 · 不立誓保持灵活
          </div>
        </div>

        <div className="space-y-3">
          {players.map(player => {
            const c = PLAYER_COLORS[player.id]
            const currentPledge = pledgeMap[player.id]

            return (
              <div key={player.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className={`font-bold text-sm truncate ${c.text}`}>{player.name}</span>
                </div>
                <div className="flex gap-2 flex-1">
                  {ACTION_OPTIONS.map(a => {
                    const isSelected = currentPledge === a
                    return (
                      <button
                        key={a}
                        onClick={() => setPledge(player.id as PlayerId, isSelected ? null : a)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
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
            )
          })}
        </div>
      </div>

      {/* 立誓摘要 */}
      {pledges.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-4 py-3">
          <div className="text-amber-400 text-xs font-bold mb-1.5">⚔ 已立誓</div>
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

      {/* 进入选牌 */}
      <button
        onClick={endIntelPhase}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-base transition-all cursor-pointer"
      >
        ⚔ 进入选牌阶段
      </button>

      {/* 提示 */}
      <div className="bg-stone-900/40 border border-stone-800/40 rounded-lg p-3">
        <div className="text-stone-600 text-xs space-y-1">
          <div>💡 <strong className="text-stone-500">市场风向：</strong>所有人看到同一条预测，跟风有风险也有收益</div>
          <div>• 跟风 + 风向正确：竞争力 +3.0 · 跟风 + 风向错误：竞争力 -2.0</div>
          <div>• 立誓是承诺 — 守誓加竞争力，背誓扣竞争力</div>
          <div>• 讨论策略后，点击「进入选牌阶段」</div>
        </div>
      </div>
    </div>
  )
}
