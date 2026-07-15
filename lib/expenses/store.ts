// =====================
// 台账读取（仅服务端：读文件系统）
// =====================

import { promises as fs } from 'fs'
import path from 'path'
import type { ExpenseLedger, ExpenseRecord } from './types'

const LEDGER_PATH = path.join(process.cwd(), 'data', 'expenses', 'records.json')

/** 读取全部票据记录，按消费日期/时间倒序（最新在前） */
export async function loadExpenses(): Promise<ExpenseRecord[]> {
  let raw: string
  try {
    raw = await fs.readFile(LEDGER_PATH, 'utf-8')
  } catch {
    return []
  }
  const ledger = JSON.parse(raw) as ExpenseLedger
  return [...(ledger.records ?? [])].sort((a, b) =>
    `${b.date} ${b.time ?? ''} ${b.id}`.localeCompare(`${a.date} ${a.time ?? ''} ${a.id}`)
  )
}
