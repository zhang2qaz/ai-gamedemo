'use client'

import type { GlobalState } from '@/engine/types'
import { getSignalForRound } from '@/engine/events'
import { formatPercent } from '@/lib/format'

type Props = {
  global: GlobalState
  onSubmit: () => void
  canSubmit: boolean
  phase: string
}

export default function GlobalPanel({ global, onSubmit, canSubmit, phase }: Props) {
  const signal = getSignalForRound(global.eventQueue, global.roundNumber)
  const isSubmitting = phase === 'SUBMITTING'

  return (
    <div className="bg-stone-900 border border-amber-800/50 rounded-lg p-4 space-y-4">
      <div className="text-amber-400 font-bold text-sm uppercase tracking-widest border-b border-amber-800/50 pb-2">
        市场态势
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-400">总顾客数</span>
          <span className="text-white font-mono">{global.totalCustomers.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">价格敏感度</span>
          <span className="text-white font-mono">{formatPercent(global.priceSensitivity)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">品质权重</span>
          <span className="text-white font-mono">{formatPercent(global.qualityWeight)}</span>
        </div>
      </div>

      {signal && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded p-3 text-amber-300 text-xs leading-relaxed">
          {signal}
        </div>
      )}

      {isSubmitting && (
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded font-bold text-sm uppercase tracking-widest transition-all ${
            canSubmit
              ? 'bg-amber-600 hover:bg-amber-500 text-black cursor-pointer'
              : 'bg-stone-700 text-stone-500 cursor-not-allowed'
          }`}
        >
          {canSubmit ? '⚔ 同时亮牌 · 结算' : '等待所有玩家选择...'}
        </button>
      )}
    </div>
  )
}
