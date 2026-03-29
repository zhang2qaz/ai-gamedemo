'use client'

import { useState } from 'react'
import type { RoundAuditLog } from '@/engine/types'
import { formatMoney, formatPercent, ACTION_LABELS, FINAL_SHIFT_LABELS } from '@/lib/format'

type Props = {
  logs: RoundAuditLog[]
  onClose: () => void
}

const PLAYER_COLORS: Record<string, string> = {
  A: 'text-amber-400',
  B: 'text-sky-400',
  C: 'text-emerald-400',
  D: 'text-purple-400',
}

export default function AuditLogPanel({ logs, onClose }: Props) {
  const [expandedRound, setExpandedRound] = useState<number | null>(null)
  const [copiedJson, setCopiedJson] = useState(false)

  function handleCopyJson() {
    const json = JSON.stringify(logs, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    })
  }

  function handleDownloadJson() {
    const json = JSON.stringify(logs, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'yizhan-audit-log.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-stone-900 border border-amber-700/60 rounded-xl w-full max-w-5xl mx-4 p-6 space-y-4">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-amber-800/40 pb-4">
          <div className="text-amber-400 font-bold text-lg uppercase tracking-widest">
            完整审计日志
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 text-xs bg-stone-700 hover:bg-stone-600 text-stone-300 rounded border border-stone-600 transition-all"
            >
              {copiedJson ? '已复制 ✓' : '复制 JSON'}
            </button>
            <button
              onClick={handleDownloadJson}
              className="px-3 py-1.5 text-xs bg-stone-700 hover:bg-stone-600 text-stone-300 rounded border border-stone-600 transition-all"
            >
              导出 .json
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded border border-red-800 transition-all"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 每回合日志 */}
        {logs.map(log => (
          <div key={log.round} className="border border-stone-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedRound(expandedRound === log.round ? null : log.round)}
              className="w-full flex items-center justify-between p-3 bg-stone-800/60 hover:bg-stone-800 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-bold">第 {log.round} 回合</span>
                {log.global.eventApplied && (
                  <span className="text-xs text-orange-400 bg-orange-900/30 border border-orange-800/50 px-1.5 py-0.5 rounded">
                    事件生效
                  </span>
                )}
                <span className="text-stone-400 text-xs">
                  客流 {log.global.totalCustomers.toLocaleString()} · 价格敏感 {(log.global.priceSensitivity * 100).toFixed(0)}% · 品质权重 {(log.global.qualityWeight * 100).toFixed(0)}%
                </span>
              </div>
              <span className="text-stone-400 text-sm">{expandedRound === log.round ? '▲ 收起' : '▼ 展开'}</span>
            </button>

            {expandedRound === log.round && (
              <div className="p-4 overflow-x-auto">
                {log.global.eventApplied && (
                  <div className="mb-3 text-sm text-orange-300 bg-orange-900/20 border border-orange-800/40 rounded p-2">
                    {log.global.eventApplied}
                  </div>
                )}
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-stone-500 border-b border-stone-700">
                      <th className="text-left py-1 px-2">字段</th>
                      {log.players.map(p => (
                        <th key={p.id} className={`text-right py-1 px-2 ${PLAYER_COLORS[p.id]}`}>
                          玩家{p.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <LogRow label="动作" values={log.players.map(p => ACTION_LABELS[p.action])} />
                    <LogRow label="终盘转向" values={log.players.map(p => FINAL_SHIFT_LABELS[p.finalShift])} />
                    <LogRowSep />
                    <LogRow label="旧份额" values={log.players.map(p => formatPercent(p.oldShare))} />
                    <LogRow label="品质分(结算前)" values={log.players.map(p => p.qualityScoreBefore.toFixed(1))} />
                    <LogRow label="品质提升(上回合QUA)" values={log.players.map(p => `+${p.qualityDeltaFromLastRound}`)} />
                    <LogRow label="品质分(结算后)" values={log.players.map(p => p.qualityScoreAfter.toFixed(1))} />
                    <LogRow label="品质蓄量(前)" values={log.players.map(p => p.qualityChargeBefore.toFixed(0))} />
                    <LogRow label="品质蓄量(后)" values={log.players.map(p => p.qualityChargeAfter.toFixed(0))} />
                    <LogRow label="品牌热度(前)" values={log.players.map(p => p.brandHeatBefore.toFixed(0))} />
                    <LogRow label="品牌热度(后)" values={log.players.map(p => p.brandHeatAfter.toFixed(0))} />
                    <LogRow label="动量(前)" values={log.players.map(p => p.marketMomentumBefore.toFixed(2))} />
                    <LogRow label="动量(后)" values={log.players.map(p => p.marketMomentumAfter.toFixed(2))} />
                    <LogRow label="疲劳(前)" values={log.players.map(p => p.fatigueBefore.toFixed(0))} />
                    <LogRow label="疲劳(后)" values={log.players.map(p => p.fatigueAfter.toFixed(0))} />
                    <LogRowSep />
                    <LogRow label="ATK人数" values={log.players.map(p => p.atkCount.toFixed(0))} />
                    <LogRow label="MKT人数" values={log.players.map(p => p.mktCount.toFixed(0))} />
                    <LogRow label="进攻压力" values={log.players.map(p => p.aggressionPressure.toFixed(0))} />
                    <LogRowSep />
                    <LogRow label="动作加成" values={log.players.map(p => p.actionBonus.toFixed(3))} />
                    <LogRow label="品质基础加成" values={log.players.map(p => p.qualityBonus.toFixed(3))} />
                    <LogRow label="终盘加成" values={log.players.map(p => p.finalShiftBonus.toFixed(3))} />
                    <LogRow label="HOLD惩罚" values={log.players.map(p => (-p.holdPenalty).toFixed(3))} />
                    <LogRow label="最终竞争力" values={log.players.map(p => p.competitiveness.toFixed(3))} highlight />
                    <LogRowSep />
                    <LogRow label="即时份额" values={log.players.map(p => formatPercent(p.instantShare, 2))} />
                    <LogRow label="动量份额" values={log.players.map(p => formatPercent(p.momentumShare, 2))} />
                    <LogRow label="新份额" values={log.players.map(p => formatPercent(p.newShare, 2))} highlight />
                    <LogRowSep />
                    <LogRow label="单价" values={log.players.map(p => `¥${p.unitPrice}`)} />
                    <LogRow label="利润率" values={log.players.map(p => formatPercent(p.margin))} />
                    <LogRow label="收入" values={log.players.map(p => formatMoney(p.revenue))} />
                    <LogRow label="毛利润" values={log.players.map(p => formatMoney(p.grossProfit))} />
                    <LogRow label="品牌变现加成" values={log.players.map(p => formatMoney(p.revenueBonus))} />
                    <LogRow label="行动成本" values={log.players.map(p => `-${formatMoney(p.actionCost)}`)} />
                    <LogRow label="净利润" values={log.players.map(p => formatMoney(p.netProfit))} highlight />
                    <LogRow label="累计利润" values={log.players.map(p => formatMoney(p.cumulativeProfitAfter))} />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function LogRow({ label, values, highlight = false }: { label: string; values: string[]; highlight?: boolean }) {
  return (
    <tr className={`border-b border-stone-800/50 ${highlight ? 'bg-stone-800/30' : ''}`}>
      <td className="py-0.5 px-2 text-stone-400">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`text-right py-0.5 px-2 ${highlight ? 'text-white font-bold' : 'text-stone-300'}`}>
          {v}
        </td>
      ))}
    </tr>
  )
}

function LogRowSep() {
  return <tr className="h-1"><td colSpan={5} /></tr>
}
