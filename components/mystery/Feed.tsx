'use client'

import { useEffect, useRef, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { LogEntry, SeatView } from '@/engine/mystery/types'
import { SpeakButton } from './Speech'

const QUICK = ['我先说说我知道的', '你在撒谎', '证据呢？', '我们交换线索吧', '先别急着公开', '我同意']
/** 给小学生的快捷话：不说"你在撒谎" */
const QUICK_KIDS = ['我先说我知道的', '我找到一条线索！', '证据呢？', '那时候你在哪儿？', '你的话对不上', '我觉得是……']

function nameOf(view: SeatView, from: LogEntry['from']) {
  if (from === 'DM') return 'DM'
  const p = view.players[from]
  const role = p ? view.roles.find(r => r.id === p.roleId) : undefined
  return role ? role.name : (p?.name ?? from)
}

export default function Feed({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const view = useMysteryStore(s => s.view)!
  const act = useMysteryStore(s => s.act)
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'all' | 'chat' | 'dm'>('all')
  const box = useRef<HTMLDivElement>(null)

  const entries = view.log.filter(e =>
    filter === 'all' ? true : filter === 'chat' ? e.kind === 'chat' : e.kind !== 'chat',
  )

  // 有新记录、或从隐藏切到可见时滚到底（display:none 时设置 scrollTop 无效，所以切回来要再滚一次）
  const lastId = entries[entries.length - 1]?.id ?? 0
  useEffect(() => {
    const el = box.current
    if (el && active) el.scrollTop = el.scrollHeight
  }, [lastId, active, filter])

  function send(t?: string) {
    const msg = (t ?? text).trim()
    if (!msg) return
    act({ type: 'chat', text: msg })
    if (!t) setText('')
  }

  return (
    <div className={`mx-panel flex flex-col ${compact ? 'h-[48dvh]' : 'h-full min-h-[320px]'}`}>
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-white/5">
        <span className="text-xs font-bold text-white/80 mr-auto">现场记录</span>
        {(['all', 'chat', 'dm'] as const).map(f => (
          <button key={f} className="mx-tab !py-1 !px-2 !text-[11px]" data-active={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? '全部' : f === 'chat' ? '对话' : 'DM'}
          </button>
        ))}
      </div>
      <div ref={box} className="flex-1 mx-scroll px-3 py-2 space-y-2 text-[13px]">
        {entries.length === 0 && <div className="text-center text-[var(--mx-muted)] text-xs py-6">暂无记录</div>}
        {entries.map(e => <Entry key={e.id} e={e} view={view} />)}
      </div>
      <div className="border-t border-white/5 p-2 space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(view.scenario.theme === 'kids' ? QUICK_KIDS : QUICK).map(q => (
            <button key={q} onClick={() => send(q)} className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white">
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={e => { e.preventDefault(); send() }}
        >
          <input
            className="mx-input !py-2 lg:text-sm"
            value={text}
            maxLength={300}
            placeholder="对大家说点什么…"
            onChange={e => setText(e.target.value)}
          />
          <button className="mx-btn mx-btn-blue !py-2 text-sm shrink-0" disabled={!text.trim()}>发送</button>
        </form>
      </div>
    </div>
  )
}

function Entry({ e, view }: { e: LogEntry; view: SeatView }) {
  const time = new Date(e.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (e.kind === 'chat') {
    const from = e.from
    const mine = from === view.seat
    const role = from !== 'DM' ? view.roles.find(r => r.id === view.players[from]?.roleId) : undefined
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${mine ? 'bg-[var(--mx-blue)]/30 rounded-br-sm' : 'bg-white/8 bg-white/10 rounded-bl-sm'}`}>
          <div className="text-[10px] font-bold mb-0.5 flex items-center gap-1" style={{ color: role?.color }}>
            <span className="flex-1">{nameOf(view, e.from)} · {time}</span>
            {!mine && <SpeakButton id={`log:${e.id}`} label={`${nameOf(view, e.from)}说`} size="sm" text={`${nameOf(view, e.from)}说：${e.text}`} />}
          </div>
          <div className="text-white/90 whitespace-pre-wrap break-words">{e.text}</div>
        </div>
      </div>
    )
  }
  if (e.kind === 'system') {
    return (
      <div className="text-[12px] text-[var(--mx-gold)]/90 whitespace-pre-wrap border-l-2 border-[var(--mx-gold)]/50 pl-2 flex gap-1">
        <span className="flex-1">{e.text}</span><SpeakButton id={`log:${e.id}`} label="DM" size="sm" className="self-start" text={e.text} />
      </div>
    )
  }
  if (e.kind === 'event') {
    return (
      <div className="text-[12px] text-red-200 whitespace-pre-wrap border-l-2 border-[var(--mx-red)] pl-2 flex gap-1">
        <span className="flex-1">{e.text}</span><SpeakButton id={`log:${e.id}`} label="DM" size="sm" className="self-start" text={e.text} />
      </div>
    )
  }
  return (
    <div className="text-[12px] text-sky-100/90 whitespace-pre-wrap bg-[var(--mx-blue-soft)] rounded-lg px-2.5 py-1.5 flex gap-1">
      <span className="flex-1">
        <span className="text-[10px] font-black text-sky-300 mr-1">{view.scenario.theme === 'kids' ? (e.to === 'all' ? '主持人' : '主持人悄悄说') : (e.to === 'all' ? 'DM' : 'DM·私')}</span>
        {e.text}
      </span>
      <SpeakButton id={`log:${e.id}`} label="DM" size="sm" className="self-start" text={e.text} />
    </div>
  )
}
