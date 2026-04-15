'use client'

import { useState, useMemo, useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'
import { generateInsights, type CoachInsight } from '@/engine/coach'

const CATEGORY_ICON: Record<string, string> = {
  share: '📊',
  profit: '💰',
  action: '⚔️',
  strategy: '🧠',
  mechanic: '⚙️',
  concept: '📚',
}

const CATEGORY_COLOR: Record<string, string> = {
  share: 'border-sky-800 bg-sky-950/30',
  profit: 'border-green-800 bg-green-950/30',
  action: 'border-red-800 bg-red-950/30',
  strategy: 'border-purple-800 bg-purple-950/30',
  mechanic: 'border-stone-700 bg-stone-900/60',
  concept: 'border-amber-700 bg-amber-950/30',
}

const CATEGORY_LABEL: Record<string, string> = {
  share: '份额分析',
  profit: '利润分析',
  action: '动作解读',
  strategy: '策略建议',
  mechanic: '机制科普',
  concept: '学到了什么',
}

type CoachPanelProps = {
  auditLogs?: import('@/engine/types').RoundAuditLog[]
  players?: import('@/engine/types').PlayerState[]
  theme?: import('@/engine/themes/types').ThemeConfig | null
  phase?: string
}

export default function CoachPanel(props: CoachPanelProps = {}) {
  const [open, setOpen] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [hasNewInsights, setHasNewInsights] = useState(false)
  const storeAuditLogs = useGameStore(s => s.auditLogs)
  const storePlayers = useGameStore(s => s.players)
  const storeTheme = useGameStore(s => s.theme)
  const storePhase = useGameStore(s => s.phase)

  const auditLogs = props.auditLogs ?? storeAuditLogs
  const players = props.players ?? storePlayers
  const theme = props.theme !== undefined ? props.theme : storeTheme
  const phase = props.phase ?? storePhase

  const insights = useMemo(
    () => generateInsights(auditLogs, players, theme),
    [auditLogs, players, theme]
  )

  // Pulse when new insights are available
  const [prevInsightCount, setPrevInsightCount] = useState(0)
  useEffect(() => {
    if (insights.length > prevInsightCount && !open) {
      setHasNewInsights(true)
    }
    setPrevInsightCount(insights.length)
  }, [insights.length, open, prevInsightCount])

  useEffect(() => {
    if (open) setHasNewInsights(false)
  }, [open])

  // 主题选择阶段不显示
  if (phase === 'THEME_SELECT') return null

  const hasLogs = auditLogs.length > 0
  const categories = [...new Set(insights.map(i => i.category))]
  const filtered = filterCat ? insights.filter(i => i.category === filterCat) : insights

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all ${
          open
            ? 'bg-amber-500 text-black scale-110 ring-4 ring-amber-500/30'
            : hasNewInsights
            ? 'bg-amber-600 text-black border-2 border-amber-400 animate-pulse'
            : 'bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-600 hover:border-amber-600'
        }`}
        title="教练问答"
      >
        {open ? '✕' : '🧠'}
        {hasNewInsights && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white font-bold flex items-center justify-center">
            !
          </span>
        )}
      </button>

      {/* 面板 */}
      {open && (
        <div className="fixed bottom-20 left-6 z-40 w-[420px] max-w-[calc(100vw-3rem)] max-h-[70vh] bg-stone-950 border border-amber-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          <div className="px-4 py-3 border-b border-stone-800 bg-stone-900/80 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-amber-400 font-bold text-sm">🧠 策略教练</div>
              {hasLogs && (
                <span className="text-stone-600 text-xs font-mono">{insights.length} 条洞察</span>
              )}
            </div>
            <div className="text-stone-600 text-xs mt-0.5">
              {hasLogs ? '基于本局数据，解读决策背后的逻辑' : '完成第一回合后，这里会出现数据分析'}
            </div>

            {/* 分类筛选 */}
            {hasLogs && categories.length > 1 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                <button
                  onClick={() => setFilterCat(null)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                    !filterCat ? 'bg-amber-900/40 border-amber-700 text-amber-300' : 'border-stone-700 text-stone-500 hover:border-stone-600'
                  }`}
                >
                  全部
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                      filterCat === cat ? 'bg-amber-900/40 border-amber-700 text-amber-300' : 'border-stone-700 text-stone-500 hover:border-stone-600'
                    }`}
                  >
                    {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat] ?? cat}
                  </button>
                ))}
              </div>
            )}
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
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-stone-600 text-sm">
                {filterCat ? '该类别暂无分析' : '暂无分析'}
              </div>
            ) : (
              filtered.map((insight, i) => (
                <InsightCard
                  key={`${insight.category}-${i}`}
                  insight={insight}
                  expanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  delay={i * 50}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}

function InsightCard({ insight, expanded, onToggle, delay = 0 }: {
  insight: CoachInsight
  expanded: boolean
  onToggle: () => void
  delay?: number
}) {
  const colorClass = CATEGORY_COLOR[insight.category] ?? CATEGORY_COLOR.mechanic
  const icon = CATEGORY_ICON[insight.category] ?? '💡'
  const label = CATEGORY_LABEL[insight.category] ?? ''

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${colorClass} animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-all cursor-pointer"
      >
        <span className="text-base shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-stone-200 text-sm font-bold leading-snug block">{insight.title}</span>
          <span className="text-stone-600 text-xs">{label}</span>
        </div>
        <span className={`text-stone-600 text-xs shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: expanded ? '500px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="px-3 pb-3 border-t border-stone-800/50">
          <pre className="text-stone-400 text-xs leading-relaxed whitespace-pre-wrap font-sans mt-2">
            {insight.body}
          </pre>
        </div>
      </div>
    </div>
  )
}
