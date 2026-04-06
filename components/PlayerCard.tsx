'use client'

import { useState, useMemo } from 'react'
import type { PlayerState, BaseAction, FinalShift } from '@/engine/types'
import { formatMoney, formatPercent } from '@/lib/format'
import { canQualityConvert, canBrandMonetize, calcAtkBonus, calcMktBonus, calcQualityBonus, getActionCost, getUnitPrice } from '@/engine/helpers'
import { CONFIG } from '@/engine/constants'
import { useGameStore } from '@/store/gameStore'
import SpeakBtn from './SpeakBtn'

type Props = {
  player: PlayerState
  rank: number
  selectedAction: BaseAction | null
  selectedFinalShift: FinalShift
  isFinalRound: boolean
  isSubmitting: boolean
  qualityWeight: number
  priceSensitivity: number
  onSelectAction: (action: BaseAction) => void
  onSelectFinalShift: (shift: FinalShift) => void
  onClearAction: () => void
}

import { PLAYER_COLORS as PC_ALL } from '@/lib/playerColors'
const PLAYER_ACCENT: Record<string, { border: string; bg: string; title: string; fill: string }> = Object.fromEntries(
  Object.entries(PC_ALL).map(([id, c]) => [id, { border: c.border, bg: c.bg, title: c.text, fill: c.fill }])
)

type ActionDef = {
  id: BaseAction
  emoji: string
  label: string
  cost: string
  effect: string
  speakText: string
  selectedBg: string
  selectedText: string
  selectedBorder: string
  hoverBg: string
  dimBorder: string
}

const RANK_BADGE: Record<number, string> = {
  1: 'bg-yellow-400 text-black',
  2: 'bg-stone-400 text-black',
  3: 'bg-amber-700 text-white',
  4: 'bg-stone-800 text-stone-500',
}

// ── 简易预估函数（不需完整结算，给个大致方向） ──
function estimateImpact(
  action: BaseAction,
  player: PlayerState,
  priceSensitivity: number,
  qualityWeight: number,
  isFinalRound: boolean,
  cfg: typeof CONFIG = CONFIG,
): { profitHint: string; shareHint: string; riskLevel: 'low' | 'mid' | 'high' } {
  const qualityBonus = calcQualityBonus(player.qualityScore, qualityWeight)
  const baseComp = cfg.baseCompetitiveness + qualityBonus

  let actionBonus = 0
  let cost = getActionCost(action, cfg)
  let price = getUnitPrice(action, cfg)
  let riskLevel: 'low' | 'mid' | 'high' = 'low'

  switch (action) {
    case 'ATK':
      // Assume 1 other ATK player
      actionBonus = calcAtkBonus(priceSensitivity, 1, player.fatigueIndex, player.lastAction, cfg)
      riskLevel = player.fatigueIndex >= 2 ? 'high' : player.lastAction === 'ATK' ? 'mid' : 'low'
      break
    case 'MKT':
      actionBonus = calcMktBonus(1, player.brandHeat, cfg)
      riskLevel = 'mid'
      break
    case 'QUA':
      actionBonus = isFinalRound ? cfg.qualityBurstBase + cfg.qualityBurstPerCharge * player.qualityCharge : cfg.qualitySignalBonus
      riskLevel = isFinalRound && player.qualityCharge >= 2 ? 'low' : 'mid'
      break
    case 'HOLD':
      actionBonus = 0
      riskLevel = 'low'
      break
  }

  const comp = baseComp + actionBonus
  // Rough share estimate (assume 4 players with avg competitiveness 13)
  const avgOther = 13
  const estShare = comp / (comp + avgOther * 3)
  const shareDelta = estShare - player.marketShare

  // Rough profit
  const margin = action === 'ATK' ? cfg.discountMargin : cfg.normalMargin
  const revenue = 100000 * estShare * price
  const profit = revenue * margin - cost

  const profitHint = profit >= 50000
    ? `预计盈利 ~${formatMoney(Math.round(profit / 10000) * 10000)}`
    : profit >= 0
    ? `预计小额盈利`
    : `预计亏损 ~${formatMoney(Math.round(Math.abs(profit) / 10000) * 10000)}`

  const shareHint = shareDelta > 0.02
    ? `份额可能 ▲${(shareDelta * 100).toFixed(0)}%`
    : shareDelta < -0.02
    ? `份额可能 ▼${(Math.abs(shareDelta) * 100).toFixed(0)}%`
    : '份额基本持平'

  return { profitHint, shareHint, riskLevel }
}

