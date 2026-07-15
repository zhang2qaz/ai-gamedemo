'use client'

// =====================
// 发票开销台账 — 查询仪表盘（筛选、统计、列表全部实时联动）
// =====================

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CATEGORIES,
  CATEGORY_KEYS,
  REIMBURSE_STATUS,
  REIMBURSE_KEYS,
  formatAmount,
  type CategoryKey,
  type ExpenseRecord,
  type ReimburseStatus,
} from '@/lib/expenses/types'
import { filterExpenses, summarize, type CurrencyTotal } from '@/lib/expenses/analytics'

// 数据标记色（深色面板校验值）：分类=蓝，逐日=绿；文字一律用文字色
const BAR_BLUE = '#3987e5'
const BAR_GREEN = '#008300'

function totalsText(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return '—'
  return totals.map(t => formatAmount(t.amount, t.currency)).join(' + ')
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-stone-900/75 px-4 py-3">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-stone-100">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  )
}

function BarRow({
  label,
  amountText,
  ratio,
  color,
  hint,
}: {
  label: string
  amountText: string
  ratio: number
  color: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-3" title={hint}>
      <div className="w-24 shrink-0 truncate text-right text-xs text-stone-400">{label}</div>
      <div className="min-w-0 flex-1">
        <div
          className="h-2.5"
          style={{
            width: `${Math.max(ratio * 100, 0.5)}%`,
            background: color,
            borderRadius: '0 4px 4px 0', // 数据端 4px 圆角，基线端直角
          }}
        />
      </div>
      {/* 金额固定放右列，保证最长的柱也不会挤掉数值 */}
      <div
        className="shrink-0 whitespace-nowrap text-right text-xs text-stone-300"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {amountText}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ReimburseStatus }) {
  const meta = REIMBURSE_STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function CategoryBadge({ category }: { category: CategoryKey }) {
  const meta = CATEGORIES[category]
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-stone-800/80 px-2 py-0.5 text-xs text-stone-300">
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}

export default function ExpenseDashboard({ records }: { records: ExpenseRecord[] }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CategoryKey | ''>('')
  const [status, setStatus] = useState<ReimburseStatus | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(
    () =>
      filterExpenses(records, {
        q: q || undefined,
        category: category || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    [records, q, category, status, from, to]
  )
  const summary = useMemo(() => summarize(filtered), [filtered])

  // 主币种 = 总额最大的币种（纽约行程通常是 USD），柱长按主币种金额缩放
  const mainCurrency = summary.totals[0]?.currency
  const mainAmount = (totals: CurrencyTotal[]) =>
    totals.find(t => t.currency === mainCurrency)?.amount ?? 0

  const maxCategory = Math.max(...summary.byCategory.map(c => mainAmount(c.totals)), 0)
  const maxDay = Math.max(...summary.byDate.map(d => mainAmount(d.totals)), 0)

  const pendingTotals = summary.byStatus.find(s => s.status === 'pending')
  const reimbursedTotals = summary.byStatus.find(s => s.status === 'reimbursed')

  const hasFilter = Boolean(q || category || status || from || to)

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* 标题 */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">纽约行程 · 发票开销台账</h1>
        <p className="mt-1 text-sm text-stone-400">
          小票拍照发给 Claude 自动入账归类 · 共 {records.length} 笔记录
        </p>
      </header>

      {records.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-stone-900/75 px-6 py-12 text-center">
          <div className="text-4xl" aria-hidden>🧾</div>
          <h2 className="mt-3 text-lg font-semibold text-stone-100">还没有票据记录</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-400">
            把发票、小票、报销单一张一张拍照发给 Claude，
            会自动识别金额、商家、日期并归类入账；入账后这里即可实时查询。
          </p>
        </div>
      ) : (
        <>
          {/* 筛选行 */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="搜索商家 / 摘要 / 明细…"
              className="min-w-40 flex-1 rounded-lg border border-white/10 bg-stone-900/75 px-3 py-1.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-white/25 focus:outline-none"
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value as CategoryKey | '')}
              className="rounded-lg border border-white/10 bg-stone-900/75 px-2 py-1.5 text-sm text-stone-300 focus:outline-none"
              aria-label="按分类筛选"
            >
              <option value="">全部分类</option>
              {CATEGORY_KEYS.map(k => (
                <option key={k} value={k}>
                  {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ReimburseStatus | '')}
              className="rounded-lg border border-white/10 bg-stone-900/75 px-2 py-1.5 text-sm text-stone-300 focus:outline-none"
              aria-label="按报销状态筛选"
            >
              <option value="">全部状态</option>
              {REIMBURSE_KEYS.map(k => (
                <option key={k} value={k}>
                  {REIMBURSE_STATUS[k].label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-stone-900/75 px-2 py-1.5 text-sm text-stone-300 focus:outline-none"
              aria-label="起始日期"
            />
            <span className="text-xs text-stone-500">至</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-stone-900/75 px-2 py-1.5 text-sm text-stone-300 focus:outline-none"
              aria-label="截止日期"
            />
            {hasFilter && (
              <button
                onClick={() => {
                  setQ('')
                  setCategory('')
                  setStatus('')
                  setFrom('')
                  setTo('')
                }}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-stone-400 hover:bg-stone-800"
              >
                清除筛选
              </button>
            )}
          </div>

          {/* 总支出（主数字）+ 指标行 */}
          <section className="mb-6 rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
            <div className="text-xs text-stone-400">
              {hasFilter ? '筛选结果总支出' : '总支出'}
            </div>
            <div className="mt-1 text-5xl font-semibold text-stone-100">
              {summary.totals.length > 0 ? formatAmount(summary.totals[0].amount, summary.totals[0].currency) : '—'}
            </div>
            {summary.totals.length > 1 && (
              <div className="mt-1 text-sm text-stone-400">
                另有 {summary.totals.slice(1).map(t => formatAmount(t.amount, t.currency)).join('、')}
              </div>
            )}
          </section>

          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="票据笔数" value={`${summary.count} 笔`} />
            <StatTile
              label="待报销"
              value={totalsText(pendingTotals?.totals ?? [])}
              sub={pendingTotals ? `${pendingTotals.count} 笔` : '暂无'}
            />
            <StatTile
              label="已报销"
              value={totalsText(reimbursedTotals?.totals ?? [])}
              sub={reimbursedTotals ? `${reimbursedTotals.count} 笔` : '暂无'}
            />
          </section>

          {/* 分类构成 + 逐日支出 */}
          {summary.count > 0 && (
            <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
                <h2 className="mb-3 text-sm font-semibold text-stone-100">分类构成</h2>
                <div className="space-y-2">
                  {summary.byCategory.map(c => (
                    <BarRow
                      key={c.category}
                      label={`${CATEGORIES[c.category].emoji} ${CATEGORIES[c.category].label}`}
                      amountText={totalsText(c.totals)}
                      ratio={maxCategory > 0 ? mainAmount(c.totals) / maxCategory : 0}
                      color={BAR_BLUE}
                      hint={`${CATEGORIES[c.category].label} · ${c.count} 笔 · ${totalsText(c.totals)}`}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
                <h2 className="mb-3 text-sm font-semibold text-stone-100">逐日支出</h2>
                <div className="space-y-2">
                  {summary.byDate.map(d => (
                    <BarRow
                      key={d.date}
                      label={d.date.slice(5).replace('-', '/')}
                      amountText={totalsText(d.totals)}
                      ratio={maxDay > 0 ? mainAmount(d.totals) / maxDay : 0}
                      color={BAR_GREEN}
                      hint={`${d.date} · ${d.count} 笔 · ${totalsText(d.totals)}`}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 记录列表 */}
          <section className="rounded-xl border border-white/10 bg-stone-900/75">
            <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold text-stone-100">
              票据记录{hasFilter && `（筛选出 ${filtered.length} 笔）`}
            </div>
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-stone-500">
                没有符合条件的记录，试试调整筛选条件
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {filtered.map(r => (
                  <li key={r.id}>
                    <Link
                      href={`/expenses/${r.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-stone-100">{r.merchant}</span>
                          <CategoryBadge category={r.category} />
                          <StatusBadge status={r.reimburse} />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-stone-400">
                          {r.date}
                          {r.time && ` ${r.time}`} · {r.description}
                        </div>
                      </div>
                      <div
                        className="shrink-0 text-right font-semibold text-stone-100"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatAmount(r.amount, r.currency)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <footer className="mt-8 text-center text-xs text-stone-600">
        数据来源：data/expenses/records.json · 接口查询：GET /api/expenses
      </footer>
    </div>
  )
}
