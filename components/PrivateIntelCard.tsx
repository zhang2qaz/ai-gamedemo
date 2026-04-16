'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'

const ACTION_NAMES: Record<string, string> = {
  ATK: '降价/进攻', QUA: '研发/品质', MKT: '推广/营销', HOLD: '稳守',
}

const ACTION_COLOR: Record<string, string> = {
  ATK: 'text-red-300', QUA: 'text-blue-300', MKT: 'text-yellow-300', HOLD: 'text-stone-300',
}

const RELIABILITY_COLOR = {
  '高': 'text-green-400 border-green-700/50 bg-green-950/30',
  '中': 'text-amber-400 border-amber-700/50 bg-amber-950/30',
  '低': 'text-stone-400 border-stone-700/50 bg-stone-950/30',
}

/**
 * 我的私有情报 —— 只有自己能看到，与其他玩家不同。
 */
export default function PrivateIntelCard() {
  const intel = useMultiplayerStore(s => s.myPrivateIntel)
  const [revealed, setRevealed] = useState(false)

  if (!intel) return null

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2 bg-cyan-950/30 border border-cyan-800/40 hover:bg-cyan-900/40 transition-all animate-fade-in-up"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📨</span>
          <div className="text-left">
            <div className="text-xs font-bold text-cyan-300">私人线索</div>
            <div className="text-[10px] text-cyan-400/60">来自 {intel.source} · 点击查看</div>
          </div>
        </div>
        <span className="text-cyan-400 text-xs">👁 显示</span>
      </button>
    )
  }

  const stanceLabel = intel.stance === 'recommend' ? '推荐' : '警告'
  const stanceColor = intel.stance === 'recommend' ? 'text-green-400' : 'text-amber-400'
  const reliabilityCls = RELIABILITY_COLOR[intel.reliability]

  return (
    <div className="rounded-xl p-3 bg-gradient-to-br from-cyan-950/40 to-stone-900 border border-cyan-700/40 space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">📨</span>
          <span className="text-xs font-bold text-cyan-300">{intel.source}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${reliabilityCls} font-bold`}>
            可信度{intel.reliability}
          </span>
        </div>
        <button
          onClick={() => setRevealed(false)}
          className="text-cyan-500 hover:text-cyan-300 text-xs"
        >
          隐藏
        </button>
      </div>

      <div className="text-xs text-stone-300 leading-relaxed">
        {intel.text}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-cyan-800/40">
        <span className={`text-[10px] font-bold ${stanceColor}`}>
          {stanceLabel}：
        </span>
        <span className={`text-xs font-bold ${ACTION_COLOR[intel.hintAction]}`}>
          {ACTION_NAMES[intel.hintAction]}
        </span>
        <span className="text-[10px] text-stone-600 ml-auto">
          ⚠ 仅你可见 · 真假需自行判断
        </span>
      </div>
    </div>
  )
}
