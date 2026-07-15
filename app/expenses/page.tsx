import { loadExpenses } from '@/lib/expenses/store'
import ExpenseDashboard from '@/components/expenses/ExpenseDashboard'

// 台账随新票据入账而变化，每次请求都读最新数据
export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const records = await loadExpenses()
  return <ExpenseDashboard records={records} />
}
