'use client'

import { useState, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { generateInsights, type CoachInsight } from '@/engine/coach'

const CATEGORY_ICON: Record<string, string> = {
  share: '📊',
  profit: '💰',
  action: '⚔️',
  strategy: '🧠',
  mechanic: '⚙️',
}

const CATEGORY_COLOR: Record<string, string> = {
  share: 'border-sky-800 bg-sky-950/30',
  profit: 'border-green-800 bg-green-950/30',
  action: 'border-red-800 bg-red-950/30',
  strategy: 'border-purple-800 bg-purple-950/30',
  mechanic: 'border-stone-700 bg-stone-900/60',
}

export default function CoachPanel() {
  const [open, setOpen] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const auditLogs = useGameStore(s => s.auditLogs)
  const players = useGameStore(s => s.players)
  const theme = useGameStore(s => s.theme)
  const phase = useGameStore(s => s.phase)

  const insights = useMemo(
    () => generateInsights(auditLogs, players, theme),
    [auditLogs, players, theme]
  )

  // 主题选择阶段不显示
  if (phase === 'THEME_SELECT') return null

  const hasLogs = auditLogs.length > 0

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all ${
          open
            ? 'bg-amber-500 text-black scale-110 ring-4 ring-amber-500/30'
            : 'bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-600 hover:border-amber-600'
        }`}
        title="教练问答"
      >
        {open ? '✕' : '?'}
      </button>

      {/* 面板 */}
      {open && (
        <div className="fixed bottom-20 left-6 z-40 w-[420px] max-h-[70vh] bg-stone-950 border border-amber-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-800 bg-stone-900/80 shrink-0">
            <div className="text-amber-400 font-bold text-sm">教练问答</div>
            <div className="text-stone-600 text-xs mt-0.5">
              {hasLogs ? '基于本局数据，解读每轮决策背后的逻辑' : '完成第一回合后，这里会出现数据分析'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!hasLogs ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-3xl">📖</div>
                <div className="text-stone-500 text-sm">完成首轮后即可查看分析</div>
                <div className="text-stone-700 text-xs leading-relaxed max-w-xs mx-auto">
                  每轮结算后，教练会自动分析：<br />
                  · 为何同样动作不同结果<br />
                  · 促销/推广的稀释效应<br />
                  · 份额变化的真正原因<br />
                  · 利润差距来源拆解
                </div>
              </div>
            ) : insights.length === 0 ? (
              <div className="text-center py-8 text-stone-600 text-sm">暂无分析</div>
            ) : (
              insights.map((insight, i) => (
                <InsightCard
                  key={i}
                  insight={insight}
                  expanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}

function InsightCard({ insight, expanded, onToggle }: {
  insight: CoachInsight
  expanded: boolean
  onToggle: () => void
}) {
  const colorClass = CATEGORY_COLOR[insight.category] ?? CATEGORY_COLOR.mechanic
  const icon = CATEGORY_ICON[insight.category] ?? '💡'

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${colorClass}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all cursor-pointer"
      >
        <span className="text-base shrink-0">{icon}</span>
        <span className="text-stone-200 text-sm font-bold flex-1 leading-snug">{insight.title}</span>
        <span className="text-stone-600 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-stone-800/50">
          <pre className="text-stone-400 text-xs leading-relaxed whitespace-pre-wrap font-sans mt-2">
            {insight.body}
          </pre>
        </div>
      )}
    </div>
  )
}
