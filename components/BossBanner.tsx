'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { formatPercent } from '@/lib/format'

/**
 * PvE 模式横幅：突出显示巨头当前份额，强化"共同的敌人"感。
 */
export default function BossBanner() {
  const pveMode = useMultiplayerStore(s => s.pveMode)
  const bossId = useMultiplayerStore(s => s.bossId)
  const players = useMultiplayerStore(s => s.players)

  if (!pveMode || !bossId) return null

  const boss = players.find(p => p.id === bossId)
  if (!boss) return null

  const humansShare = players
    .filter(p => p.id !== bossId)
    .reduce((s, p) => s + p.marketShare, 0)
  const losing = boss.marketShare > humansShare * 0.6  // 巨头领先太多 = 联军吃紧

  return (
    <div className={`glass-card rounded-xl px-4 py-2.5 border-2 ${
      losing ? 'border-red-700/60 bg-red-950/20' : 'border-amber-700/40 bg-amber-950/10'
    } animate-fade-in-up`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦖</span>
          <div>
            <div className="text-xs text-red-400 font-bold">巨头 · {boss.name.replace('🦖 巨头 ', '')}</div>
            <div className="text-[10px] text-stone-500">
              全体玩家须联手将其压制至 30% 以下
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black tabular-nums ${
            boss.marketShare >= 0.5 ? 'text-red-400' :
            boss.marketShare >= 0.35 ? 'text-amber-400' : 'text-green-400'
          }`}>
            {formatPercent(boss.marketShare)}
          </div>
          <div className="text-[10px] text-stone-600">巨头份额</div>
        </div>
      </div>
      {/* 巨头份额条 */}
      <div className="mt-2 w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            boss.marketShare >= 0.5 ? 'bg-red-500' :
            boss.marketShare >= 0.35 ? 'bg-amber-500' : 'bg-green-500'
          }`}
          style={{ width: `${boss.marketShare * 100}%` }}
        />
        {/* 30% 阈值标记 */}
        <div className="relative" style={{ marginTop: '-6px', marginLeft: '30%' }}>
          <div className="w-px h-3 bg-stone-500" />
        </div>
      </div>
      <div className="text-[10px] text-stone-600 text-right mt-0.5">阈值 30%</div>
    </div>
  )
}