export default function PlayerCard({
  player, rank, selectedAction, selectedFinalShift,
  isFinalRound, isSubmitting, qualityWeight, priceSensitivity,
  onSelectAction, onSelectFinalShift, onClearAction,
}: Props) {
  const theme = useGameStore(s => s.theme)
  const acc = PLAYER_ACCENT[player.id]
  const company = theme?.companies.find(c => c.id === player.id)
  const hasSubmitted = selectedAction !== null
  const t = theme?.terms

  // ── 本地预选状态（确认前不写入 store） ──
  const [pendingAction, setPendingAction] = useState<BaseAction | null>(null)
  const [pendingShift, setPendingShift] = useState<FinalShift>('NONE')

  // Config overrides from theme
  const cfg = useMemo(() => theme?.configOverrides ? { ...CONFIG, ...theme.configOverrides } : CONFIG, [theme])

  // 动作预估
  const impact = useMemo(() => {
    if (!pendingAction) return null
    return estimateImpact(pendingAction, player, priceSensitivity, qualityWeight, isFinalRound, cfg)
  }, [pendingAction, player, priceSensitivity, qualityWeight, isFinalRound, cfg])

  function handleConfirm() {
    if (!pendingAction) return
    onSelectAction(pendingAction)
    if (isFinalRound) {
      onSelectFinalShift(pendingShift)
    }
    setPendingAction(null)
    setPendingShift('NONE')
  }

  function handleCancel() {
    setPendingAction(null)
    setPendingShift('NONE')
  }

  // 动态构建 ACTION_DEFS（基于主题）
  const an = theme?.actionNarrative
  const ac = theme?.actionCards
  const ACTION_DEFS: ActionDef[] = [
    {
      id: 'ATK', emoji: ac?.ATK.emoji ?? '⚔', label: an?.ATK.title ?? '搞促销',
      cost: ac?.ATK.cost ?? `单价降至¥${cfg.discountPrice}`,
      effect: an?.ATK.risk ?? '',
      speakText: `${an?.ATK.title ?? '搞促销'}：${an?.ATK.desc ?? ''} 注意：${an?.ATK.risk ?? ''}`,
      selectedBg: 'bg-red-700', selectedText: 'text-white', selectedBorder: 'border-red-400',
      hoverBg: 'hover:bg-red-950/50', dimBorder: 'border-red-900',
    },
    {
      id: 'QUA', emoji: ac?.QUA.emoji ?? '🔬', label: an?.QUA.title ?? '研发新品',
      cost: ac?.QUA.cost ?? `本季花¥${(cfg.qualityInvestCost / 10000).toFixed(0)}万`,
      effect: an?.QUA.risk ?? '',
      speakText: `${an?.QUA.title ?? '研发新品'}：${an?.QUA.desc ?? ''} 注意：${an?.QUA.risk ?? ''}`,
      selectedBg: 'bg-blue-700', selectedText: 'text-white', selectedBorder: 'border-blue-400',
      hoverBg: 'hover:bg-blue-950/50', dimBorder: 'border-blue-900',
    },
    {
      id: 'MKT', emoji: ac?.MKT.emoji ?? '📣', label: an?.MKT.title ?? '做推广',
      cost: ac?.MKT.cost ?? `本季花¥${(cfg.marketingCost / 10000).toFixed(0)}万`,
      effect: an?.MKT.risk ?? '',
      speakText: `${an?.MKT.title ?? '做推广'}：${an?.MKT.desc ?? ''} 注意：${an?.MKT.risk ?? ''}`,
      selectedBg: 'bg-yellow-600', selectedText: 'text-black', selectedBorder: 'border-yellow-300',
      hoverBg: 'hover:bg-yellow-950/50', dimBorder: 'border-yellow-900',
    },
    {
      id: 'HOLD', emoji: ac?.HOLD.emoji ?? '🛡', label: an?.HOLD.title ?? '精细运营',
      cost: ac?.HOLD.cost ?? `单价¥${cfg.normalPrice}`,
      effect: an?.HOLD.risk ?? '',
      speakText: `${an?.HOLD.title ?? '精细运营'}：${an?.HOLD.desc ?? ''} 注意：${an?.HOLD.risk ?? ''}`,
      selectedBg: 'bg-stone-600', selectedText: 'text-white', selectedBorder: 'border-stone-400',
      hoverBg: 'hover:bg-stone-800/60', dimBorder: 'border-stone-800',
    },
  ]

  return (
    <div className={`border-2 rounded-xl flex flex-col transition-all ${acc.border} ${acc.bg} ${hasSubmitted ? 'ring-2 ring-green-500/20' : ''}`}>

      {/* ── 玩家头 ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-base font-black leading-tight ${acc.title}`}>{player.name}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${RANK_BADGE[rank] || RANK_BADGE[4]}`}>#{rank}</span>
          </div>
          {hasSubmitted
            ? <span className="text-xs text-green-400 font-bold">🔒 已锁定</span>
            : player.lastAction && <span className="text-xs text-stone-600 font-mono">上:{player.lastAction}</span>
          }
        </div>
        <div className={`text-xs mt-0.5 ${acc.title} opacity-40 italic`}>{company?.slogan ?? ''}</div>
      </div>

      {/* ── 核心数据 ── */}
      <div className="px-3 pb-3 space-y-2">
        <div>
          <div className="text-stone-600 text-xs">{t?.cumulativeProfit ?? '累计利润'}</div>
          <div className={`text-xl font-black font-mono leading-tight ${player.cumulativeProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(player.cumulativeProfit)}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-stone-600 text-xs">{t?.marketShare ?? '市场份额'}</span>
            <span className="text-white text-xs font-bold font-mono">{formatPercent(player.marketShare)}</span>
          </div>
          <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div className={`h-full ${acc.fill} rounded-full transition-all`} style={{ width: `${Math.min(100, player.marketShare * 400).toFixed(1)}%` }} />
          </div>
        </div>

        {/* ── 状态指标 ── */}
        <div className="space-y-1 pt-0.5">
          <div className="grid grid-cols-2 gap-1">
            <StatusCell
              label={t?.qualityScore ?? '产品实力'}
              value={player.qualityScore > 70 ? `${player.qualityScore} ↑` : `${player.qualityScore}`}
              sub={player.qualityScore > 70 ? (t?.qualityHigh ?? '研发积累中') : (t?.qualityNormal ?? '基准水平')}
              status={player.qualityScore > 80 ? 'good' : player.qualityScore > 70 ? 'building' : 'neutral'}
            />
            <StatusCell
              label={t?.brandHeat ?? '品牌热度'}
              value={player.brandHeat >= 70 ? '🔓 已达标' : `${player.brandHeat}/70`}
              sub={player.brandHeat >= 70 ? (t?.brandHeatUnlock ?? '终局可变现') : player.brandHeat >= 50 ? (t?.brandHeatBuilding ?? '推广有加成') : (t?.brandHeatLow ?? '继续推广积累')}
              status={player.brandHeat >= 70 ? 'unlock' : player.brandHeat >= 50 ? 'building' : 'neutral'}
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <StatusCell
              label={t?.newProductReserve ?? '新品储备'}
              value={player.qualityCharge > 0 ? `${player.qualityCharge}款` : '无'}
              sub={player.qualityCharge > 0 ? (t?.reserveHas ?? '终局可一键爆发') : (t?.reserveNone ?? '研发可积累')}
              status={player.qualityCharge >= 2 ? 'good' : player.qualityCharge > 0 ? 'building' : 'neutral'}
            />
            <StatusCell
              label={t?.freshness ?? '顾客新鲜感'}
              value={(['正常', '轻疲劳', '疲劳', '极疲劳'])[Math.min(player.fatigueIndex, 3)]}
              sub={player.fatigueIndex >= 2 ? (t?.freshDanger ?? '促销效果大减') : player.fatigueIndex === 1 ? (t?.freshWarn ?? '再促销会受罚') : (t?.freshNormal ?? '促销满效')}
              status={player.fatigueIndex >= 2 ? 'danger' : player.fatigueIndex === 1 ? 'warn' : 'neutral'}
            />
          </div>
          {(player.consecutiveHoldCount >= 2 || player.marketMomentum > 1) && (
            <div className="grid grid-cols-2 gap-1">
              {player.consecutiveHoldCount >= 2 && (
                <StatusCell label="守盘惰性" value={`守了${player.consecutiveHoldCount}季`} sub={t?.holdPenalty ?? '利润率已下降'} status="danger" />
              )}
              {player.marketMomentum > 1 && (
                <StatusCell label="营销动能" value="发酵中" sub={t?.momentum ?? '额外份额加成'} status="good" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 动作选择 ── */}
      {isSubmitting && (
        hasSubmitted ? (
          <div className="border-t border-stone-700/50 px-3 py-4 flex-1 flex flex-col items-center justify-center gap-3 animate-fade-in-up">
            <div className="text-4xl animate-slide-in-scale">🔒</div>
            <div className="text-green-400 font-bold text-sm tracking-wide animate-fade-in-up" style={{ animationDelay: '200ms' }}>决策已封存</div>
            <div className="text-stone-600 text-xs text-center leading-relaxed animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              等待其他玩家完成选择<br/>亮牌时同步揭晓
            </div>
            <button
              onClick={onClearAction}
              className="mt-1 text-xs text-stone-700 hover:text-stone-400 border border-stone-800 hover:border-stone-600 px-3 py-1 rounded-lg transition-all animate-fade-in-up"
              style={{ animationDelay: '600ms' }}
            >
              重新选择
            </button>
          </div>
        ) : (
          <div className="border-t border-stone-700/50 px-3 py-3 space-y-1.5 flex-1">
            <div className="text-stone-600 text-xs font-bold uppercase tracking-wider mb-2">
              {pendingAction ? '已预选，点击下方确认' : '选择动作'}
            </div>
            {ACTION_DEFS.map(def => {
              const isPending = pendingAction === def.id

              if (isFinalRound && def.id === 'QUA') {
                const burstPwr = cfg.qualityBurstBase + cfg.qualityBurstPerCharge * player.qualityCharge
                const hasCharge = player.qualityCharge > 0
                const burstLabel = theme?.finalShiftNarrative.QUALITY_CONVERT.title ?? '新品爆发'
                const speakBurst = hasCharge
                  ? `${burstLabel}：花八万元立即释放${player.qualityCharge}款储备，竞争力加${burstPwr}。`
                  : `${burstLabel}：花八万元获得竞争力加四，你目前没有储备，效果有限。`
                return (
                  <button
                    key="QUA_BURST"
                    onClick={() => setPendingAction('QUA')}
                    className={`w-full rounded-lg border-2 text-left transition-all duration-200 cursor-pointer ${
                      isPending
                        ? 'border-sky-400 bg-sky-900/60 text-white ring-2 ring-sky-400/30 scale-[1.01]'
                        : 'border-sky-700 bg-stone-900/40 text-stone-300 hover:bg-sky-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                      <span className="text-sm shrink-0">💥</span>
                      <span className="font-bold text-xs whitespace-nowrap flex-1 text-sky-300">{burstLabel}</span>
                      {isPending && <span className="text-xs text-sky-300 font-bold">✓ 预选</span>}
                      <SpeakBtn text={speakBurst} />
                    </div>
                    <div className="px-2 pb-1.5 text-stone-500 text-xs leading-snug">
                      {hasCharge
                        ? `花¥${cfg.qualityInvestCost / 10000}万 · 一次推出${player.qualityCharge}款储备新品，实力大增`
                        : `花¥${cfg.qualityInvestCost / 10000}万 · 没有储备，效果有限`
                      }
                    </div>
                  </button>
                )
              }
              return (
                <button
                  key={def.id}
                  onClick={() => setPendingAction(def.id)}
                  className={`w-full rounded-lg border-2 text-left transition-all duration-200 cursor-pointer ${
                    isPending
                      ? `${def.selectedBorder} ${def.selectedBg} ${def.selectedText} ring-2 ring-white/10 scale-[1.01]`
                      : `${def.dimBorder} bg-stone-900/40 text-stone-300 ${def.hoverBg}`
                  }`}
                >
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                    <span className="text-sm shrink-0">{def.emoji}</span>
                    <span className="font-bold text-xs whitespace-nowrap flex-1">{def.label}</span>
                    {isPending && <span className="text-xs font-bold opacity-80">✓ 预选</span>}
                    <SpeakBtn text={def.speakText} />
                  </div>
                  <div className={`px-2 pb-1.5 text-xs leading-snug ${isPending ? 'opacity-70' : 'text-stone-600'}`}>{def.cost}</div>
                </button>
              )
            })}

            {/* ── 动作预估面板 ── */}
            {pendingAction && impact && (
              <div className="bg-stone-950/80 border border-stone-700/50 rounded-lg px-3 py-2 animate-fade-in-up space-y-1">
                <div className="text-stone-500 text-xs font-bold">📊 预估影响</div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-stone-600 text-xs">利润：</span>
                    <span className={`text-xs font-bold ${impact.profitHint.includes('亏') ? 'text-red-400' : 'text-green-400'}`}>
                      {impact.profitHint}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-600 text-xs">份额：</span>
                    <span className={`text-xs font-bold ${impact.shareHint.includes('▼') ? 'text-red-400' : impact.shareHint.includes('▲') ? 'text-green-400' : 'text-stone-400'}`}>
                      {impact.shareHint}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-stone-600 text-xs">风险：</span>
                  <span className={`text-xs font-bold ${
                    impact.riskLevel === 'high' ? 'text-red-400' : impact.riskLevel === 'mid' ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {impact.riskLevel === 'high' ? '⚠ 高风险' : impact.riskLevel === 'mid' ? '⚡ 中风险' : '✓ 低风险'}
                  </span>
                  <span className="text-stone-700 text-xs ml-1">
                    {pendingAction === 'ATK' && player.fatigueIndex >= 1 ? '(连续促销有疲劳惩罚)' :
                     pendingAction === 'QUA' && !isFinalRound ? '(下回合才生效)' :
                     pendingAction === 'MKT' ? '(长线策略，需持续投入)' :
                     pendingAction === 'HOLD' ? '(无成本但可能被对手超越)' : ''}
                  </span>
                </div>
              </div>
            )}

            {isFinalRound && pendingAction && (
              <FinalShiftSection
                player={player}
                selectedAction={pendingAction}
                selectedFinalShift={pendingShift}
                onSelect={setPendingShift}
              />
            )}

            {pendingAction && (
              <div className="pt-2 space-y-2 animate-fade-in-up">
                <button
                  onClick={handleConfirm}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl text-sm uppercase tracking-wider transition-all active:scale-95"
                >
                  ✓ 确认选择
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full py-2 text-stone-600 hover:text-stone-400 text-xs transition-all"
                >
                  取消，重新看看
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

function FinalShiftSection({ player, selectedAction, selectedFinalShift, onSelect }: {
  player: PlayerState
  selectedAction: BaseAction | null
  selectedFinalShift: FinalShift
  onSelect: (s: FinalShift) => void
}) {
  const theme = useGameStore(s => s.theme)
  const fsn = theme?.finalShiftNarrative

  const brandLabel = theme?.terms?.brandHeat ?? '品牌热度'
  const brandThreshold = theme?.configOverrides?.brandHeatThresholdForMonetize ?? 70
  const opts: Array<{ value: FinalShift; emoji: string; label: string; available: boolean; hint: string; desc: string; speakText: string }> = [
    {
      value: 'NONE', emoji: '—', label: fsn?.NONE.title ?? '不附加', available: true, hint: '',
      desc: fsn?.NONE.desc ?? '最后一轮正常比赛，不做额外操作',
      speakText: `不附加：${fsn?.NONE.desc ?? '最后一轮正常比赛，不做额外操作'}`,
    },
    {
      value: 'FINAL_PUSH', emoji: '🚀', label: fsn?.FINAL_PUSH.title ?? '全力冲刺', available: true,
      hint: '全力出击，利润打八折',
      desc: fsn?.FINAL_PUSH.desc ?? '不惜代价抢客流（利润打八折）',
      speakText: `${fsn?.FINAL_PUSH.title ?? '全力冲刺'}：${fsn?.FINAL_PUSH.desc ?? '不惜代价抢客流，利润打八折'}`,
    },
    {
      value: 'QUALITY_CONVERT', emoji: '💎', label: fsn?.QUALITY_CONVERT.title ?? '新品总爆发',
      available: canQualityConvert(player),
      hint: player.qualityCharge > 0 ? `${player.qualityCharge}款储备齐发，实力大增` : '需先积累储备才可用',
      desc: fsn?.QUALITY_CONVERT.desc ?? '一次性推出所有储备，碾压对手',
      speakText: canQualityConvert(player)
        ? `${fsn?.QUALITY_CONVERT.title ?? '新品总爆发'}：你有${player.qualityCharge}款储备，一次性全部推出，实力大增。`
        : `${fsn?.QUALITY_CONVERT.title ?? '新品总爆发'}：你目前没有储备，无法使用。`,
    },
    {
      value: 'DEFENSIVE_LOCK', emoji: '🔒', label: fsn?.DEFENSIVE_LOCK.title ?? '会员锁客',
      available: selectedAction === 'HOLD',
      hint: selectedAction === 'HOLD' ? '锁住老客户不被抢走' : '需本季选守势才能使用',
      desc: fsn?.DEFENSIVE_LOCK.desc ?? '锁住老客户不被对手抢走',
      speakText: `${fsn?.DEFENSIVE_LOCK.title ?? '会员锁客'}：${fsn?.DEFENSIVE_LOCK.desc ?? '锁住老客户不被对手抢走'}`,
    },
    {
      value: 'BRAND_MONETIZE', emoji: '💰', label: fsn?.BRAND_MONETIZE.title ?? '签约代言人',
      available: canBrandMonetize(player),
      hint: player.brandHeat >= brandThreshold ? `${brandLabel}${player.brandHeat}分，已达标可变现` : `${brandLabel}${player.brandHeat}/${brandThreshold}，还差${brandThreshold - player.brandHeat}分`,
      desc: fsn?.BRAND_MONETIZE.desc ?? '品牌热度够高时变现影响力',
      speakText: canBrandMonetize(player)
        ? `${fsn?.BRAND_MONETIZE.title ?? '签约代言人'}：${brandLabel}${player.brandHeat}分，已达标，可以变现。`
        : `${fsn?.BRAND_MONETIZE.title ?? '签约代言人'}：${brandLabel}${player.brandHeat}分，还差${brandThreshold - player.brandHeat}分才能使用。`,
    },
  ]

  return (
    <div className="pt-1 space-y-1 border-t border-stone-700/40 animate-fade-in-up">
      <div className="text-purple-500 text-xs font-bold uppercase tracking-wider">⚡ 终盘附加动作</div>
      {opts.map(opt => {
        const isSelected = selectedFinalShift === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => opt.available && onSelect(opt.value)}
            disabled={!opt.available}
            className={`w-full flex flex-col px-2.5 py-1.5 rounded-lg border text-xs text-left transition-all duration-200 ${
              !opt.available
                ? 'border-stone-800 text-stone-700 cursor-not-allowed opacity-50'
                : isSelected
                ? 'border-purple-400 bg-purple-900/50 text-white cursor-pointer scale-[1.01]'
                : 'border-stone-700 text-stone-400 hover:border-purple-700 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <span className="shrink-0">{opt.emoji}</span>
              <span className="font-bold shrink-0">{opt.label}</span>
              {opt.hint && <span className={`text-xs ml-auto ${isSelected ? 'text-purple-300' : opt.available ? 'text-stone-500' : 'text-stone-700'}`}>{opt.hint}</span>}
              <SpeakBtn text={opt.speakText} />
            </div>
            {opt.desc && (
              <div className={`mt-0.5 leading-snug ${!opt.available ? 'text-stone-700' : isSelected ? 'text-stone-300' : 'text-stone-600'}`}>
                {opt.desc}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

type StatusLevel = 'neutral' | 'good' | 'warn' | 'danger' | 'unlock' | 'building'

function StatusCell({ label, value, sub, status = 'neutral' }: {
  label: string
  value: string
  sub?: string
  status?: StatusLevel
}) {
  const valueColor: Record<StatusLevel, string> = {
    neutral: 'text-stone-400',
    good: 'text-green-400',
    warn: 'text-yellow-400',
    danger: 'text-red-400',
    unlock: 'text-purple-400',
    building: 'text-sky-400',
  }
  const bg: Record<StatusLevel, string> = {
    neutral: 'bg-stone-900/60',
    good: 'bg-green-950/40',
    warn: 'bg-yellow-950/40',
    danger: 'bg-red-950/40',
    unlock: 'bg-purple-950/40',
    building: 'bg-sky-950/30',
  }

  return (
    <div className={`rounded px-2 py-1.5 ${bg[status]} transition-colors duration-300`}>
      <div className="text-stone-500 text-xs leading-none mb-1">{label}</div>
      <div className={`font-mono font-bold text-sm leading-none ${valueColor[status]}`}>{value}</div>
      {sub && <div className={`text-xs leading-none mt-1 opacity-60 ${valueColor[status]}`}>{sub}</div>}
    </div>
  )
}
