// =====================
// 台账查询接口
// GET /api/expenses?q=&category=&status=&from=&to=
// =====================

import type { NextRequest } from 'next/server'
import { loadExpenses } from '@/lib/expenses/store'
import { filterExpenses, summarize } from '@/lib/expenses/analytics'
import {
  CATEGORY_KEYS,
  REIMBURSE_KEYS,
  type CategoryKey,
  type ReimburseStatus,
} from '@/lib/expenses/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams

  const category = sp.get('category') ?? undefined
  if (category && !CATEGORY_KEYS.includes(category as CategoryKey)) {
    return Response.json(
      { error: `未知分类 "${category}"，可用值：${CATEGORY_KEYS.join(', ')}` },
      { status: 400 }
    )
  }

  const status = sp.get('status') ?? undefined
  if (status && !REIMBURSE_KEYS.includes(status as ReimburseStatus)) {
    return Response.json(
      { error: `未知报销状态 "${status}"，可用值：${REIMBURSE_KEYS.join(', ')}` },
      { status: 400 }
    )
  }

  const filter = {
    q: sp.get('q') ?? undefined,
    category: category as CategoryKey | undefined,
    status: status as ReimburseStatus | undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  }

  const records = filterExpenses(await loadExpenses(), filter)
  return Response.json({
    query: filter,
    summary: summarize(records),
    records,
  })
}
