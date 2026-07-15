import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '纽约行程 · 发票开销台账',
  description: '发票、小票、报销单据的自动归档与实时查询',
}

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
