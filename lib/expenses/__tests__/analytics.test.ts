import { filterExpenses, summarize } from '../analytics'
import type { ExpenseRecord } from '../types'

function record(overrides: Partial<ExpenseRecord>): ExpenseRecord {
  return {
    id: '20260712-001',
    date: '2026-07-12',
    merchant: 'Test Merchant',
    category: 'dining',
    description: '测试记录',
    amount: 10,
    currency: 'USD',
    receipts: [],
    reimburse: 'pending',
    recordedAt: '2026-07-12T12:00:00Z',
    ...overrides,
  }
}

const records: ExpenseRecord[] = [
  record({
    id: '20260712-001',
    date: '2026-07-12',
    merchant: 'Joe Coffee',
    description: '早餐咖啡',
    amount: 12.5,
    items: [{ name: 'Latte', amount: 6.5 }],
  }),
  record({
    id: '20260712-002',
    date: '2026-07-12',
    merchant: 'Yellow Cab',
    category: 'transport',
    description: 'JFK 机场打车',
    amount: 68.3,
    reimburse: 'reimbursed',
  }),
  record({
    id: '20260713-001',
    date: '2026-07-13',
    merchant: '全家便利店',
    category: 'shopping',
    description: '矿泉水',
    amount: 15,
    currency: 'CNY',
    reimburse: 'personal',
  }),
]

describe('filterExpenses', () => {
  it('无条件时返回全部', () => {
    expect(filterExpenses(records, {})).toHaveLength(3)
  })

  it('按分类筛选', () => {
    const out = filterExpenses(records, { category: 'transport' })
    expect(out.map(r => r.id)).toEqual(['20260712-002'])
  })

  it('按报销状态筛选', () => {
    expect(filterExpenses(records, { status: 'pending' })).toHaveLength(1)
  })

  it('按日期区间筛选（含边界）', () => {
    expect(filterExpenses(records, { from: '2026-07-13' })).toHaveLength(1)
    expect(filterExpenses(records, { from: '2026-07-12', to: '2026-07-12' })).toHaveLength(2)
  })

  it('关键词匹配商家、明细和分类名', () => {
    expect(filterExpenses(records, { q: 'joe' })).toHaveLength(1)
    expect(filterExpenses(records, { q: 'latte' })).toHaveLength(1)
    expect(filterExpenses(records, { q: '交通' })).toHaveLength(1)
    expect(filterExpenses(records, { q: '不存在' })).toHaveLength(0)
  })
})

describe('summarize', () => {
  it('分币种合计且无浮点误差', () => {
    const s = summarize(records)
    expect(s.count).toBe(3)
    expect(s.totals).toEqual([
      { currency: 'USD', amount: 80.8 },
      { currency: 'CNY', amount: 15 },
    ])
  })

  it('分类小计按金额倒序', () => {
    const s = summarize(records)
    expect(s.byCategory[0].category).toBe('transport')
    expect(s.byCategory[0].totals[0].amount).toBe(68.3)
  })

  it('逐日小计按日期正序', () => {
    const s = summarize(records)
    expect(s.byDate.map(d => d.date)).toEqual(['2026-07-12', '2026-07-13'])
    expect(s.byDate[0].count).toBe(2)
  })

  it('报销状态小计', () => {
    const s = summarize(records)
    const pending = s.byStatus.find(x => x.status === 'pending')
    expect(pending?.totals).toEqual([{ currency: 'USD', amount: 12.5 }])
  })

  it('空数据不报错', () => {
    const s = summarize([])
    expect(s.count).toBe(0)
    expect(s.totals).toEqual([])
  })

  it('主币种按笔数判定，不被大数值外币挤掉', () => {
    // 2 笔 USD + 1 笔大额 KRW：主币种应是 USD，排在 totals 首位
    const s = summarize([
      record({ id: '20260701-001', date: '2026-07-01', amount: 10, currency: 'USD' }),
      record({ id: '20260701-002', date: '2026-07-01', amount: 20, currency: 'USD' }),
      record({ id: '20260701-003', date: '2026-07-01', amount: 92550, currency: 'KRW', category: 'shopping' }),
    ])
    expect(s.totals[0]).toEqual({ currency: 'USD', amount: 30 })
    expect(s.totals[1]).toEqual({ currency: 'KRW', amount: 92550 })
    // 分类排序按主币种金额：dining($30) 在 shopping($0) 前面
    expect(s.byCategory[0].category).toBe('dining')
  })
})
