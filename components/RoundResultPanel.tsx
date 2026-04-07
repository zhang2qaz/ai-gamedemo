'use client'

import { useEffect, useState, useMemo } from 'react'
import type { RoundAuditLog, PlayerState } from '@/engine/types'
import { formatMoney, formatPercent } from '@/lib/format'
import { useGameStore } from '@/store/gameStore'
import SpeakBtn from './SpeakBtn'
import { speak } from '@/lib/tts'
import { sfxFlipCard, sfxClash, sfxRoundEnd } from '@/lib/sounds'

type Props = {
  log: RoundAuditLog
  players: PlayerState[]
  narration: string
  onNext: () => void
  isGameOver: boolean
}

import { PLAYER_COLORS as PC } from '@/lib/playerColors'

const getPlayerColor = (id: string) => {
  const c = PC[id as keyof typeof PC]
  return {
    title: c?.text ?? 'text-stone-400',
    border: c?.border ? c.border.replace('500', '700/60') : 'border-stone-700/60',
    bg: c?.bg ?? 'bg-stone-950/20',
  }
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

// 揭牌阶段
type RevealPhase = 'FLIP' | 'CLASH' | 'RESULT' | 'NARRATE'

export default function RoundResultPanel({ log, players, narration, onNext, isGameOver }: Props) {
  const theme = useGameStore(s => s.theme)
  const sorted = [...log.players].sort((a, b) => b.netProfit - a.netProfit)
  const winner = sorted[0]
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null)
  const [phase, setPhase] = useState<RevealPhase>('FLIP')
  const [revealedCount, setRevealedCount] = useState(0)

  const an = theme?.actionNarrative
  const fsn = theme?.finalShiftNarrative
  const t = theme?.terms

  const getEmoji = (action: string) => theme?.actionCards?.[action as keyof typeof theme.actionCards]?.emoji ?? ACTION_EMOJI[action] ?? '?'
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? action

  // 揭牌动画阶段推进
  useEffect(() => {
    setPhase('FLIP')
    setRevealedCount(0)

    // 逐张翻牌（每张300ms）
    const playerCount = log.players.length
    const flipTimers: NodeJS.Timeout[] = []
    for (let i = 0; i < playerCount; i++) {
      flipTimers.push(setTimeout(() => { setRevealedCount(i + 1); sfxFlipCard() }, 300 + i * 300))
    }

    // 所有牌翻完后 → 冲突动画
    const clashDelay = 300 + playerCount * 300 + 200
    const clashTimer = setTimeout(() => { setPhase('CLASH'); sfxClash() }, clashDelay)

    // 冲突动画持续1.2s → 显示完整结果
    const resultTimer = setTimeout(() => { setPhase('RESULT'); sfxRoundEnd() }, clashDelay + 1200)

    // 结果后0.8s → 叙事
    const narrateTimer = setTimeout(() => setPhase('NARRATE'), clashDelay + 2000)

    return () => {
      flipTimers.forEach(clearTimeout)
      clearTimeout(clashTimer)
      clearTimeout(resultTimer)
      clearTimeout(narrateTimer)
    }
  }, [log.round, log.players.length])

  // Auto-speak removed — disruptive in group settings. Players can use 🔊 button instead.

  // 检测冲突事件（多人ATK / 多人MKT / 独家行动）
  const atkCount = log.players.filter(p => p.action === 'ATK').length
  const mktCount = log.players.filter(p => p.action === 'MKT').length
  const clashMessage = (() => {
    const msgs: string[] = []
    if (atkCount >= 3) msgs.push(`⚔️ ${atkCount}方混战！${getLabel('ATK')}效果被严重稀释！`)
    else if (atkCount === 2) msgs.push(`⚔️ 双方对攻！${getLabel('ATK')}效果互相摊薄！`)
    else if (atkCount === 1) {
      const attacker = log.players.find(p => p.action === 'ATK')
      const name = players.find(p => p.id === attacker?.id)?.name ?? ''
      msgs.push(`🎯 ${name} 独家出击！`)
    }
    if (mktCount >= 2) msgs.push(`📢 ${mktCount}家同时推广，品牌噪音互相干扰！`)
    const holdCount = log.players.filter(p => p.action === 'HOLD').length
    if (holdCount >= log.players.length - 1) msgs.push(`🛡 全场静默，市场进入僵持！`)
    return msgs
  })()

  // 赌注倍数
  const stakes = log.global.stakesMultiplier ?? 1

  const unit = t?.unit ?? '杯'

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-amber-400 font-black text-xl uppercase tracking-wider animate-fade-in-up">
            第 {log.round} 回合结算
          </h2>
          {stakes !== 1 && (
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              stakes >= 2 ? 'bg-red-900/60 text-red-300 border border-red-700' :
              stakes >= 1.5 ? 'bg-orange-900/60 text-orange-300 border border-orange-700' :
              stakes < 1 ? 'bg-stone-700/60 text-stone-400 border border-stone-600' :
              'bg-amber-900/60 text-amber-300 border border-amber-700'
            }`}>
              {stakes >= 2 ? '🔥' : stakes >= 1.5 ? '⬆' : '⬇'} 赌注 ×{stakes}
            </span>
          )}
          {log.global.eventApplied && (
            <div className="text-xs bg-orange-950/50 text-orange-300 border border-orange-700/50 px-3 py-1 rounded-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              ⚡ {log.global.eventApplied}
            </div>
          )}
        </div>
        {phase === 'NARRATE' && (
          <button
            onClick={onNext}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl uppercase tracking-wider text-sm transition-all animate-fade-in-up"
          >
            {isGameOver ? '查看最终结果 →' : `第 ${log.round + 1} 回合 →`}
          </button>
        )}
      </div>

      {/* ── 阶段1：逐张翻牌 ── */}
      {phase === 'FLIP' && (
        <div className={`grid gap-4 grid-cols-2 ${log.players.length <= 4 ? 'lg:grid-cols-4' : log.players.length <= 6 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {log.players.map((p, idx) => {
            const revealed = idx < revealedCount
            const col = getPlayerColor(p.id)
            const playerState = players.find(pl => pl.id === p.id)!
            return (
              <div key={p.id} className="perspective-500">
                <div className={`transition-all duration-500 ${revealed ? 'animate-slide-in-scale' : ''}`}>
                  {revealed ? (
                    <div className={`border-2 rounded-xl p-4 ${col.border} ${col.bg} text-center space-y-2`}>
                      <div className={`font-bold text-sm ${col.title}`}>{playerState.name}</div>
                      <div className="text-4xl">{getEmoji(p.action)}</div>
                      <span className={`inline-block text-sm font-bold px-3 py-1 rounded border ${ACTION_BADGE[p.action]}`}>
                        {getLabel(p.action)}
                      </span>
                      {p.finalShift !== 'NONE' && (
                        <div className="text-xs text-purple-300">⚡ {fsn?.[p.finalShift]?.title ?? p.finalShift}</div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-stone-700 rounded-xl p-4 bg-stone-800/40 text-center space-y-2 animate-breathe">
                      <div className="text-stone-600 font-bold text-sm">{playerState.name}</div>
                      <div className="text-4xl opacity-30">❓</div>
                      <div className="text-stone-700 text-xs">等待揭牌...</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 阶段2：冲突特效 ── */}
      {phase === 'CLASH' && (
        <div className="py-8 flex flex-col items-center gap-4 animate-slide-in-scale">
          {clashMessage.map((msg, i) => (
            <div
              key={i}
              className="text-2xl font-black text-center animate-fade-in-up"
              style={{ animationDelay: `${i * 300}ms` }}
            >
              {msg}
            </div>
          ))}
          {clashMessage.length === 0 && (
            <div className="text-2xl font-black text-amber-400 animate-fade-in-up">
              📊 结算中...
            </div>
          )}
        </div>
      )}

      {/* ── 阶段3：完整结果 ── */}
      {(phase === 'RESULT' || phase === 'NARRATE') && (
        <>
          <div className={`grid gap-3 ${log.players.length <= 4 ? 'grid-cols-4' : log.players.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {log.players.map((p, idx) => {
              const col = getPlayerColor(p.id)
              const isTopProfit = p.id === winner.id
              const shareDelta = p.newShare - p.oldShare
              const playerState = players.find(pl => pl.id === p.id)!
              return (
                <div
                  key={p.id}
                  className={`border-2 rounded-xl p-4 space-y-3 ${col.border} ${col.bg} ${isTopProfit ? 'ring-2 ring-yellow-500/40' : ''} animate-fade-in-up`}
                  style={{ animationDelay: `${idx * 100}ms` }}
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
                    <div className={`text-2xl font-black font-mono ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'} animate-count-up`}>
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
                          <div className="text-stone-500">{cups.toLocaleString()} {unit} × ¥{p.unitPrice}{stakes !== 1 ? ` × ${stakes}倍` : ''} = <span className="text-stone-300">¥{Math.round(p.revenue).toLocaleString()}</span></div>
                          <div className="text-stone-500">× {t?.profit ?? '利润'}率 {marginPct}% = <span className="text-stone-300">¥{Math.round(p.grossProfit).toLocaleString()}</span></div>
                          {p.revenueBonus > 0 && (
                            <div className="text-stone-500">+ 品牌变现 = <span className="text-purple-300">+¥{Math.round(p.revenueBonus).toLocaleString()}</span></div>
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
                      <div className="h-2 rounded-l bg-stone-700 animate-bar-grow" style={{ width: `${Math.min(100, p.oldShare * log.players.length * 100).toFixed(0)}%`, minWidth: '2px' }} />
                      {shareDelta >= 0
                        ? <div className="h-2 rounded-r bg-green-500 animate-bar-grow" style={{ width: `${Math.min(30, shareDelta * log.players.length * 100).toFixed(0)}%`, minWidth: shareDelta > 0 ? '2px' : '0', animationDelay: '300ms' }} />
                        : <div className="h-2 rounded-r bg-red-600 animate-bar-grow" style={{ width: `${Math.min(30, Math.abs(shareDelta) * log.players.length * 100).toFixed(0)}%`, minWidth: '2px', animationDelay: '300ms' }} />
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

          {/* 排名条 */}
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl px-4 py-3 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <span className="text-stone-500 text-xs uppercase tracking-wider font-bold shrink-0">本轮{t?.profit ?? '利润'}</span>
            <div className="flex gap-4 flex-1 flex-wrap">
              {sorted.map((p, i) => {
                const col = getPlayerColor(p.id)
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣']
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
        </>
      )}

      {/* ── 阶段4：叙事 ── */}
      {phase === 'NARRATE' && (
        <>
          <div className="bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-stone-400 text-sm leading-relaxed whitespace-pre-line relative animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="absolute top-3 right-3">
              <SpeakBtn text={narration} size="md" />
            </div>
            {narration}
          </div>

          {/* Intel & Social Report */}
          <IntelSocialReport log={log} players={players} />
        </>
      )}
    </div>
  )
}

// ── Intel & Social Report (shown after narration) ──
function IntelSocialReport({ log, players }: { log: RoundAuditLog; players: PlayerState[] }) {
  const lastRoundIntelReport = useGameStore(s => s.lastRoundIntelReport)
  const announcements = useGameStore(s => s.lastRoundAnnouncements)
  const revengeMarks = useGameStore(s => s.lastRoundRevengeMarks)
  const theme = useGameStore(s => s.theme)

  const an = theme?.actionNarrative
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? action

  // Map player actions from audit log
  const actualActions = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of log.players) map[p.id] = p.action
    return map
  }, [log.players])

  const hasContent = lastRoundIntelReport.length > 0 || announcements.length > 0 || Object.values(revengeMarks).some(Boolean)
  if (!hasContent) return null

  return (
    <div className="bg-stone-950/50 border border-stone-800/50 rounded-xl p-4 space-y-3 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
      <div className="text-amber-400 font-bold text-sm">📋 社交互动复盘</div>

      {/* Intel shares report */}
      {lastRoundIntelReport.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-stone-500 text-xs font-bold">🃏 情报交易：</div>
          {lastRoundIntelReport.map((share, i) => {
            const sender = players.find(p => p.id === share.from)
            const receiver = players.find(p => p.id === share.to)
            const senderColor = PC[share.from as keyof typeof PC]
            const receiverColor = PC[share.to as keyof typeof PC]
            return (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className={senderColor?.text ?? 'text-stone-400'}>{sender?.name}</span>
                <span className="text-stone-600">→</span>
                <span className={receiverColor?.text ?? 'text-stone-400'}>{receiver?.name}</span>
                <span className="text-stone-600">：声称建议</span>
                <span className="font-bold text-stone-300">{getLabel(share.claimedAction)}</span>
                <span className={share.isBluff ? 'text-red-400 font-bold' : 'text-green-400'}>
                  {share.isBluff ? '🎭 虚假!' : '✅ 真实'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Announcement results */}
      {announcements.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-stone-500 text-xs font-bold">📢 宣言兑现：</div>
          {announcements.map((ann, i) => {
            const player = players.find(p => p.id === ann.playerId)
            const color = PC[ann.playerId as keyof typeof PC]
            const actual = actualActions[ann.playerId]
            const honest = actual === ann.declaredAction
            return (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className={color?.text ?? 'text-stone-400'}>{player?.name}</span>
                <span className="text-stone-600">宣称</span>
                <span className="text-stone-300 font-bold">{getLabel(ann.declaredAction)}</span>
                <span className="text-stone-600">→ 实际</span>
                <span className="text-stone-300 font-bold">{getLabel(actual)}</span>
                <span className={honest ? 'text-green-400 font-bold' : 'text-red-400'}>
                  {honest ? '✅ +¥10k' : '❌ -¥10k'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Revenge results */}
      {Object.values(revengeMarks).some(Boolean) && (
        <div className="space-y-1.5">
          <div className="text-stone-500 text-xs font-bold">🎯 复仇标记：</div>
          {Object.entries(revengeMarks).map(([markerId, targetId]) => {
            if (!targetId) return null
            const marker = players.find(p => p.id === markerId)
            const target = players.find(p => p.id === targetId)
            const markerColor = PC[markerId as keyof typeof PC]
            const markerAction = actualActions[markerId]
            const targetAction = actualActions[targetId]
            const gotBonus = markerAction === 'ATK' && targetAction !== 'ATK'
            const countered = markerAction === 'ATK' && targetAction === 'ATK'
            return (
              <div key={markerId} className="flex items-center gap-1.5 text-xs">
                <span className={markerColor?.text ?? 'text-stone-400'}>{marker?.name}</span>
                <span className="text-stone-600">标记了</span>
                <span className="text-stone-300 font-bold">{target?.name}</span>
                {gotBonus ? (
                  <span className="text-green-400 font-bold">⚔ 选了ATK → +¥15k 复仇奖金!</span>
                ) : countered ? (
                  <span className="text-amber-400 font-bold">⚔ 对手反击ATK！奖金无效！</span>
                ) : (
                  <span className="text-stone-600">但未选ATK，未触发</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
