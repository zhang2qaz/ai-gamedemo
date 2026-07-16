// =====================
// 台账查询与统计（纯函数，服务端/客户端共用）
// =====================

import {
  CATEGORIES,
  REIMBURSE_STATUS,
  type CategoryKey,
  type ExpenseRecord,
  type ReimburseStatus,
} from './types'

export interface ExpenseFilter {
  /** 关键词：匹配编号、商家、摘要、明细、地点、支付方式、备注、分类名 */
  q?: string
  category?: CategoryKey
  status?: ReimburseStatus
  /** 起始日期 YYYY-MM-DD（含） */
  from?: string
  /** 截止日期 YYYY-MM-DD（含） */
  to?: string
}

export interface CurrencyTotal {
  currency: string
  amount: number
}

export interface ExpenseSummary {
  count: number
  totals: CurrencyTotal[]
  byCategory: { category: CategoryKey; count: number; totals: CurrencyTotal[] }[]
  byDate: { date: string; count: number; totals: CurrencyTotal[] }[]
  byStatus: { status: ReimburseStatus; count: number; totals: CurrencyTotal[] }[]
}

function recordHaystack(r: ExpenseRecord): string {
  return [
    r.id,
    r.merchant,
    r.merchantNote,
    r.description,
    r.location,
    r.paymentMethod,
    r.notes,
    r.reimburseNote,
    CATEGORIES[r.category]?.label,
    REIMBURSE_STATUS[r.reimburse]?.label,
    ...(r.items?.map(i => i.name) ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function filterExpenses(records: ExpenseRecord[], f: ExpenseFilter): ExpenseRecord[] {
  const q = f.q?.trim().toLowerCase()
  return records.filter(r => {
    if (f.category && r.category !== f.category) return false
    if (f.status && r.reimburse !== f.status) return false
    if (f.from && r.date < f.from) return false
    if (f.to && r.date > f.to) return false
    if (q && !recordHaystack(r).includes(q)) return false
    return true
  })
}

/** 分币种累加，金额按分（0.01）取整避免浮点误差 */
function addTotal(totals: Map<string, number>, r: ExpenseRecord) {
  totals.set(r.currency, (totals.get(r.currency) ?? 0) + Math.round(r.amount * 100))
}

function toCurrencyTotals(totals: Map<string, number>, mainCurrency?: string): CurrencyTotal[] {
  return [...totals.entries()]
    .map(([currency, cents]) => ({ currency, amount: cents / 100 }))
    .sort((a, b) => {
      // 主币种永远排第一，跨币种金额数值没有可比性（如 ₩92,550 vs $2,268）
      if (a.currency === mainCurrency && b.currency !== mainCurrency) return -1
      if (b.currency === mainCurrency && a.currency !== mainCurrency) return 1
      return b.amount - a.amount
    })
}

export function summarize(records: ExpenseRecord[]): ExpenseSummary {
  const totals = new Map<string, number>()
  const byCategory = new Map<CategoryKey, { count: number; totals: Map<string, number> }>()
  const byDate = new Map<string, { count: number; totals: Map<string, number> }>()
  const byStatus = new Map<ReimburseStatus, { count: number; totals: Map<string, number> }>()

  for (const r of records) {
    addTotal(totals, r)

    const cat = byCategory.get(r.category) ?? { count: 0, totals: new Map() }
    cat.count += 1
    addTotal(cat.totals, r)
    byCategory.set(r.category, cat)

    const day = byDate.get(r.date) ?? { count: 0, totals: new Map() }
    day.count += 1
    addTotal(day.totals, r)
    byDate.set(r.date, day)

    const st = byStatus.get(r.reimburse) ?? { count: 0, totals: new Map() }
    st.count += 1
    addTotal(st.totals, r)
    byStatus.set(r.reimburse, st)
  }

  // 主币种 = 记录笔数最多的币种，笔数相同取合计金额大者
  const currencyCounts = new Map<string, number>()
  for (const r of records) currencyCounts.set(r.currency, (currencyCounts.get(r.currency) ?? 0) + 1)
  const mainCurrency = [...currencyCounts.entries()].sort(
    (a, b) => b[1] - a[1] || (totals.get(b[0]) ?? 0) - (totals.get(a[0]) ?? 0)
  )[0]?.[0]
  const mainAmount = (m: Map<string, number>) => (mainCurrency ? (m.get(mainCurrency) ?? 0) : 0)

  return {
    count: records.length,
    totals: toCurrencyTotals(totals, mainCurrency),
    byCategory: [...byCategory.entries()]
      .sort((a, b) => mainAmount(b[1].totals) - mainAmount(a[1].totals))
      .map(([category, v]) => ({ category, count: v.count, totals: toCurrencyTotals(v.totals, mainCurrency) })),
    byDate: [...byDate.entries()]
      .map(([date, v]) => ({ date, count: v.count, totals: toCurrencyTotals(v.totals, mainCurrency) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byStatus: [...byStatus.entries()]
      .map(([status, v]) => ({ status, count: v.count, totals: toCurrencyTotals(v.totals, mainCurrency) })),
  }
}
