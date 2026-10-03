'use client'

import type { SeatView } from '@/engine/mystery/types'

// 终局大机制面板（剧本特定，待实现）
export default function FinalePanel({ view }: { view: SeatView }) {
  return <div className="mx-panel p-4 text-sm text-white/70">终局：{view.step.title}</div>
}
