'use client'

// 终局「名单」界面：只负责通用渲染。
// 所有带人物与剧情的文字都在 f.copy / f.people / f.hand 里由服务器下发——前端包是任何人都能打开看的，
// 而指认环节在终局之前，这里一个人名都不能写死。

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import type { FinaleCard, FinaleMark, FinalePerson, FinaleReveal, FinaleView, Who } from '@/engine/mystery/scenarios/swing-state/finaleTypes'
import { Countdown, RichText } from './ui'
import { SpeakButton, useAutoRead } from './Speech'

export default function FinalePanel({ view }: { view: SeatView }) {
  const f = view.finale as FinaleView | null
  if (!f) return <div className="mx-panel p-4 text-sm text-white/70">终局准备中……</div>
  const last = f.reveals[f.reveals.length - 1]
  return (
    <div className="space-y-3">
      <Header f={f} />
      <Board f={f} />
      {f.phase === 'intro' && <Intro f={f} />}
      {f.phase !== 'intro' && last && <Reveal r={last} idx={f.reveals.length - 1} latest />}
      {f.phase === 'orders' && (f.mySubmitted ? <Waiting f={f} /> : <Picker key={f.round} f={f} />)}
      {f.phase === 'deal' && <DealCard f={f} />}
      {f.phase === 'done' && f.copy.done && <div className="mx-panel p-3 text-sm text-white/80">{f.copy.done}</div>}
      <Goals view={view} />
      {f.phase !== 'intro' && <Rules f={f} defaultOpen={false} />}
      <History f={f} />
    </div>
  )
}

/** 结局页顶部：06:00 名单的最终样子 */
export function FinaleSummary({ view }: { view: SeatView }) {
  const f = view.finale as FinaleView | null
  if (!f || f.phase !== 'done') return null
  const last = f.reveals[f.reveals.length - 1]
  return (
    <div className="space-y-3">
      <Board f={f} />
      {last && <Reveal r={last} idx={f.reveals.length - 1} latest />}
    </div>
  )
}

function Header({ f }: { f: FinaleView }) {
  const c = f.copy
  const clock = f.phase === 'intro' ? c.introClock
    : f.phase === 'done' ? c.doneClock
      : f.phase === 'deal' ? c.dealClock
        : `第 ${f.round}/3 轮 · ${c.clocks[f.round - 1] ?? ''}`
  return (
    <div className="mx-chyron">
      <span className="mx-chyron-tag">{c.tag}</span>
      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm">
        <span className="font-black text-white">{c.title}</span>
        <span className="text-white/60">{clock}</span>
        <span className="ml-auto"><Countdown deadline={f.deadline} label="" /></span>
      </div>
    </div>
  )
}

// ───────── 名单：三个人，每人一排格子 ─────────

const MARK_STYLE: Record<FinaleMark['by'] | 'testimony', string> = {
  me: 'bg-sky-400 border-sky-200',
  other: 'bg-orange-400 border-orange-200',
  price: 'bg-red-500 border-red-300',
  testimony: 'bg-violet-500/60 border-violet-200 border-dashed',
}

function markStyle(m: FinaleMark) {
  return m.kind === 'testimony' ? MARK_STYLE.testimony : MARK_STYLE[m.by]
}

function Board({ f }: { f: FinaleView }) {
  const done = f.phase === 'done'
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {f.people.map(p => <PersonCard key={p.who} p={p} done={done} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60 px-1">
        <Legend cls={MARK_STYLE.me} text="你交的" />
        <Legend cls={MARK_STYLE.other} text="对方交的" />
        <Legend cls={MARK_STYLE.price} text="说漏嘴" />
        <Legend cls={MARK_STYLE.testimony} text={f.copy.testimonyHint} />
      </div>
    </div>
  )
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-sm border ${cls}`} />{text}</span>
}

function PersonCard({ p, done }: { p: FinalePerson; done: boolean }) {
  const counted = p.marks.filter(m => !m.void)
  const voided = p.marks.filter(m => m.void)
  const slots = Math.max(p.line, counted.length)
  const full = counted.length >= p.line
  const status = p.taken === true ? { text: '被带走', cls: 'bg-red-600 text-white' }
    : p.fled ? { text: '已出海', cls: 'bg-sky-600 text-white' }
      : p.taken === false ? { text: '平安', cls: 'bg-emerald-600 text-white' }
        : p.vouched ? { text: '有人担保', cls: 'bg-violet-600 text-white' }
          : full ? { text: '已满', cls: 'bg-red-500/80 text-white mx-flash' }
            : null
  return (
    <div className={`mx-panel-2 p-3 min-w-0 ${p.isMe ? 'ring-1 ring-sky-400/60' : ''} ${done && p.taken ? 'ring-2 ring-red-500' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl leading-none">{p.avatar}</span>
        <div className="min-w-0 flex-1">
          <div className="font-black text-[15px]" style={{ color: p.color }}>{p.name}{p.isMe && <span className="text-[11px] text-sky-300 ml-1">（你）</span>}</div>
          <div className="text-[11px] text-white/60">满 {p.line} 格会被带走</div>
        </div>
        {status && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${status.cls}`}>{status.text}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1" aria-label={`${p.name}：${counted.length} 格，满 ${p.line} 格会被带走`}>
        {Array.from({ length: slots }, (_, i) => {
          const m = counted[i]
          const over = i >= p.line
          return (
            <span
              key={i}
              title={m ? m.label : '空格'}
              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-black transition-all duration-500 ${m ? `${markStyle(m)} text-black/70` : 'border-white/25 bg-white/5'} ${over ? 'opacity-70' : ''}`}
            >
              {m ? (m.double ? '×2' : '') : ''}
            </span>
          )
        })}
        <span className="ml-1 self-center font-mono font-black text-white text-sm">{counted.length}/{p.line}</span>
      </div>
      {counted.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-white/70">
          {counted.map((m, i) => <li key={i} className="truncate">• {m.label}<span className="text-white/40">（{whoText(m)}）</span></li>)}
        </ul>
      )}
      {voided.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-white/35 line-through">
          {voided.map((m, i) => <li key={i} className="truncate">{m.label}</li>)}
        </ul>
      )}
    </div>
  )
}

