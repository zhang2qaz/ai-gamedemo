'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { formatMoney } from '@/lib/format'

/**
 * 我的秘密目标 —— 只有自己能看到。
 * 默认折叠以防隔壁的人偷看。
 */
export default function ObjectiveCard() {
  const obj = useMultiplayerStore(s => s.myObjective)
  const [revealed, setRevealed] = useState(false)

  if (!obj) return null

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2 bg-purple-950/30 border border-purple-800/40 hover:bg-purple-900/40 transition-all animate-fade-in-up"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎭</span>
          <div className="text-left">
            <div className="text-xs font-bold text-purple-300">秘密目标</div>
            <div className="text-[10px] text-purple-400/60">点击查看（不要被人看到）</div>
          </div>
        </div>
        <span className="text-purple-400 text-xs">👁 显示</span>
      </button>
    )
  }

  return (
    <div className="rounded-xl p-3 bg-gradient-to-br from-purple-950/50 to-stone-900 border border-purple-700/50 space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{obj.emoji}</span>
          <div>
            <div className="text-xs text-purple-400/80">你的秘密目标</div>
            <div className="text-sm font-black text-purple-200">{obj.name}</div>
          </div>
        </div>
        <button
          onClick={() => setRevealed(false)}
          className="text-purple-500 hover:text-purple-300 text-xs"
        >
          隐藏
        </button>
      </div>
      <div className="text-xs text-stone-300 leading-relaxed">
        {obj.description}
      </div>
      <div className="text-[11px] text-amber-400/80 font-bold">
        🏆 达成后奖励 {formatMoney(obj.bonus)}
      </div>
    </div>
  )
}
