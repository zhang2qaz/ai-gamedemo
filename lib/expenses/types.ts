// =====================
// 纽约行程 · 发票开销台账 — 类型与常量
// =====================

/** 开销分类（新增分类时同步更新 EXPENSES.md 的分类标准） */
export const CATEGORIES = {
  dining: { label: '餐饮', emoji: '🍽️' },
  transport: { label: '交通', emoji: '🚕' },
  lodging: { label: '住宿', emoji: '🏨' },
  shopping: { label: '购物', emoji: '🛍️' },
  entertainment: { label: '娱乐', emoji: '🎭' },
  telecom: { label: '通讯', emoji: '📱' },
  medical: { label: '医疗', emoji: '💊' },
  office: { label: '办公会务', emoji: '💼' },
  fees: { label: '手续费杂费', emoji: '🧾' },
  other: { label: '其他', emoji: '📦' },
} as const

export type CategoryKey = keyof typeof CATEGORIES

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[]

/** 报销状态流转：待报销 → 已提交 → 已报销；个人支出不参与报销 */
export const REIMBURSE_STATUS = {
  pending: { label: '待报销', color: '#fab219' },
  submitted: { label: '已提交', color: '#3987e5' },
  reimbursed: { label: '已报销', color: '#0ca30c' },
  personal: { label: '个人支出', color: '#898781' },
} as const

export type ReimburseStatus = keyof typeof REIMBURSE_STATUS

export const REIMBURSE_KEYS = Object.keys(REIMBURSE_STATUS) as ReimburseStatus[]

/** 记录来源：小票拍照识别 / 银行流水补录（线上消费等无小票场景） */
export type RecordSource = 'receipt' | 'bank'

/** 票据上的单个明细行 */
export interface ExpenseItem {
  name: string
  quantity?: number
  /** 单项金额（原币种，票面为准） */
  amount?: number
}

/** 一张票据对应一条记录 */
export interface ExpenseRecord {
  /** 唯一编号：消费日期 + 当日序号，如 "20260712-001" */
  id: string
  /** 消费日期 YYYY-MM-DD（以票面为准） */
  date: string
  /** 消费时间 HH:mm（票面可辨认时填写） */
  time?: string
  /** 商家名称（票面原文） */
  merchant: string
  /** 商家中文说明 */
  merchantNote?: string
  category: CategoryKey
  /** 一句话中文摘要 */
  description: string
  items?: ExpenseItem[]
  /** 实付总额（含税、含小费） */
  amount: number
  /** ISO 4217 币种代码：USD、CNY… */
  currency: string
  subtotal?: number
  tax?: number
  tip?: number
  /** 支付方式，如 "Visa 信用卡"、"现金"、"Apple Pay" */
  paymentMethod?: string
  cardLast4?: string
  /** 消费地点 */
  location?: string
  /** 票据照片路径（public 下），如 "/receipts/20260712-001.jpg" */
  receipts: string[]
  reimburse: ReimburseStatus
  reimburseNote?: string
  notes?: string
  /** 记录来源，缺省视为 'receipt'（小票拍照） */
  source?: RecordSource
  /** 已与银行流水核对一致 */
  bankVerified?: boolean
  /** 对账备注：待核对重点、金额出入的更正说明等 */
  bankNote?: string
  /** 录入时间 ISO 8601 */
  recordedAt: string
}

/** 台账文件 data/expenses/records.json 的结构 */
export interface ExpenseLedger {
  trip: string
  records: ExpenseRecord[]
}

/** 按币种格式化金额，如 $128.50 / ¥99.00 */
export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}
