'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { formatPercent, formatMoney } from '@/lib/format'

/**
 * 终局 PvE 结果：联军胜 / 巨头胜
 */
export default function PveOutcome() {
  const pveMode = useMultiplayerStore(s => s.pveMode)
  const bossId = useMultiplayerStore(s => s.bossId)
  const players = useMultiplayerStore(s => s.players)

  if (!pveMode || !bossId) return null

  const boss = players.find(p => p.id === bossId)
  if (!boss) return null

  // 胜利条件：把巨头压制到 30% 以下
  const humansWin = boss.marketShare < 0.30
  const humans = players.filter(p => p.id !== bossId)
  const totalHumanProfit = humans.reduce((s, p) => s + p.cumulativeProfit, 0)

  return (
    <div className={`rounded-2xl p-5 text-center space-y-3 animate-fade-in-up border-2 ${
      humansWin
        ? 'border-green-600/60 bg-gradient-to-br from-green-950/40 to-emerald-950/30'
        : 'border-red-700/60 bg-gradient-to-br from-red-950/40 to-stone-950'
    }`}>
      <div className="text-5xl">
        {humansWin ? '🎉' : '💀'}
      </div>
      <div className={`text-2xl font-black ${humansWin ? 'text-green-300' : 'text-red-300'}`}>
        {humansWin ? '联军胜利！' : '巨头碾压'}
      </div>
      <div className="text-sm text-stone-400">
        {humansWin
          ? `成功把巨头压制到 ${formatPercent(boss.marketShare)}（< 30%），全员通关 🏆`
          : `巨头守住了 ${formatPercent(boss.marketShare)} 的份额，下次再来`
        }
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-stone-700/40">
        <div>
          <div className="text-stone-500">巨头最终份额</div>
          <div className={`font-bold text-lg ${humansWin ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(boss.marketShare)}
          </div>
        </div>
        <div>
          <div className="text-stone-500">联军总利润</div>
          <div className="font-bold text-lg text-amber-400">
            {formatMoney(totalHumanProfit)}
          </div>
        </div>
      </div>
    </div>
  )
}
