'use client'

import { useState } from 'react'
import type { RoundAuditLog, PlayerRoundCalc, BaseAction } from '@/engine/types'
import { formatMoney, formatPercent, ACTION_LABELS, ACTION_COLORS, FINAL_SHIFT_LABELS } from '@/lib/format'
import { PLAYER_COLORS } from '@/lib/playerColors'

type Props = {
  logs: RoundAuditLog[]
  onClose: () => void
}

const ACTION_EMOJI: Record<string, string> = {
  ATK: '⚔️', QUA: '🔬', MKT: '📢', HOLD: '🛡️',
}

export default function AuditLogPanel({ logs, onClose }: Props) {
  const [expandedRound, setExpandedRound] = useState<number | null>(
    logs.length > 0 ? logs[logs.length - 1].round : null
  )
  const [showRawData, setShowRawData] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  function handleCopyJson() {
    const json = JSON.stringify(logs, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-start justify-center overflow-y-auto py-4 px-2">
      <div className="bg-stone-900 border border-stone-700/60 rounded-xl w-full max-w-lg mx-auto p-4 space-y-3">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="text-amber-400 font-bold text-base">📋 战局回顾</div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="px-2 py-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-500 rounded border border-stone-700 transition-all"
            >
              {showRawData ? '故事模式' : '数据模式'}
            </button>
            <button
              onClick={handleCopyJson}
              className="px-2 py-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-500 rounded border border-stone-700 transition-all"
            >
              {copiedJson ? '✓' : 'JSON'}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-stone-800 hover:bg-red-900/50 text-stone-400 hover:text-red-300 rounded border border-stone-700 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 每回合 */}
        {logs.map(log => (
          <div key={log.round} className="border border-stone-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedRound(expandedRound === log.round ? null : log.round)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-800/40 hover:bg-stone-800/60 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-black text-sm">R{log.round}</span>
                {/* 回合摘要 */}
                <div className="flex gap-1">
                  {log.players.map(p => {
                    const c = PLAYER_COLORS[p.id]
                    return (
                      <span key={p.id} className={`text-[10px] ${c?.text ?? ''}`}>
                        {ACTION_EMOJI[p.action]}
                      </span>
                    )
                  })}
                </div>
                {log.global.eventApplied && <span className="text-orange-400 text-[10px]">⚡事件</span>}
              </div>
              <span className="text-stone-600 text-xs">{expandedRound === log.round ? '▲' : '▼'}</span>
            </button>

            {expandedRound === log.round && (
              <div className="px-3 py-3 space-y-3">
                {showRawData ? (
                  <RawDataView log={log} />
                ) : (
                  <StoryView log={log} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 故事模式：直观展示 ──
function StoryView({ log }: { log: RoundAuditLog }) {
  // 按利润排名
  const ranked = [...log.players].sort((a, b) => b.netProfit - a.netProfit)
  // 份额变化最大的
  const shareChanges = log.players.map(p => ({
    ...p,
    delta: p.newShare - p.oldShare,
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return (
    <div className="space-y-3">
      {/* 市场环境 */}
      {log.global.eventApplied && (
        <div className="bg-orange-950/30 border border-orange-800/40 rounded-lg px-3 py-2 text-orange-300 text-xs">
          ⚡ {log.global.eventApplied}
        </div>
      )}

      {/* 每位玩家的行动卡 */}
      {ranked.map((p, i) => {
        const c = PLAYER_COLORS[p.id]
        const shareDelta = p.newShare - p.oldShare
        const profitPositive = p.netProfit >= 0
        const shareUp = shareDelta >= 0

        return (
          <div key={p.id} className="glass-card border-stone-700/40 rounded-xl p-3 space-y-2">
            {/* 名字 + 行动 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '　'}</span>
                <span className={`font-bold text-sm ${c?.text ?? ''}`} style={{ textShadow: '0 0 8px currentColor' }}>
                  {log.players.find(pp => pp.id === p.id) ? p.id : p.id}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md border ${actionBadgeClass(p.action)}`}>
                  {ACTION_EMOJI[p.action]} {ACTION_LABELS[p.action]}
                </span>
                {p.finalShift !== 'NONE' && (
                  <span className="text-[10px] text-purple-400 bg-purple-950/40 border border-purple-800/40 px-1 py-0.5 rounded">
                    {FINAL_SHIFT_LABELS[p.finalShift]}
                  </span>
                )}
              </div>
            </div>

            {/* 核心结果 */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-stone-800/40 rounded-lg py-1.5 px-1">
                <div className="text-[10px] text-stone-500">净利润</div>
                <div className={`text-sm font-bold ${profitPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {formatMoney(p.netProfit)}
                </div>
              </div>
              <div className="bg-stone-800/40 rounded-lg py-1.5 px-1">
                <div className="text-[10px] text-stone-500">份额变化</div>
                <div className={`text-sm font-bold ${shareUp ? 'text-green-400' : 'text-red-400'}`}>
                  {shareDelta >= 0 ? '+' : ''}{(shareDelta * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-stone-800/40 rounded-lg py-1.5 px-1">
                <div className="text-[10px] text-stone-500">竞争力</div>
                <div className="text-sm font-bold text-amber-300">
                  {p.competitiveness.toFixed(1)}
                </div>
              </div>
            </div>

            {/* 竞争力来源解析 */}
            <CompetitivenessBreakdown p={p} />
          </div>
        )
      })}

      {/* 市场概况 */}
      <div className="bg-stone-800/30 rounded-lg px-3 py-2 text-[10px] text-stone-500 space-y-0.5">
        <div>📊 本轮市场：总需求 {(log.global.totalCustomers / 10000).toFixed(0)}万 · 价格敏感度 {(log.global.priceSensitivity * 100).toFixed(0)}% · 品质权重 {(log.global.qualityWeight * 100).toFixed(0)}%</div>
        <div>⚔️ 选择进攻的有 {log.players.filter(p => p.action === 'ATK').length} 人 · 选择营销的有 {log.players.filter(p => p.action === 'MKT').length} 人</div>
      </div>
    </div>
  )
}

// ── 竞争力来源条形图 ──
function CompetitivenessBreakdown({ p }: { p: PlayerRoundCalc }) {
  const items = [
    { label: '行动', value: p.actionBonus, color: 'bg-cyan-500' },
    { label: '品质', value: p.qualityBonus, color: 'bg-blue-500' },
    { label: '终盘', value: p.finalShiftBonus, color: 'bg-purple-500' },
    { label: '守势罚', value: -p.holdPenalty, color: 'bg-red-500' },
  ].filter(item => Math.abs(item.value) > 0.01)

  if (items.length === 0) return null

  const maxVal = Math.max(...items.map(i => Math.abs(i.value)), 1)

  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-stone-600">竞争力来源</div>
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-stone-500 w-10 text-right shrink-0">{item.label}</span>
          <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${item.color} rounded-full transition-all`}
              style={{ width: `${Math.min(100, (Math.abs(item.value) / maxVal) * 100)}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono w-8 text-right ${item.value >= 0 ? 'text-stone-400' : 'text-red-400'}`}>
            {item.value >= 0 ? '+' : ''}{item.value.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 数据模式：保留原始表格（精简版） ──
function RawDataView({ log }: { log: RoundAuditLog }) {
  return (
    <div className="overflow-x-auto -mx-3">
      <table className="w-full text-[10px] font-mono min-w-[400px]">
        <thead>
          <tr className="text-stone-600 border-b border-stone-800">
            <th className="text-left py-1 px-2">指标</th>
            {log.players.map(p => (
              <th key={p.id} className={`text-right py-1 px-2 ${PLAYER_COLORS[p.id]?.text ?? ''}`}>
                {p.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <RawRow label="行动" values={log.players.map(p => `${ACTION_EMOJI[p.action]}${p.action}`)} />
          <RawSep cols={1 + log.players.length} />
          <RawRow label="旧份额" values={log.players.map(p => formatPercent(p.oldShare))} />
          <RawRow label="新份额" values={log.players.map(p => formatPercent(p.newShare))} hl />
          <RawRow label="变化" values={log.players.map(p => {
            const d = p.newShare - p.oldShare
            return `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`
          })} />
          <RawSep cols={1 + log.players.length} />
          <RawRow label="竞争力" values={log.players.map(p => p.competitiveness.toFixed(1))} hl />
          <RawRow label="├行动" values={log.players.map(p => `+${p.actionBonus.toFixed(1)}`)} />
          <RawRow label="├品质" values={log.players.map(p => `+${p.qualityBonus.toFixed(1)}`)} />
          <RawRow label="├终盘" values={log.players.map(p => p.finalShiftBonus > 0 ? `+${p.finalShiftBonus.toFixed(1)}` : '-')} />
          <RawRow label="└守罚" values={log.players.map(p => p.holdPenalty > 0 ? `-${p.holdPenalty.toFixed(1)}` : '-')} />
          <RawSep cols={1 + log.players.length} />
          <RawRow label="品质分" values={log.players.map(p => `${p.qualityScoreBefore.toFixed(0)}→${p.qualityScoreAfter.toFixed(0)}`)} />
          <RawRow label="品牌" values={log.players.map(p => `${p.brandHeatBefore.toFixed(0)}→${p.brandHeatAfter.toFixed(0)}`)} />
          <RawRow label="动量" values={log.players.map(p => `${p.marketMomentumBefore.toFixed(1)}→${p.marketMomentumAfter.toFixed(1)}`)} />
          <RawSep cols={1 + log.players.length} />
          <RawRow label="收入" values={log.players.map(p => formatMoney(p.revenue))} />
          <RawRow label="成本" values={log.players.map(p => `-${formatMoney(p.actionCost)}`)} />
          <RawRow label="净利润" values={log.players.map(p => formatMoney(p.netProfit))} hl />
          <RawRow label="累计" values={log.players.map(p => formatMoney(p.cumulativeProfitAfter))} hl />
        </tbody>
      </table>
    </div>
  )
}

function RawRow({ label, values, hl = false }: { label: string; values: string[]; hl?: boolean }) {
  return (
    <tr className={`border-b border-stone-800/40 ${hl ? 'bg-stone-800/20' : ''}`}>
      <td className="py-0.5 px-2 text-stone-500">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`text-right py-0.5 px-2 ${hl ? 'text-stone-200 font-bold' : 'text-stone-400'}`}>{v}</td>
      ))}
    </tr>
  )
}

function RawSep({ cols }: { cols: number }) {
  return <tr className="h-1"><td colSpan={cols} /></tr>
}

function actionBadgeClass(action: BaseAction): string {
  switch (action) {
    case 'ATK': return 'bg-red-950/50 border-red-800/50 text-red-400'
    case 'QUA': return 'bg-blue-950/50 border-blue-800/50 text-blue-400'
    case 'MKT': return 'bg-yellow-950/50 border-yellow-800/50 text-yellow-400'
    case 'HOLD': return 'bg-stone-800/50 border-stone-700/50 text-stone-400'
  }
}