function whoText(m: FinaleMark) {
  if (m.kind === 'testimony') return '交易时说的，他被带走就作废'
  if (m.kind === 'panic') return '交易时说漏的'
  return `第 ${m.round} 轮，${m.by === 'me' ? '你交的' : '对方交的'}`
}

// ───────── 开场说明 ─────────

function Intro({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [sent, setSent] = useState(false)
  const all = `${f.copy.intro}\n\n怎么玩：\n${f.copy.rules.join('\n')}`
  useAutoRead({ id: 'fin:intro', label: '终局怎么玩', text: all })
  return (
    <div className="space-y-3">
      <div className="mx-paper p-4 mx-serif text-[15px] leading-8 mx-in">
        <div className="flex justify-end mb-1"><SpeakButton id="fin:intro" label="终局怎么玩" text={all} tone="light" /></div>
        <RichText text={f.copy.intro} />
      </div>
      <Rules f={f} defaultOpen />
      {f.mySubmitted ? (
        <div className="mx-panel p-4 text-center text-emerald-300 font-bold">
          你已经准备好了。{f.otherSubmitted ? '' : '等对方看完规则……'}
        </div>
      ) : (
        <button
          className="mx-btn mx-btn-gold w-full !py-3 text-base"
          disabled={sent}
          onClick={() => {
            setSent(true)
            act({ type: 'finale', payload: { type: 'ready' } })
            setTimeout(() => setSent(false), 4000)
          }}
        >
          我看懂了，开始
        </button>
      )}
    </div>
  )
}

function Rules({ f, defaultOpen }: { f: FinaleView; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const text = f.copy.rules.join('\n')
  return (
    <div className="mx-panel-2 p-3">
      <div className="flex items-center gap-2">
        <button className="text-sm font-black text-[var(--mx-gold)] flex-1 text-left" onClick={() => setOpen(o => !o)}>
          📖 规则 {open ? '▴' : '▾'}
        </button>
        <SpeakButton id="fin:rules" label="终局规则" text={text} size="sm" />
      </div>
      {open && (
        <ol className="mt-2 space-y-1.5 text-[13px] text-white/85 list-decimal pl-5 leading-6">
          {f.copy.rules.map((r, i) => <li key={i}><RichText text={r} inline /></li>)}
        </ol>
      )}
    </div>
  )
}

function Goals({ view }: { view: SeatView }) {
  const [open, setOpen] = useState(false)
  if (view.me.goals.length === 0) return null
  const text = view.me.goals.map(g => `${g.points} 分：${g.text}`).join('\n')
  return (
    <div className="mx-panel-2 p-3">
      <div className="flex items-center gap-2">
        <button className="text-sm font-black text-[var(--mx-gold)] flex-1 text-left" onClick={() => setOpen(o => !o)}>
          🎯 你的目标 {open ? '▴' : '▾'}
        </button>
        <SpeakButton id="fin:goals" label="你的目标" text={text} size="sm" />
      </div>
      {open && (
        <ul className="mt-2 space-y-1">
          {view.me.goals.map(g => (
            <li key={g.id} className="text-[13px] text-white/85 flex gap-2">
              <span className="text-[var(--mx-gold)] font-mono shrink-0">+{g.points}</span>
              <span>{g.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ───────── 每轮：挑一份证据 ─────────

function PointChips({ card, people }: { card: FinaleCard; people: FinalePerson[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {card.points.map(w => {
        const p = people.find(x => x.who === w)
        if (!p) return null
        return (
          <span key={w} className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-black/30" style={{ color: p.color }}>
            {p.avatar} {p.name}{p.isMe ? '（你）' : ''}
          </span>
        )
      })}
    </span>
  )
}

function cardSpeech(card: FinaleCard, people: FinalePerson[]) {
  const names = card.points.map(w => people.find(p => p.who === w)?.name ?? '').filter(Boolean)
  return `${card.title}。说的是${card.about}。交出去，会给${names.join('和')}各填一格。\n${card.text}`
}

function Picker({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [pick, setPick] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [headline, setHeadline] = useState(false)
  const [recount, setRecount] = useState(false)
  const [flee, setFlee] = useState(false)
  const [confirm, setConfirm] = useState<'give' | 'pass' | null>(null)
  const [sent, setSent] = useState(false)
  const me = f.people.find(p => p.isMe)
  const item = (k: string) => f.items.find(i => i.kind === k)
  const canHeadline = !!item('headline') && !item('headline')!.used
  const canRecount = !!item('recount') && !item('recount')!.used
  const canFlee = !!item('yacht') && f.round === 3
  const card = f.hand.find(c => c.id === pick) ?? null

  function send(give: boolean) {
    setSent(true)
    act({
      type: 'finale',
      payload: { type: 'order', round: f.round, order: { card: give ? pick : null, headline: give && headline && canHeadline, recount: recount && canRecount, flee: flee && canFlee } },
    })
    setTimeout(() => setSent(false), 4000)
  }

  const prompt = `第 ${f.round} 轮。${f.copy.pickHint}`
  useAutoRead({ id: `fin:round:${f.round}`, label: `第 ${f.round} 轮`, text: prompt })

  return (
    <div className="mx-panel p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 text-[14px] text-white font-bold leading-6">{f.copy.pickHint}</div>
        <SpeakButton id={`fin:round:${f.round}`} label={`第 ${f.round} 轮`} text={prompt} size="sm" />
      </div>
      {f.hand.length === 0 && <div className="text-sm text-[var(--mx-muted)]">{f.copy.noCards}</div>}
      <div className="grid grid-cols-1 gap-2">
        {f.hand.map(c => {
          const on = pick === c.id
          const self = !!me && c.points.includes(me.who as Who)
          return (
            <div key={c.id} className={`rounded-xl border transition-all ${on ? 'border-[var(--mx-gold)] bg-[var(--mx-gold)]/10 ring-2 ring-[var(--mx-gold)]' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
              <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => { setPick(on ? null : c.id); setConfirm(null) }}>
                <span className="text-3xl leading-none">{c.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-white text-[15px]">{c.title}</span>
                  <span className="block text-[11px] text-white/50">{c.about}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/70">
                    指向：<PointChips card={c} people={f.people} />
                    {self && <span className="text-amber-300 font-bold">⚠️ 也会给你自己填一格</span>}
                  </span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 shrink-0 ${on ? 'bg-[var(--mx-gold)] border-[var(--mx-gold)]' : 'border-white/30'}`} aria-hidden />
              </button>
              <div className="flex items-center gap-2 px-3 pb-2">
                <button className="text-[11px] text-white/60 underline" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? '收起内容' : '看内容'}</button>
                <SpeakButton id={`fin:card:${c.id}`} label={c.title} text={() => cardSpeech(c, f.people)} size="sm" />
              </div>
              {open === c.id && <div className="px-3 pb-3 text-[13px] text-white/80 leading-6 whitespace-pre-wrap mx-serif">{c.text}</div>}
            </div>
          )
        })}
      </div>

      {(canHeadline || canRecount || canFlee) && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          {canHeadline && (
            <Toggle checked={headline && !!card} disabled={!card} onChange={setHeadline} icon={item('headline')!.icon} title={item('headline')!.title} text={item('headline')!.text} />
          )}
          {canRecount && <Toggle checked={recount} onChange={setRecount} icon={item('recount')!.icon} title={item('recount')!.title} text={item('recount')!.text} />}
          {canFlee && <Toggle checked={flee} onChange={setFlee} icon={item('yacht')!.icon} title={item('yacht')!.title} text={item('yacht')!.text} />}
        </div>
      )}
      {f.items.some(i => i.kind === 'lawyer') && (
        <div className="text-[11px] text-white/60">{item('lawyer')!.icon} {item('lawyer')!.title}：{item('lawyer')!.text}</div>
      )}

      {card && (
        <div className="rounded-lg bg-black/30 p-2.5 text-[13px] text-white/90">
          交出「{card.title}」后：{card.points.map(w => {
            const p = f.people.find(x => x.who === w)!
            return <span key={w} className="font-black mr-2" style={{ color: p.color }}>{p.name} +{headline && canHeadline ? 2 : 1}</span>
          })}
        </div>
      )}

      {confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-ghost" onClick={() => setConfirm(null)}>再想想</button>
          <button className="mx-btn mx-btn-red" disabled={sent} onClick={() => send(confirm === 'give')}>
            {confirm === 'give' ? `确定交出「${card?.title ?? ''}」` : '确定这一轮不交'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-ghost" disabled={sent} onClick={() => setConfirm('pass')}>这一轮不交</button>
          <button className="mx-btn mx-btn-gold" disabled={!card || sent} onClick={() => setConfirm('give')}>交给警长</button>
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, icon, title, text, disabled }: { checked: boolean; onChange: (v: boolean) => void; icon: string; title: string; text: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-[13px] ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <input type="checkbox" className="w-5 h-5 mt-0.5 accent-amber-400 shrink-0" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span><b className="text-white">{icon} 用「{title}」</b><span className="block text-[11px] text-white/60">{text}</span></span>
    </label>
  )
}

function Waiting({ f }: { f: FinaleView }) {
  return (
    <div className="mx-panel p-4 text-center space-y-1">
      <div className="text-emerald-300 font-bold">你这一轮已经选好了</div>
      <div className="text-xs text-[var(--mx-muted)]">{f.otherSubmitted ? '对方也选好了，正在揭晓……' : f.copy.waiting}</div>
    </div>
  )
}

// ───────── 中途的交易 ─────────

function DealCard({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [confirm, setConfirm] = useState<'accept' | 'refuse' | null>(null)
  const [sent, setSent] = useState(false)
  const d = f.copy.deal
  const text = `${d.intro}\n\n${d.terms.join('\n')}\n\n${d.note}`
  useAutoRead({ id: 'fin:deal', label: '交易', text })
  const mine = f.deal?.myChoice
  return (
    <div className="mx-panel p-4 space-y-3 border border-violet-400/40">
      <div className="flex justify-end"><SpeakButton id="fin:deal" label="交易" text={text} /></div>
      <div className="mx-serif text-[15px] text-white/90 leading-7"><RichText text={d.intro} /></div>
      <ul className="space-y-2 text-[13px] text-white/85 leading-6">
        {d.terms.map((t, i) => <li key={i} className="rounded-lg bg-black/25 p-2"><RichText text={t} inline /></li>)}
      </ul>
      <div className="text-[12px] text-white/60">{d.note}</div>
      {mine ? (
        <div className="text-center text-emerald-300 text-sm font-bold">
          你已经回复了：{mine === 'accept' ? d.accept : d.refuse}。{f.otherSubmitted ? '正在揭晓……' : '等对方……'}
        </div>
      ) : confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-ghost" onClick={() => setConfirm(null)}>再想想</button>
          <button
            className={`mx-btn ${confirm === 'accept' ? 'mx-btn-red' : 'mx-btn-blue'}`}
            disabled={sent}
            onClick={() => {
              setSent(true)
              act({ type: 'finale', payload: { type: 'deal', choice: confirm } })
              setTimeout(() => setSent(false), 4000)
            }}
          >
            确定{confirm === 'accept' ? d.accept : d.refuse}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-red !py-3" onClick={() => setConfirm('accept')}>{d.accept}</button>
          <button className="mx-btn mx-btn-blue !py-3" onClick={() => setConfirm('refuse')}>{d.refuse}</button>
        </div>
      )}
    </div>
  )
}

// ───────── 揭晓与经过 ─────────

function Reveal({ r, idx, latest }: { r: FinaleReveal; idx: number; latest?: boolean }) {
  const text = `${r.title}\n${r.lines.join('\n')}`
  useAutoRead(latest ? { id: `fin:rev:${idx}`, label: r.title, text } : null)
  return (
    <div className={`p-3 rounded-xl ${latest ? 'bg-red-900/30 border border-red-400/40 mx-in' : 'bg-black/20'}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="text-[13px] font-black text-red-200 flex-1">{r.title}</div>
        <SpeakButton id={`fin:rev:${idx}`} label={r.title} text={text} size="sm" />
      </div>
      <ul className="space-y-1 text-[13px] text-white/90 leading-6">
        {r.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  )
}

function History({ f }: { f: FinaleView }) {
  const [open, setOpen] = useState(false)
  const past = f.reveals.slice(0, -1)
  if (past.length === 0) return null
  return (
    <div className="mx-panel-2 p-3">
      <button className="text-sm font-black text-white/80 w-full text-left" onClick={() => setOpen(o => !o)}>
        🗒️ 之前的经过 {open ? '▴' : '▾'}
      </button>
      {open && <div className="mt-2 space-y-2">{past.map((r, i) => <Reveal key={i} r={r} idx={i} />)}</div>}
    </div>
  )
}
