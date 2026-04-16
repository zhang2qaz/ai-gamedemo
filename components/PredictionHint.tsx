'use client'

import type { PredictionResult } from '@/lib/prediction'
import { formatMoney } from '@/lib/format'

type Props = {
  prediction: PredictionResult | null
}

export default function PredictionHint({ prediction }: Props) {
  if (!prediction || prediction.scenariosRun === 0) return null

  const { profitMin, profitMax, profitMedian, shareDeltaMin, shareDeltaMax, warnings } = prediction

  const profitColor =
    profitMedian >= 200000 ? 'text-green-400' :
    profitMedian >= 0 ? 'text-amber-400' : 'text-red-400'

  const shareColor =
    shareDeltaMax >= 0 && shareDeltaMin >= -0.01 ? 'text-green-400' :
    shareDeltaMax >= 0 ? 'text-amber-400' : 'text-red-400'

  const rangeSize = profitMax - profitMin
  const uncertainty =
    rangeSize > 400000 ? '波动大' :
    rangeSize > 150000 ? '中等波动' : '相对稳定'

  return (
    <div className="glass-card border-stone-700/40 rounded-xl px-3 py-2.5 space-y-2 animate-fade-in-up">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-stone-500 font-bold">📈 预计结果</span>
        <span className="text-[10px] text-stone-600">· 基于 {prediction.scenariosRun} 种对手剧本 · {uncertainty}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* 净利润区间 */}
        <div className="bg-stone-800/40 rounded-lg px-2.5 py-1.5">
          <div className="text-[10px] text-stone-500 mb-0.5">净利润</div>
          <div className={`text-sm font-black ${profitColor} tabular-nums`}>
            {formatMoney(profitMin)}
            <span className="text-stone-600 mx-1 text-xs">~</span>
            {formatMoney(profitMax)}
          </div>
        </div>

        {/* 份额变化区间 */}
        <div className="bg-stone-800/40 rounded-lg px-2.5 py-1.5">
          <div className="text-[10px] text-stone-500 mb-0.5">份额变化</div>
          <div className={`text-sm font-black ${shareColor} tabular-nums`}>
            {shareDeltaMin >= 0 ? '+' : ''}{(shareDeltaMin * 100).toFixed(1)}%
            <span className="text-stone-600 mx-1 text-xs">~</span>
            {shareDeltaMax >= 0 ? '+' : ''}{(shareDeltaMax * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-stone-800/60">
          {warnings.map((w, i) => (
            <div key={i} className="text-[11px] text-amber-400/80 flex items-start gap-1">
              <span className="shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
