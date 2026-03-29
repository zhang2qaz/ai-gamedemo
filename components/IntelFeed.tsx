'use client'

import { useState } from 'react'
import type { RoundIntel, IntelSource } from '@/engine/themes/types'
import { useGameStore } from '@/store/gameStore'
import SpeakBtn from './SpeakBtn'

type Props = {
  intel: RoundIntel
  truthOverrides?: boolean[]
  revealed?: boolean
}

const SOURCE_STYLE: Record<IntelSource, { badge: string; icon: string; trust: string }> = {
  '行业报告':   { badge: 'bg-blue-900/40 text-blue-300 border-blue-800',    icon: '📊', trust: '通常可靠，但滞后' },
  '竞品情报':   { badge: 'bg-red-900/40 text-red-300 border-red-800',       icon: '🕵', trust: '常被对手操控，存疑' },
  '消费者调研': { badge: 'bg-green-900/40 text-green-300 border-green-800', icon: '📋', trust: '方向正确，但样本可能有偏差' },
  '内部消息':   { badge: 'bg-orange-900/40 text-orange-300 border-orange-800', icon: '🔓', trust: '高价值高风险，可能是假' },
  '分析师预测': { badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-800', icon: '📈', trust: '关键节点频繁出错' },
  '监管动态':   { badge: 'bg-stone-700/40 text-stone-300 border-stone-600', icon: '🏛', trust: '官方来源，通常可靠' },
}

export default function IntelFeed({ intel, truthOverrides, revealed = false }: Props) {
  const theme = useGameStore(s => s.theme)
  const [expanded, setExpanded] = useState(true)
  const [revealedSources, setRevealedSources] = useState<Set<number>>(new Set())

  // 从主题获取动作标签
  const ACTION_LABEL: Record<string, string> = theme?.actionNarrative
    ? { ATK: theme.actionNarrative.ATK.title, QUA: theme.actionNarrative.QUA.title, MKT: theme.actionNarrative.MKT.title, HOLD: theme.actionNarrative.HOLD.title }
    : { ATK: '搞促销', QUA: '研发新品', MKT: '做推广', HOLD: '精细运营' }

  function toggleReveal(i: number) {
    setRevealedSources(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="bg-stone-900 border border-stone-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-stone-800/50 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-sm">📡 市场情报</span>
          <span className="text-stone-400 text-xs font-mono">第{intel.round}回合 · {intel.cards.length}条</span>
          <span className="text-stone-500 text-xs hidden lg:inline">— {intel.headline}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-600">情报可信度需自行判断</span>
          <span className="text-stone-500 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <>
        {(() => {
          const tally: Record<string, number> = {}
          intel.cards.forEach(c => { tally[c.impliedAction] = (tally[c.impliedAction] || 0) + 1 })
          const order = Object.entries(tally).sort((a, b) => b[1] - a[1])
          return (
            <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
              <span className="text-stone-600 text-xs shrink-0">本轮情报建议：</span>
              {order.map(([action, count]) => (
                <span key={action} className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-bold">
                  {ACTION_LABEL[action] ?? action} ×{count}
                </span>
              ))}
              <span className="text-stone-700 text-xs ml-auto hidden lg:inline">注意：情报真假混杂，请自行甄别</span>
            </div>
          )
        })()}
        <div className="px-4 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {intel.cards.map((card, i) => {
            const style = SOURCE_STYLE[card.source]
            const sourceRevealed = revealedSources.has(i)
            const actualIsTrue = truthOverrides?.[i] ?? card.isTrue
            return (
              <div
                key={i}
                className="bg-stone-950/60 border border-stone-800 rounded-lg p-3 space-y-2 flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold ${style.badge}`}>
                    {style.icon} {card.source}
                  </span>
                  <div className="flex items-center gap-1">
                    {card.tag && (
                      <span className="text-xs text-stone-600 font-mono">{card.tag}</span>
                    )}
                    <SpeakBtn
                      text={`${card.source}情报：${card.text}。如果你信这条情报，建议选择${ACTION_LABEL[card.impliedAction] ?? card.impliedAction}。来源可信度：${style.trust}。`}
                    />
                  </div>
                </div>

                <p className="text-stone-300 text-xs leading-relaxed flex-1">
                  {card.text}
                </p>

                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-stone-600 text-xs">信了建议选：</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                    {ACTION_LABEL[card.impliedAction] ?? card.impliedAction}
                  </span>
                </div>

                {revealed && (
                  <div className={`mt-1 text-xs font-bold ${actualIsTrue ? 'text-green-400' : 'text-red-400'}`}>
                    {actualIsTrue ? '✅ 情报属实' : '❌ 情报有误'}
                  </div>
                )}

                <button
                  onClick={() => toggleReveal(i)}
                  className="text-xs text-stone-700 hover:text-stone-500 transition-all text-left"
                >
                  {sourceRevealed
                    ? <span className="text-stone-500">来源特征：{style.trust}</span>
                    : <span>查看来源特征 →</span>
                  }
                </button>
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
