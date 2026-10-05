'use client'

// 终局「名单」界面：只负责通用渲染。
// 所有带人物与剧情的文字都在 f.copy / f.people / f.hand 里由服务器下发——前端包是任何人都能打开看的，
// 而指认环节在终局之前，这里一个人名都不能写死。

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import type { FinaleCard, FinaleMark, FinalePerson, FinaleReveal, FinaleView } from '@/engine/mystery/scenarios/swing-state/finaleTypes'
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
      {f.phase !== 'intro' && last && <Reveal r={last} idx={f.reveals.length - 1} auto />}
      {f.phase === 'orders' && (f.mySubmitted ? <Waiting f={f} /> : <Picker key={f.round} f={f} />)}
      {f.phase === 'deal' && <DealCard f={f} />}
      {f.phase === 'done' && f.copy.done && <div className="mx-panel p-3 text-sm text-white/80">{f.copy.done}</div>}
      <Goals f={f} />
      {f.phase !== 'intro' && <Rules f={f} defaultOpen={false} />}
      <History f={f} />
    </div>
  )
}

/** 结局页顶部：06:00 名单的最终样子，以及最后一轮和警长到场的经过 */
export function FinaleSummary({ view }: { view: SeatView }) {
  const f = view.finale as FinaleView | null
  if (!f || f.phase !== 'done') return null
  // 最后一轮的揭晓和 06:00 是同一时刻发生的：两段都在这里显示并朗读
  const tail = f.reveals.map((r, i) => ({ r, i })).filter(x => x.r.round >= 3)
  return (
    <div className="space-y-3">
      <Board f={f} />
      {tail.map(({ r, i }) => <Reveal key={i} r={r} idx={i} auto />)}
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
      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm min-w-0">
        <span className="font-black text-white">{c.title}</span>
        <span className="text-white/60 truncate">{clock}</span>
        <span className="ml-auto"><Countdown deadline={f.deadline} label="" /></span>
      </div>
    </div>
  )
}

// ───────── 名单：每个人一排格子 ─────────

const MARK_STYLE = {
  me: 'bg-sky-400 border-sky-200',
  other: 'bg-orange-400 border-orange-200',
  accused: 'bg-violet-500/60 border-violet-200 border-dashed',
  panic: 'bg-red-500 border-red-300',
} as const

function markStyle(m: FinaleMark) {
  if (m.kind === 'accused') return MARK_STYLE.accused
  if (m.kind === 'panic') return MARK_STYLE.panic
  return m.by === 'me' ? MARK_STYLE.me : MARK_STYLE.other
}

/** 名单现状，一句一句说给小朋友听 */
function boardSpeech(f: FinaleView) {
  return f.people.map(p => {
    const name = p.isMe ? `你，${p.name}` : p.name
    if (p.taken === true) return `${name}：被警长带走了。`
    if (p.fled) return `${name}：已经出海了。`
    if (p.confessed) return `${name}：已经认罪，06:00 会被带走。`
    if (p.taken === false) return `${name}：平安，没有被带走。`
    const left = p.line - p.count
    const extra = p.lineParts.vouch ? `（${f.copy.vouchedBy}${p.isMe ? '你' : '这个人'}，所以要 ${p.line} 格）` : ''
    return `${name}：${p.count} 格${extra}，${left > 0 ? `还差 ${left} 格就会被带走` : '已经满了'}。`
  }).join('\n')
}

