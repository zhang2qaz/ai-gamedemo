'use client'

import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { MarketForecast } from '@/engine/types'
import SpeakBtn from './SpeakBtn'

type Props = {
  forecast: MarketForecast
  revealed?: boolean
}

export default function ForecastBanner({ forecast, revealed = false }: Props) {
  const theme = useGameStore(s => s.theme)
  const [expanded, setExpanded] = useState(false)

  const ACTION_LABEL: Record<string, string> = theme?.actionNarrative
    ? { ATK: theme.actionNarrative.ATK.title, QUA: theme.actionNarrative.QUA.title, MKT: theme.actionNarrative.MKT.title, HOLD: theme.actionNarrative.HOLD.title }
    : { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }

  return (
    <div className="bg-stone-900 border border-stone-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-2 hover:bg-stone-800/50 transition-all cursor-pointer"
      >
        {/* 移动端：两行布局 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-cyan-400 font-bold text-sm shrink-0">📡 风向</span>
            <span className="text-stone-300 text-xs font-bold shrink-0">
              推荐：{ACTION_LABEL[forecast.signal]}
            </span>
            {revealed && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                forecast.isTrue ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-red-900/40 text-red-400 border border-red-800'
              }`}>
                {forecast.isTrue ? '✅ 正确' : '❌ 偏差'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <SpeakBtn text={`市场风向：${forecast.headline}。推荐行动：${ACTION_LABEL[forecast.signal]}。`} />
            <span className="text-stone-500 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          <div className="text-stone-300 text-sm font-bold">{forecast.headline}</div>
          <p className="text-stone-400 text-xs leading-relaxed">{forecast.detail}</p>
          {revealed && (
            <div className={`text-xs font-bold ${forecast.isTrue ? 'text-green-400' : 'text-red-400'}`}>
              {forecast.isTrue
                ? '✅ 风向正确 — 跟风 +3.0 竞争力'
                : '❌ 风向偏差 — 跟风 -2.0 竞争力'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
