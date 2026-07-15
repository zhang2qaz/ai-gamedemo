import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadExpenses } from '@/lib/expenses/store'
import {
  CATEGORIES,
  REIMBURSE_STATUS,
  formatAmount,
  type ExpenseRecord,
} from '@/lib/expenses/types'

export const dynamic = 'force-dynamic'

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <div className="w-24 shrink-0 text-sm text-stone-500">{label}</div>
      <div className="text-sm text-stone-200">{value}</div>
    </div>
  )
}

function money(r: ExpenseRecord, v?: number): string | undefined {
  return v === undefined ? undefined : formatAmount(v, r.currency)
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const records = await loadExpenses()
  const record = records.find(r => r.id === id)
  if (!record) notFound()

  const category = CATEGORIES[record.category]
  const status = REIMBURSE_STATUS[record.reimburse]

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/expenses" className="text-sm text-stone-400 hover:text-stone-200">
        ← 返回台账
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-stone-100">{record.merchant}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-stone-800/80 px-2 py-0.5 text-xs text-stone-300">
            <span aria-hidden>{category.emoji}</span>
            {category.label}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
            <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
            {status.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-400">{record.description}</p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
        <div className="text-xs text-stone-400">实付总额</div>
        <div className="mt-1 text-4xl font-semibold text-stone-100">
          {formatAmount(record.amount, record.currency)}
        </div>
        <div className="mt-3 divide-y divide-white/5">
          <Field label="编号" value={record.id} />
          <Field label="消费时间" value={`${record.date}${record.time ? ` ${record.time}` : ''}`} />
          <Field label="商家说明" value={record.merchantNote} />
          <Field label="地点" value={record.location} />
          <Field label="小计" value={money(record, record.subtotal)} />
          <Field label="税费" value={money(record, record.tax)} />
          <Field label="小费" value={money(record, record.tip)} />
          <Field
            label="支付方式"
            value={
              record.paymentMethod &&
              `${record.paymentMethod}${record.cardLast4 ? `（尾号 ${record.cardLast4}）` : ''}`
            }
          />
          <Field label="报销备注" value={record.reimburseNote} />
          <Field label="备注" value={record.notes} />
          <Field label="录入时间" value={record.recordedAt.replace('T', ' ').slice(0, 16)} />
        </div>
      </section>

      {record.items && record.items.length > 0 && (
        <section className="mb-4 rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-100">消费明细</h2>
          <ul className="divide-y divide-white/5">
            {record.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-stone-300">
                  {item.name}
                  {item.quantity !== undefined && item.quantity !== 1 && (
                    <span className="text-stone-500"> × {item.quantity}</span>
                  )}
                </span>
                <span className="text-stone-200" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(record, item.amount) ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {record.receipts.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-stone-900/75 px-5 py-4">
          <h2 className="mb-3 text-sm font-semibold text-stone-100">票据原件</h2>
          <div className="space-y-3">
            {record.receipts.map(src => (
              <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
                {/* 票据照片尺寸不一，直接用原图展示 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${record.merchant} 票据照片`}
                  className="w-full rounded-lg border border-white/10"
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
