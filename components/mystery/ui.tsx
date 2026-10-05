'use client'

import { useEffect, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'

/** 服务器时钟对齐的倒计时（秒） */
export function useCountdown(deadline: number | null): number | null {
  const skew = useMysteryStore(s => s.clockSkew)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [deadline])
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - (now + skew)) / 1000))
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Countdown({ deadline, label = '剩余' }: { deadline: number | null; label?: string }) {
  const left = useCountdown(deadline)
  if (left === null) return null
  const urgent = left <= 30
  return (
    <span
      className={`font-mono text-sm font-bold tabular-nums px-2 py-0.5 rounded-md whitespace-nowrap ${urgent ? 'bg-red-600/80 text-white mx-flash' : 'bg-white/10 text-white'}`}
      title="阶段倒计时（到时 DM 自动推进）"
    >
      ⏱ {label} {formatClock(left)}
    </span>
  )
}

export function Money({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`font-mono font-bold text-[var(--mx-gold)] ${className}`}>${value.toLocaleString('en-US')}</span>
}

/** 极简富文本：空行分段；以「## 」开头为小标题；**粗体** */
export function RichText({ text, className = '', inline = false }: { text: string; className?: string; inline?: boolean }) {
  if (inline) return <span className={className}>{renderInline(text)}</span>
  const blocks = text.split(/\n{2,}|\r\n\r\n/)
  return (
    <div className={`mx-script ${className}`}>
      {blocks.map((b, i) => {
        const t = b.trim()
        if (!t) return null
        if (t.startsWith('## ')) return <h4 key={i}>{t.slice(3)}</h4>
        return <p key={i}>{renderInline(t)}</p>
      })}
    </div>
  )
}

function renderInline(t: string) {
  const parts = t.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-black">{p.slice(2, -2)}</strong>
      : <span key={i}>{p.split('\n').map((line, j, arr) => <span key={j}>{line}{j < arr.length - 1 ? <br /> : null}</span>)}</span>,
  )
}

export function Toasts() {
  const toasts = useMysteryStore(s => s.toasts)
  const dismiss = useMysteryStore(s => s.dismissToast)
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(92vw,420px)] pointer-events-none">
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto mx-in text-sm px-4 py-2.5 rounded-xl shadow-lg text-left ${t.tone === 'error' ? 'bg-red-700/95 text-white' : 'bg-slate-800/95 text-white'}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}

export function ConnectionBadge() {
  const online = useMysteryStore(s => s.online)
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${online ? 'text-emerald-400' : 'text-red-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
      {online ? '已连线' : '重连中…'}
    </span>
  )
}
