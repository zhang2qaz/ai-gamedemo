'use client'

import { useState } from 'react'
import type { BaseAction } from '@/engine/types'

type ExplainerData = {
  realWorld: string
  risk: string
  whenToUse: string
  dataPoints: string
}

type Props = {
  action: BaseAction
  actionTitle: string
  data: ExplainerData
}

export default function ActionExplainer({ action, actionTitle, data }: Props) {
  const [open, setOpen] = useState(false)

  const actionColor: Record<BaseAction, { bg: string; border: string; text: string; icon: string }> = {
    ATK: { bg: 'bg-red-950/60', border: 'border-red-800/60', text: 'text-red-300', icon: 'text-red-400' },
    QUA: { bg: 'bg-blue-950/60', border: 'border-blue-800/60', text: 'text-blue-300', icon: 'text-blue-400' },
    MKT: { bg: 'bg-yellow-950/60', border: 'border-yellow-800/60', text: 'text-yellow-300', icon: 'text-yellow-400' },
    HOLD: { bg: 'bg-stone-900/60', border: 'border-stone-700/60', text: 'text-stone-300', icon: 'text-stone-400' },
  }
  const c = actionColor[action]

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={`shrink-0 w-5 h-5 rounded-full border ${c.border} ${c.icon} text-xs font-bold flex items-center justify-center hover:scale-110 transition-transform`}
        title={`了解"${actionTitle}"的详细逻辑`}
      >
        ?
      </button>
    )
  }

  return (
    <div
      className={`mt-1 ${c.bg} border ${c.border} rounded-lg px-3 py-2.5 space-y-2 animate-fade-in-up text-xs leading-relaxed`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className={`font-bold ${c.text}`}>📖 什么是"{actionTitle}"？</span>
        <button
          onClick={() => setOpen(false)}
          className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
        >
          收起 ✕
        </button>
      </div>

      <div className="text-stone-300">
        <span className="text-stone-500 font-bold">现实中就像：</span>{data.realWorld}
      </div>

      <div className="text-stone-300">
        <span className="text-amber-500 font-bold">⚠️ 风险：</span>{data.risk}
      </div>

      <div className="text-stone-300">
        <span className="text-green-500 font-bold">💡 什么时候该用：</span>{data.whenToUse}
      </div>

      <div className="text-stone-400 font-mono">
        <span className="text-stone-500 font-bold font-sans">📊 数据：</span>{data.dataPoints}
      </div>
    </div>
  )
}
