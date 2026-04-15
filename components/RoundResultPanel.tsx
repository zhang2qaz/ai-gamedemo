'use client'

import { useEffect, useState, useMemo } from 'react'
import type { RoundAuditLog, PlayerState, MarketForecast, Pledge } from '@/engine/types'
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
  lastRoundForecast?: MarketForecast | null
  lastRoundPledges?: Pledge[]
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

export default function RoundResultPanel({ log, players, narration, onNext, isGameOver, lastRoundForecast, lastRoundPledges }: Props) {
  const theme = useGameStore(s => s.theme)
  const sorted = [...log.players].sort((a, b) => b.netProfit - a.netProfit)
  const winner = sorted[0]
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null)
  const [phase, setPhase] = useState<RevealPhase>('FLIP')
  const [revealedCount, setRevealedCount] = useState(0)
  const [showDetailCards, setShowDetailCards] = useState(false)

  const an = theme?.actionNarrative
  const fsn = theme?.finalShiftNarrative
  const t = theme?.terms

  const getEmoji = (action: string) => theme?.actionCards?.[action as keyof typeof theme.actionCards]?.emoji ?? ACTION_EMOJI[action] ?? '?'
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }[action] ?? action

  // 揭牌动画阶段推进
  useEffect(() => {
    setPhase('FLIP')
    setRevealedCount(0)

    const playerCount = log.players.length
    const flipTimers: NodeJS.Timeout[] = []
    for (let i = 0; i < playerCount; i++) {
      flipTimers.push(setTimeout(() => { setRevealedCount(i + 1); sfxFlipCard() }, 300 + i * 300))
    }

    const clashDelay = 300 + playerCount * 300 + 200
    const clashTimer = setTimeout(() => { setPhase('CLASH'); sfxClash() }, clashDelay)
    const resultTimer = setTimeout(() => { setPhase('RESULT'); sfxRoundEnd() }, clashDelay + 1200)
    const narrateTimer = setTimeout(() => setPhase('NARRATE'), clashDelay + 2000)

    return () => {
      flipTimers.forEach(clearTimeout)
      clearTimeout(clashTimer)
      clearTimeout(resultTimer)
      clearTimeout(narrateTimer)
    }
  }, [log.round, log.players.length])

  // 检测冲突事件
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

  const stakes = log.global.stakesMultiplier ?? 1
  const unit = t?.unit ?? '单位'

  return (
    <div className="space-y-3">
      {/* ── 标题栏（移动端优化） ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-amber-400 font-black text-lg animate-fade-in-up">
            第 {log.round} 回合结算
          </h2>
          {stakes !== 1 && (
            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
              stakes >= 2 ? 'bg-red-900/60 text-red-300 border border-red-700' :
              stakes >= 1.5 ? 'bg-orange-900/60 text-orange-300 border border-orange-700' :
              'bg-amber-900/60 text-amber-300 border border-amber-700'
            }`}>
              赌注 ×{stakes}
            </span>
          )}
          {log.global.eventApplied && (
            <span className="text-xs bg-orange-950/50 text-orange-300 border border-orange-700/50 px-2 py-0.5 rounded-full animate-fade-in-up">
              ⚡ {log.global.eventApplied}
            </span>
          )}
        </div>
        {phase === 'NARRATE' && (
          <button
            onClick={onNext}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm transition-all animate-fade-in-up"
          >
            {isGameOver ? '最终结果 →' : `第 ${log.round + 1} 回合 →`}
          </button>
        )}
      </div>

      {/* ── 阶段1：逐张翻牌 ── */}
      {phase === 'FLIP' && (
        <div className="grid grid-cols-2 gap-2.5">
          {log.players.map((p, idx) => {
            const revealed = idx < revealedCount
            const col = getPlayerColor(p.id)
            const playerState = players.find(pl => pl.id === p.id)!
            return (
              <div key={p.id}>
                <div className={`transition-all duration-500 ${revealed ? 'animate-slide-in-scale' : ''}`}>
                  {revealed ? (
                    <div className={`border-2 rounded-xl p-3 ${col.border} ${col.bg} text-center space-y-1.5`}>
                      <div className={`font-bold text-sm ${col.title}`}>{playerState.name}</div>
                      <div className="text-3xl">{getEmoji(p.action)}</div>
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded border ${ACTION_BADGE[p.action]}`}>
                        {getLabel(p.action)}
                      </span>
                      {p.finalShift !== 'NONE' && (
                        <div className="text-xs text-purple-300">⚡ {fsn?.[p.finalShift]?.title ?? p.finalShift}</div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-stone-700 rounded-xl p-3 bg-stone-800/40 text-center space-y-1.5 animate-breathe">
                      <div className="text-stone-600 font-bold text-sm">{playerState.name}</div>
                      <div className="text-3xl opacity-30">❓</div>
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
        <div className="py-6 flex flex-col items-center gap-3 animate-slide-in-scale">
          {clashMessage.map((msg, i) => (
            <div
              key={i}
              className="text-lg font-black text-center animate-fade-in-up px-2"
              style={{ animationDelay: `${i * 300}ms` }}
            >
              {msg}
            </div>
          ))}
          {clashMessage.length === 0 && (
            <div className="text-lg font-black text-amber-400 animate-fade-in-up">
              📊 结算中...
            </div>
          )}
        </div>
      )}

      {/* ── 阶段3：完整结果（移动端竖排卡片） ── */}
      {(phase === 'RESULT' || phase === 'NARRATE') && (
        <>
          {/* 本轮排行（移动端优先显示） */}
          <div className="glass-card rounded-xl px-3 py-2.5 animate-fade-in-up">
            <div className="text-stone-500 text-xs font-bold mb-2">🏆 本轮{t?.profit ?? '利润'}排行</div>
            <div className="space-y-1.5">
              {sorted.map((p, i) => {
                const col = getPlayerColor(p.id)
                const medals = ['🥇', '🥈', '🥉', '4️⃣']
                const playerState = players.find(pl => pl.id === p.id)!
                const shareDelta = p.newShare - p.oldShare
                return (
                  <div key={p.id} className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="text-base w-6 text-center">{medals[i] ?? `${i + 1}`}</span>
                    <span className={`font-bold text-sm ${col.title} w-16 truncate`}>{playerState.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${ACTION_BADGE[p.action]}`}>
                      {getEmoji(p.action)} {getLabel(p.action)}
                    </span>
                    {p.finalShift !== 'NONE' && (
                      <span className="text-xs text-purple-300 hidden sm:inline">⚡{fsn?.[p.finalShift]?.title ?? p.finalShift}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className={`font-mono font-bold text-sm ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.netProfit >= 0 ? '+' : ''}{formatMoney(p.netProfit)}
                      </span>
                      <span className={`text-xs font-mono ${shareDelta >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
                        {shareDelta >= 0 ? '▲' : '▼'}{Math.abs(shareDelta * 100).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 展开详情按钮 */}
          <button
            onClick={() => setShowDetailCards(v => !v)}
            className="w-full text-center text-stone-500 hover:text-stone-300 text-xs py-2 border border-stone-800/50 rounded-lg transition-all"
          >
            {showDetailCards ? '▲ 收起详细数据' : '▼ 展开各玩家详细数据'}
          </button>

          {/* 详细卡片（默认折叠，展开后单列显示） */}
          {showDetailCards && (
            <div className="space-y-2.5 animate-fade-in-up">
              {log.players.map((p, idx) => {
                const col = getPlayerColor(p.id)
                const isTopProfit = p.id === winner.id
                const shareDelta = p.newShare - p.oldShare
                const playerState = players.find(pl => pl.id === p.id)!
                return (
                  <div
                    key={p.id}
                    className={`border rounded-xl p-3 space-y-2 ${col.border} ${col.bg} ${isTopProfit ? 'ring-1 ring-yellow-500/40' : ''} animate-fade-in-up`}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {/* 头部：名字 + 动作 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${col.title}`}>{playerState.name}</span>
                        {isTopProfit && <span className="text-xs text-yellow-400">🏆</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${ACTION_BADGE[p.action]}`}>
                          {getEmoji(p.action)} {getLabel(p.action)}
                        </span>
                        {p.finalShift !== 'NONE' && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded border border-purple-700 bg-purple-900/50 text-purple-300">
                            ⚡{fsn?.[p.finalShift]?.title ?? p.finalShift}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 核心数据行 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-stone-500 text-xs">净{t?.profit ?? '利润'} </span>
                        <span className={`text-lg font-black font-mono ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.netProfit >= 0 ? '+' : ''}{formatMoney(p.netProfit)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-stone-600 text-xs">{t?.marketShare ?? '份额'} </span>
                          <span className="text-white font-mono font-bold text-sm">{formatPercent(p.newShare)}</span>
                          <span className={`text-xs font-mono ml-0.5 ${shareDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {shareDelta >= 0 ? '+' : ''}{(shareDelta * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-stone-600 text-xs">{t?.competitiveness ?? '竞争力'} </span>
                          <span className="text-white font-mono font-bold text-sm">{p.competitiveness.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 份额条 */}
                    <div className="flex items-center gap-0.5 h-1.5">
                      <div className="rounded-l bg-stone-600 h-full" style={{ width: `${Math.min(100, p.oldShare * log.players.length * 100).toFixed(0)}%`, minWidth: '2px' }} />
                      {shareDelta >= 0
                        ? <div className="rounded-r bg-green-500 h-full animate-bar-grow" style={{ width: `${Math.min(30, shareDelta * log.players.length * 100).toFixed(0)}%`, minWidth: shareDelta > 0 ? '2px' : '0' }} />
                        : <div className="rounded-r bg-red-600 h-full animate-bar-grow" style={{ width: `${Math.min(30, Math.abs(shareDelta) * log.players.length * 100).toFixed(0)}%`, minWidth: '2px' }} />
                      }
                    </div>

                    {/* 累计利润 + 计算展开 */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-700/30">
                      <div>
                        <span className="text-stone-600 text-xs">累计{t?.profit ?? '利润'} </span>
                        <span className={`font-mono font-bold text-xs ${playerState.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatMoney(playerState.cumulativeProfit)}
                        </span>
                        <span className="text-stone-700 text-xs ml-2">
                          {Math.round(p.newShare * log.global.totalCustomers).toLocaleString()} {unit}
                        </span>
                      </div>
                      <button
                        onClick={() => setExpandedFormula(expandedFormula === p.id ? null : p.id)}
                        className="text-stone-700 hover:text-stone-500 text-xs transition-all"
                      >
                        {expandedFormula === p.id ? '▲ 收起' : '▼ 计算'}
                      </button>
                    </div>

                    {expandedFormula === p.id && (() => {
                      const cups = Math.round(p.newShare * log.global.totalCustomers)
                      const marginPct = Math.round(p.margin * 100)
                      return (
                        <div className="space-y-0.5 text-xs font-mono border-t border-stone-700/30 pt-1.5 animate-fade-in">
                          <div className="text-stone-500">{cups.toLocaleString()} {unit} × ¥{p.unitPrice}{stakes !== 1 ? ` × ${stakes}倍` : ''} = <span className="text-stone-300">¥{Math.round(p.revenue).toLocaleString()}</span></div>
                          <div className="text-stone-500">× {t?.profit ?? '利润'}率 {marginPct}% = <span className="text-stone-300">¥{Math.round(p.grossProfit).toLocaleString()}</span></div>
                          {p.revenueBonus > 0 && (
                            <div className="text-stone-500">+ 品牌变现 = <span className="text-purple-300">+¥{Math.round(p.revenueBonus).toLocaleString()}</span></div>
                          )}
                          {p.actionCost > 0 && (
                            <div className="text-stone-500">− 行动成本 = <span className="text-red-400">-¥{p.actionCost.toLocaleString()}</span></div>
                          )}
                          <div className="border-t border-stone-700/30 pt-0.5 text-stone-400">
                            净{t?.profit ?? '利润'} = <span className={p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {p.netProfit >= 0 ? '+' : ''}¥{Math.round(p.netProfit).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 阶段4：叙事 ── */}
      {phase === 'NARRATE' && (
        <>
          <div className="bg-stone-900/60 border border-stone-800 rounded-xl px-3 py-2.5 text-stone-400 text-sm leading-relaxed whitespace-pre-line relative animate-fade-in-up">
            <div className="absolute top-2.5 right-2.5">
              <SpeakBtn text={narration} size="md" />
            </div>
            <div className="pr-8">{narration}</div>
          </div>

          {/* 风向 & 立誓复盘 */}
          <ForecastPledgeReport log={log} players={players} forecast={lastRoundForecast} pledges={lastRoundPledges} />

          {/* Decision Review (概念教学主题显示) */}
          {theme?.actionExplainer && <DecisionReview log={log} players={players} />}
        </>
      )}
    </div>
  )
}

// ── Decision Review ──
function DecisionReview({ log, players }: { log: RoundAuditLog; players: PlayerState[] }) {
  const theme = useGameStore(s => s.theme)
  const prevRoundPlayers = useGameStore(s => s.prevRoundPlayers)
  const [expanded, setExpanded] = useState(false)

  const an = theme?.actionNarrative
  const t = theme?.terms
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }[action] ?? action
  const profitLabel = t?.profit ?? '利润'

  const sorted = [...log.players].sort((a, b) => b.netProfit - a.netProfit)
  const topPlayer = sorted[0]
  const botPlayer = sorted[sorted.length - 1]

  const actionCounts: Record<string, number> = {}
  log.players.forEach(p => { actionCounts[p.action] = (actionCounts[p.action] ?? 0) + 1 })

  let takeaway = ''
  if (actionCounts['ATK'] && actionCounts['ATK'] >= 2) {
    takeaway = `这轮的教训：${actionCounts['ATK']}家同时降价打起了价格战，大家的利润都被摊薄了。想靠低价赢，要找别人不降价的时机。`
  } else if (actionCounts['ATK'] === 1 && topPlayer.action === 'ATK') {
    takeaway = `这轮的收获：独家降价效果最强。当你判断别人不会跟进时，降价是最有效的武器。`
  } else if (topPlayer.action === 'HOLD' && (actionCounts['ATK'] ?? 0) === 0) {
    takeaway = `这轮的收获：没人进攻时，稳定经营的利润率最高。判断局势比选择动作更重要。`
  } else if (topPlayer.action === 'QUA') {
    takeaway = `这轮的收获：研发积累开始产生回报，品质领先带来了竞争力优势。长期投资需要耐心。`
  } else if (topPlayer.action === 'MKT') {
    takeaway = `这轮的收获：品牌推广带来了流量优势。持续积累品牌热度可以在后期变现。`
  } else {
    takeaway = `每个选择都有代价和回报。关键不是选"最好的"动作，而是选"最适合当前局面"的动作。`
  }

  return (
    <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl px-3 py-2.5 space-y-2 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
      <div className="flex items-center justify-between">
        <div className="text-amber-400 font-bold text-sm">💡 本轮复盘</div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
        >
          {expanded ? '收起' : '展开详情'}
        </button>
      </div>

      <div className="text-stone-300 text-sm leading-relaxed">{takeaway}</div>

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-amber-900/40 animate-fade-in-up">
          <div className="text-stone-500 text-xs font-bold">各策略表现对比：</div>
          {Object.entries(actionCounts).map(([action, count]) => {
            const playersWithAction = log.players.filter(p => p.action === action)
            const avgProfit = playersWithAction.reduce((s, p) => s + p.netProfit, 0) / playersWithAction.length
            return (
              <div key={action} className="flex items-center gap-2 text-xs">
                <span className="font-bold text-stone-300 w-16">{getLabel(action)}</span>
                <span className="text-stone-600">{count}人</span>
                <span className="text-stone-600">→</span>
                <span className={`font-mono font-bold ${avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  均{profitLabel} {avgProfit >= 0 ? '+' : ''}¥{Math.round(avgProfit).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Forecast & Pledge Report ──
function ForecastPledgeReport({ log, players, forecast, pledges }: {
  log: RoundAuditLog
  players: PlayerState[]
  forecast?: MarketForecast | null
  pledges?: Pledge[]
}) {
  const theme = useGameStore(s => s.theme)

  const an = theme?.actionNarrative
  const getLabel = (action: string) => an?.[action as keyof typeof an]?.title ?? { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }[action] ?? action

  const actualActions = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of log.players) map[p.id] = p.action
    return map
  }, [log.players])

  const hasContent = !!forecast || (pledges && pledges.length > 0)
  if (!hasContent) return null

  return (
    <div className="bg-stone-950/50 border border-stone-800/50 rounded-xl p-3 space-y-2.5 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
      <div className="text-amber-400 font-bold text-sm">📋 风向与立誓复盘</div>

      {/* Forecast result */}
      {forecast && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-stone-500 font-bold">📡 风向</span>
            <span className="text-stone-300 font-bold">{getLabel(forecast.signal)}</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${
              forecast.isTrue ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-red-900/40 text-red-400 border border-red-800'
            }`}>
              {forecast.isTrue ? '✅ 正确 +3.0' : '❌ 偏差 -2.0'}
            </span>
          </div>
          {(() => {
            const followers = log.players.filter(p => p.action === forecast.signal)
            if (followers.length === 0) return (
              <div className="text-stone-600 text-xs">无人跟风</div>
            )
            return (
              <div className="text-xs text-stone-400 flex flex-wrap gap-x-2">
                <span className="text-stone-600">跟风：</span>
                {followers.map(f => {
                  const player = players.find(p => p.id === f.id)
                  const color = PC[f.id as keyof typeof PC]
                  return (
                    <span key={f.id} className="inline-flex items-center gap-0.5">
                      <span className={color?.text ?? ''}>{player?.name}</span>
                      <span className={forecast.isTrue ? 'text-green-400' : 'text-red-400'}>
                        {forecast.isTrue ? '+3.0' : '-2.0'}
                      </span>
                    </span>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Pledge results */}
      {pledges && pledges.length > 0 && (
        <div className="space-y-1">
          <div className="text-stone-500 text-xs font-bold">⚔ 立誓：</div>
          {pledges.map((pledge, i) => {
            const player = players.find(p => p.id === pledge.playerId)
            const color = PC[pledge.playerId as keyof typeof PC]
            const actual = actualActions[pledge.playerId]
            const kept = actual === pledge.pledgedAction
            return (
              <div key={i} className="flex items-center gap-1 text-xs flex-wrap">
                <span className={color?.text ?? 'text-stone-400'}>{player?.name}</span>
                <span className="text-stone-300">{getLabel(pledge.pledgedAction)}</span>
                <span className="text-stone-600">→</span>
                <span className="text-stone-300">{getLabel(actual)}</span>
                <span className={kept ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {kept ? '✅ +2.5' : '❌ -3.0'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
