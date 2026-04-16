'use client'

import { useState, useEffect } from 'react'
import { getAllAchievements, getHistory, type GameHistoryData } from '@/lib/gameHistory'

type Props = {
  onClose: () => void
}

/**
 * 成就墙：所有成就的解锁状态
 */
export default function AchievementWall({ onClose }: Props) {
  const [history, setHistory] = useState<GameHistoryData | null>(null)

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  const all = getAllAchievements()
  const unlocked = new Set(history?.stats.achievements ?? [])
  const unlockedCount = unlocked.size

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-stone-900 border border-amber-700/40 rounded-xl w-full max-w-lg mx-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-amber-300 font-bold text-base">🏆 成就墙</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">
              {unlockedCount}/{all.length} 已解锁
            </span>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-stone-800 hover:bg-red-900/50 text-stone-400 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / all.length) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {all.map(ach => {
            const isUnlocked = unlocked.has(ach.id)
            return (
              <div
                key={ach.id}
                className={`rounded-lg p-2 border transition-all ${
                  isUnlocked
                    ? 'bg-amber-950/30 border-amber-700/50'
                    : 'bg-stone-900/50 border-stone-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                    {ach.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold ${isUnlocked ? 'text-amber-300' : 'text-stone-500'}`}>
                      {ach.name} {isUnlocked && '✓'}
                    </div>
                    <div className={`text-[10px] leading-tight mt-0.5 ${isUnlocked ? 'text-stone-400' : 'text-stone-600'}`}>
                      {ach.desc}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