function Board({ f }: { f: FinaleView }) {
  const done = f.phase === 'done'
  const L = f.copy.legend
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className="text-[12px] text-white/70 flex-1">名单：谁的格子填满了，06:00 警长就带走谁。</div>
        <SpeakButton id={`fin:board:${f.reveals.length}`} label="名单现在的样子" size="sm" text={() => boardSpeech(f)} />
      </div>
      {/* 每张卡至少 200px 宽，放不下就换行（电脑上右边还有记录栏，左边并不宽） */}
      <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {f.people.map(p => <PersonCard key={p.who} p={p} done={done} vouchLabel={f.copy.vouchShort} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60 px-1">
        <Legend cls={MARK_STYLE.me} text={L.me} />
        <Legend cls={MARK_STYLE.other} text={L.other} />
        <Legend cls={MARK_STYLE.accused} text={L.accused} />
        <Legend cls={MARK_STYLE.panic} text={L.panic} />
      </div>
    </div>
  )
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block w-3 h-3 rounded-sm border ${cls}`} />{text}</span>
}

function PersonCard({ p, done, vouchLabel }: { p: FinalePerson; done: boolean; vouchLabel: string }) {
  const counted = p.marks.filter(m => !m.void)
  const voided = p.marks.filter(m => m.void)
  const slots = Math.max(p.line, counted.length)
  const full = counted.length >= p.line
  const status = p.taken === true ? { text: p.confessed ? '认罪 · 被带走' : '被带走', cls: 'bg-red-600 text-white' }
    : p.fled ? { text: '已出海', cls: 'bg-sky-600 text-white' }
      : p.taken === false ? { text: '平安', cls: 'bg-emerald-600 text-white' }
        : p.confessed ? { text: '已认罪', cls: 'bg-red-600/80 text-white' }
          : full ? { text: '已满', cls: 'bg-red-500/80 text-white' }
            : null
  const extras = [
    p.lineParts.lawyer ? `律师名片 +${p.lineParts.lawyer}` : '',
    p.lineParts.vouch ? `${vouchLabel} +${p.lineParts.vouch}` : '',
  ].filter(Boolean)
  return (
    <div className={`mx-panel-2 p-3 min-w-0 ${p.isMe ? 'ring-1 ring-sky-400/60' : ''} ${done && p.taken ? 'ring-2 ring-red-500' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl leading-none">{p.avatar}</span>
        <div className="min-w-0 flex-1">
          <div className="font-black text-[15px]" style={{ color: p.color }}>{p.name}{p.isMe && <span className="text-[11px] text-sky-300 ml-1">（你）</span>}</div>
          <div className="text-[11px] text-white/60">
            满 {p.line} 格会被带走{extras.length > 0 && <span className="text-white/45">（{extras.join('，')}）</span>}
          </div>
        </div>
        {status && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${status.cls}`}>{status.text}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1" aria-label={`${p.name}：${counted.length} 格，满 ${p.line} 格会被带走`}>
        {Array.from({ length: slots }, (_, i) => {
          const m = counted[i]
          return (
            <span
              key={i}
              title={m ? m.label : '空格'}
              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-[10px] font-black transition-all duration-500 ${m ? `${markStyle(m)} text-black/70` : 'border-white/25 bg-white/5'} ${i >= p.line ? 'opacity-70' : ''}`}
            >
              {m?.double ? '×2' : ''}
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
  if (m.kind === 'accused') return '交易时被告的'
  if (m.kind === 'panic') return '交易时他自己说漏的'
  return `第 ${m.round} 轮，${m.by === 'me' ? '你交的' : `${m.from ?? '别人'}交的`}`
}

// ───────── 开场说明、目标、规则 ─────────

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
          你已经准备好了。{f.waitingFor.length ? `等${f.waitingFor.join('、')}看完规则……` : ''}
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

function Goals({ f }: { f: FinaleView }) {
  const [open, setOpen] = useState(false)
  const text = `这一局你怎么得分：\n${f.copy.goals.map(g => `${g.points} 分：${g.text}`).join('\n')}`
  return (
    <div className="mx-panel-2 p-3">
      <div className="flex items-center gap-2">
        <button className="text-sm font-black text-[var(--mx-gold)] flex-1 text-left" onClick={() => setOpen(o => !o)}>
          🎯 你怎么得分 {open ? '▴' : '▾'}
        </button>
        <SpeakButton id="fin:goals" label="你怎么得分" text={text} size="sm" />
      </div>
      {open && (
        <ul className="mt-2 space-y-1">
          {f.copy.goals.map((g, i) => (
            <li key={i} className="text-[13px] text-white/85 flex gap-2">
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

function personOf(f: FinaleView, w: string) {
  return f.people.find(p => p.who === w)
}

/** 交出去会怎样（一句话，界面和朗读共用） */
function effectText(card: FinaleCard, f: FinaleView, double: boolean) {
  const k = double ? 2 : 1
  const name = (w: string) => {
    const p = personOf(f, w)
    return p ? (p.isMe ? `你自己（${p.name}）` : p.name) : ''
  }
  if (card.confessor) {
    const c = personOf(f, card.confessor)
    const who = c?.isMe ? '你' : c?.name ?? ''
    const price = card.points.map(name)[0] ?? ''
    return `这是认罪：交出去，06:00 警长一定会带走${who}；${price} +${2 * k} 格。`
  }
  const targets = card.points.map(name)
  return targets.length === 1 ? `交出去：${targets[0]} +${k} 格。` : `交出去：${targets.join('和')}各 +${k} 格。`
}

function cardSpeech(card: FinaleCard, f: FinaleView) {
  const me = f.people.find(p => p.isMe)
  const risky = !!me && (card.points.includes(me.who) || card.confessor === me.who)
  return `${card.title}。说的是${card.about}。${card.why}\n${effectText(card, f, false)}${risky ? '小心，这份会算到你自己头上！' : ''}`
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

  // 每轮开始念一遍：现在名单怎样、你手里有哪些证据、各自交出去会怎样
  const prompt = `第 ${f.round} 轮。${f.copy.pickHint}\n${boardSpeech(f)}\n${f.hand.length ? `你手里有 ${f.hand.length} 份证据：\n${f.hand.map(c => `${c.title}，${effectText(c, f, false)}`).join('\n')}` : f.copy.noCards}`
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
          const self = !!me && (c.points.includes(me.who) || c.confessor === me.who)
          return (
            <div key={c.id} className={`rounded-xl border transition-all ${on ? 'border-[var(--mx-gold)] bg-[var(--mx-gold)]/10 ring-2 ring-[var(--mx-gold)]' : c.confessor ? 'border-red-400/40 bg-red-950/30 hover:bg-red-900/30' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
              <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => { setPick(on ? null : c.id); setConfirm(null) }}>
                <span className="text-3xl leading-none">{c.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-white text-[15px]">{c.title}{c.confessor && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-red-600 text-white align-middle">认罪</span>}</span>
                  <span className="block text-[11px] text-white/50">{c.about}</span>
                  <span className="block text-[12px] text-white/75 mt-1 leading-5">{c.why}</span>
                  <span className={`block text-[12px] mt-1 font-bold ${self ? 'text-amber-300' : 'text-white/85'}`}>
                    {self && '⚠️ '}{effectText(c, f, false)}
                  </span>
                </span>
                <span className={`w-6 h-6 rounded-full border-2 shrink-0 ${on ? 'bg-[var(--mx-gold)] border-[var(--mx-gold)]' : 'border-white/30'}`} aria-hidden />
              </button>
              <div className="flex items-center gap-2 px-3 pb-2">
                <button className="text-[11px] text-white/60 underline" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? '收起原文' : '看原文'}</button>
                <SpeakButton id={`fin:card:${c.id}`} label={c.title} text={() => cardSpeech(c, f)} size="sm" />
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
      {item('lawyer') && (
        <div className="text-[11px] text-white/60">{item('lawyer')!.icon} {item('lawyer')!.title}：{item('lawyer')!.text}</div>
      )}

      {card && (
        <div className="rounded-lg bg-black/30 p-2.5 text-[13px] text-white/90">
          「{card.title}」——{effectText(card, f, headline && canHeadline)}
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
      <div className="text-xs text-[var(--mx-muted)]">{f.waitingFor.length ? f.copy.waiting : '大家都选好了，正在揭晓……'}</div>
      {f.waitingFor.length > 0 && <div className="text-xs text-white/60">还在选：{f.waitingFor.join('、')}</div>}
    </div>
  )
}

// ───────── 中途的交易 ─────────

function DealCard({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [confirm, setConfirm] = useState<'accept' | 'refuse' | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const d = f.copy.deal
  const text = `${d.intro}\n\n${d.terms.join('\n')}\n\n${d.note}`
  useAutoRead({ id: 'fin:deal', label: '交易', text })
  const mine = f.deal?.myChoice
  const targets = f.deal?.targets ?? []
  const nameOf = (w: string | null | undefined) => targets.find(t => t.who === w)?.name ?? ''
  const waiting = f.waitingFor.length ? `等${f.waitingFor.join('、')}……` : '正在揭晓……'
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
          你已经回复了：{mine === 'accept' ? `${d.accept}（让他告${nameOf(f.deal?.myTarget)}）` : d.refuse}。{waiting}
        </div>
      ) : confirm === 'accept' && !target ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-white flex-1">{d.pickTarget}</div>
            <SpeakButton id="fin:deal:target" label="让他去告谁" size="sm" text={`${d.pickTarget}\n${targets.map(t => t.name).join('，')}`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {targets.map(t => (
              <button key={t.who} className="mx-btn mx-btn-ghost !py-3 flex items-center justify-center gap-2" onClick={() => setTarget(t.who)}>
                <span className="text-2xl leading-none">{t.avatar}</span>{t.name}
              </button>
            ))}
          </div>
          <button className="mx-btn mx-btn-ghost w-full" onClick={() => setConfirm(null)}>再想想</button>
        </div>
      ) : confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-ghost" onClick={() => { setConfirm(null); setTarget(null) }}>再想想</button>
          <button
            className={`mx-btn ${confirm === 'accept' ? 'mx-btn-red' : 'mx-btn-blue'}`}
            disabled={sent}
            onClick={() => {
              setSent(true)
              act({ type: 'finale', payload: { type: 'deal', choice: confirm, ...(confirm === 'accept' && target ? { target } : {}) } })
              setTimeout(() => setSent(false), 4000)
            }}
          >
            {confirm === 'accept' ? `确定${d.accept}，让他告${nameOf(target)}` : `确定${d.refuse}`}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-red !py-3" onClick={() => { setTarget(null); setConfirm('accept') }}>{d.accept}</button>
          <button className="mx-btn mx-btn-blue !py-3" onClick={() => setConfirm('refuse')}>{d.refuse}</button>
        </div>
      )}
    </div>
  )
}

// ───────── 揭晓与经过 ─────────

function Reveal({ r, idx, auto }: { r: FinaleReveal; idx: number; auto?: boolean }) {
  const text = `${r.title}\n${r.lines.join('\n')}`
  useAutoRead(auto ? { id: `fin:rev:${idx}`, label: r.title, text } : null)
  return (
    <div className={`p-3 rounded-xl ${auto ? 'bg-red-900/30 border border-red-400/40 mx-in' : 'bg-black/20'}`}>
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
