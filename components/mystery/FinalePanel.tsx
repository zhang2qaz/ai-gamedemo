'use client'

// 终局「计票」界面：只负责通用渲染。
// 所有带人物与剧情的文字都在 f.copy 里由服务器下发——前端包是任何人都能打开看的，
// 而指认环节在终局之前，这里一个人名都不能写死。

import { useMemo, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import type { FinaleOrder, FinaleView, RaceId } from '@/engine/mystery/scenarios/swing-state/finaleTypes'
import { Countdown, Money, RichText } from './ui'

const RACE_COLOR: Record<RaceId, string> = { R1: '#f472b6', R2: '#60a5fa', R3: '#e8c26a' }

const EMPTY: FinaleOrder = { cast: [], burn: null, will: null, pr: null, headline: null, recount: false, flee: false }

const ITEM = { lawyer: 'item_lawyer', headline: 'item_headline', recount: 'item_recount', yacht: 'item_yacht' } as const

export default function FinalePanel({ view }: { view: SeatView }) {
  const f = view.finale as FinaleView | null
  if (!f) return <div className="mx-panel p-4 text-sm text-white/70">终局准备中……</div>
  return (
    <div className="space-y-3">
      <Header f={f} />
      <Scoreboard f={f} />
      {f.phase === 'deal' && <DealCard f={f} />}
      {f.phase === 'orders' && (f.mySubmitted ? <Waiting f={f} /> : <OrderBuilder key={f.round} f={f} />)}
      {f.phase === 'done' && f.copy.done && <div className="mx-panel p-3 text-sm text-white/80">{f.copy.done}</div>}
      <History f={f} />
      <Rules f={f} />
    </div>
  )
}

function Header({ f }: { f: FinaleView }) {
  const c = f.copy
  const clock = c.clocks[f.round - 1] ?? ''
  return (
    <div className="mx-chyron">
      <span className="mx-chyron-tag">{c.tag}</span>
      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm">
        <span className="font-black text-white">{c.title}</span>
        <span className="text-white/60">
          {f.phase === 'done' ? c.doneClock : f.phase === 'deal' ? c.dealClock : `第 ${f.round}/3 轮 · ${clock}`}
        </span>
        <span className="ml-auto"><Countdown deadline={f.deadline} label="" /></span>
      </div>
    </div>
  )
}

function Scoreboard({ f }: { f: FinaleView }) {
  const c = f.copy
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {f.races.map(r => {
        const max = Math.max(r.truth, r.claim, 1)
        const winning = r.truth >= r.claim
        return (
          <div key={r.id} className="mx-panel-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-black" style={{ color: RACE_COLOR[r.id] }}>{r.title}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${winning ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {winning ? c.truthLabel : c.claimLabel}领先
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <Bar label={c.truthLabel} value={r.truth} max={max} color="#34d399" />
              <Bar label={c.claimLabel} value={r.claim} max={max} color="#f87171" />
            </div>
            <div className="text-[10px] text-[var(--mx-muted)] mt-1">{c.claimTextLabel}：{r.claimText}</div>
          </div>
        )
      })}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-10 text-white/60 truncate">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Math.max(0, value) / max) * 100}%`, background: color }} />
      </div>
      <span className="w-5 text-right font-mono font-bold text-white">{value}</span>
    </div>
  )
}

function Waiting({ f }: { f: FinaleView }) {
  return (
    <div className="mx-panel p-4 text-center space-y-1">
      <div className="text-emerald-300 font-bold">你的命令已锁定</div>
      <div className="text-xs text-[var(--mx-muted)]">{f.otherSubmitted ? '对方也已锁定，正在揭晓……' : f.copy.waiting}</div>
    </div>
  )
}

/** 按最新视图清理命令：手牌、道具、现金等变了，已选但不再可用的部分自动去掉 */
function sanitize(o: FinaleOrder, f: FinaleView): FinaleOrder {
  const inHand = new Set(f.hand.map(h => h.id))
  const item = (id: string) => f.items.find(i => i.id === id)
  const cast = o.cast.filter(id => inHand.has(id)).slice(0, f.maxCast)
  const burn = o.burn && inHand.has(o.burn) && !cast.includes(o.burn) ? o.burn : null
  const headlineOk = !!item(ITEM.headline) && !item(ITEM.headline)!.used
  return {
    cast,
    burn,
    will: f.holdsWill ? o.will : null,
    pr: o.pr && f.money >= f.prCost ? o.pr : null,
    headline: headlineOk && o.headline && cast.includes(o.headline) ? o.headline : null,
    recount: o.recount && !!item(ITEM.recount) && !item(ITEM.recount)!.used,
    flee: o.flee && !!item(ITEM.yacht) && f.round === 3,
  }
}

function OrderBuilder({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [raw, setO] = useState<FinaleOrder>(EMPTY)
  const [confirm, setConfirm] = useState(false)
  // 点了「锁定」之后到服务器回应之前不能再点：重复的命令会被当成下一轮的命令
  const [sent, setSent] = useState(false)
  const o = sanitize(raw, f)
  const c = f.copy
  const items = useMemo(() => Object.fromEntries(f.items.map(i => [i.id, i])), [f.items])
  const headlineOk = !!items[ITEM.headline] && !items[ITEM.headline].used
  const recountOk = !!items[ITEM.recount] && !items[ITEM.recount].used
  const yachtOk = !!items[ITEM.yacht] && f.round === 3

  function change(fn: (prev: FinaleOrder) => FinaleOrder) {
    setConfirm(false)
    setO(prev => fn(sanitize(prev, f)))
  }
  function toggleCast(id: string) {
    change(prev => {
      const has = prev.cast.includes(id)
      const cast = has ? prev.cast.filter(x => x !== id) : prev.cast.length < f.maxCast ? [...prev.cast, id] : prev.cast
      return { ...prev, cast, burn: prev.burn === id ? null : prev.burn, headline: prev.headline && cast.includes(prev.headline) ? prev.headline : null }
    })
  }
  function toggleBurn(id: string) {
    change(prev => ({ ...prev, burn: prev.burn === id ? null : id, cast: prev.cast.filter(x => x !== id), headline: prev.headline === id ? null : prev.headline }))
  }

  const sideLabel = (side: 'truth' | 'claim') => (side === 'truth' ? c.truthLabel : c.claimLabel)
  const summary: string[] = []
  for (const id of o.cast) {
    const h = f.hand.find(x => x.id === id)
    if (h) summary.push(`递交「${h.title}」${o.headline === id ? '（头版 ×2）' : ''}`)
  }
  if (o.burn) summary.push(`销毁「${f.hand.find(h => h.id === o.burn)?.title}」`)
  if (o.will) summary.push(o.will === 'submit' ? c.will.submitted : c.will.burned)
  if (o.pr) summary.push(`花 $${f.prCost.toLocaleString('en-US')}：${f.races.find(r => r.id === o.pr!.race)?.title}「${sideLabel(o.pr.side)}」+1`)
  if (o.recount) summary.push('布置「重新计票」')
  if (o.flee) summary.push('出海逃亡')

  return (
    <div className="mx-panel p-3 space-y-3">
      <div className="text-sm font-black text-white">秘密下令 · 第 {f.round} 轮</div>
      {f.immune && <div className="text-[12px] text-emerald-300">{c.immune}</div>}

      <div>
        <div className="text-[11px] text-[var(--mx-muted)] mb-1.5">{c.handHint}</div>
        {f.hand.length === 0 && <div className="text-[12px] text-white/40">你手里没有证据了。</div>}
        <div className="grid gap-1.5">
          {f.hand.map(h => {
            const casting = o.cast.includes(h.id)
            const burning = o.burn === h.id
            return (
              <div key={h.id} className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 ${casting ? 'border-emerald-400/70 bg-emerald-500/10' : burning ? 'border-red-400/70 bg-red-500/10' : 'border-white/10 bg-black/20'}`}>
                <span className="text-xl">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate">{h.title}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5 text-[10px]">
                    <span className="px-1.5 rounded font-bold" style={{ background: `${RACE_COLOR[h.race]}33`, color: RACE_COLOR[h.race] }}>
                      {f.races.find(r => r.id === h.race)?.title} +{h.weight}
                    </span>
                    {h.implicates.map(w => <span key={w} className="px-1.5 rounded bg-white/10 text-white/70">指向{w}</span>)}
                    {h.searchable && <span className="px-1.5 rounded bg-red-500/20 text-red-200">{c.searchableTag}</span>}
                  </div>
                </div>
                <button className={`mx-btn !py-1 !px-2 text-[11px] ${casting ? 'mx-btn-blue' : 'mx-btn-ghost'}`} onClick={() => toggleCast(h.id)}>{casting ? '✓ 递交' : '递交'}</button>
                <button className={`mx-btn !py-1 !px-2 text-[11px] ${burning ? 'mx-btn-red' : 'mx-btn-ghost'}`} onClick={() => toggleBurn(h.id)}>{burning ? '🔥 销毁' : '销毁'}</button>
              </div>
            )
          })}
        </div>
      </div>

      {f.holdsWill && (
        <div className="rounded-lg border border-lime-400/40 bg-lime-500/5 p-2.5">
          <div className="text-[13px] font-bold text-lime-200">{c.will.title}</div>
          <div className="text-[11px] text-white/60 mb-1.5">{c.will.hint}</div>
          <div className="flex gap-1.5">
            {([[null, c.will.keep], ['submit', c.will.submit], ['burn', c.will.burn]] as const).map(([v, l]) => (
              <button key={l} className={`mx-btn !py-1 !px-2.5 text-[11px] ${o.will === v ? (v === 'burn' ? 'mx-btn-red' : 'mx-btn-gold') : 'mx-btn-ghost'}`} onClick={() => change(prev => ({ ...prev, will: v }))}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 p-2.5">
          <div className="text-[12px] font-bold text-white">📣 舆论（花 <Money value={f.prCost} />，你有 <Money value={f.money} />）</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <button className={`mx-btn !py-1 !px-2 text-[11px] ${!o.pr ? 'mx-btn-gold' : 'mx-btn-ghost'}`} onClick={() => change(p => ({ ...p, pr: null }))}>不用</button>
            {f.money >= f.prCost && f.races.map(r => (['truth', 'claim'] as const).map(side => (
              <button key={r.id + side} className={`mx-btn !py-1 !px-2 text-[11px] ${o.pr?.race === r.id && o.pr.side === side ? 'mx-btn-gold' : 'mx-btn-ghost'}`}
                onClick={() => change(p => ({ ...p, pr: { race: r.id, side } }))}>
                {r.title}·{sideLabel(side)}+1
              </button>
            )))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 p-2.5 space-y-1.5">
          <div className="text-[12px] font-bold text-white">🎁 道具</div>
          {f.items.length === 0 && <div className="text-[11px] text-white/40">你没有拍到道具。</div>}
          {items[ITEM.lawyer] && <div className="text-[11px] text-white/70">{c.items.lawyer}</div>}
          {headlineOk && (
            <div className="text-[11px] text-white/70 flex flex-wrap items-center gap-1">{c.items.headline}
              {o.cast.length === 0 ? <span className="text-white/40">先选要递交的证据</span> : o.cast.map(id => (
                <button key={id} className={`mx-btn !py-0.5 !px-2 text-[11px] ${o.headline === id ? 'mx-btn-gold' : 'mx-btn-ghost'}`} onClick={() => change(p => ({ ...p, headline: p.headline === id ? null : id }))}>
                  {f.hand.find(h => h.id === id)?.title} ×2
                </button>
              ))}
            </div>
          )}
          {recountOk && (
            <label className="text-[11px] text-white/70 flex items-center gap-1.5">
              <input type="checkbox" checked={o.recount} onChange={e => { const v = e.target.checked; change(p => ({ ...p, recount: v })) }} />
              {c.items.recount}
            </label>
          )}
          {yachtOk && (
            <label className="text-[11px] text-red-200 flex items-center gap-1.5">
              <input type="checkbox" checked={o.flee} onChange={e => { const v = e.target.checked; change(p => ({ ...p, flee: v })) }} />
              {c.items.yacht}
            </label>
          )}
        </div>
      </div>

      {confirm ? (
        <div className="space-y-2">
          <div className="text-[12px] text-white/80 bg-black/30 rounded-lg p-2">{summary.length ? summary.join('；') : '本轮不出手'}</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="mx-btn mx-btn-ghost" disabled={sent} onClick={() => setConfirm(false)}>再想想</button>
            <button
              className="mx-btn mx-btn-red"
              disabled={sent}
              onClick={() => {
                setSent(true)
                act({ type: 'finale', payload: { type: 'order', round: f.round, order: sanitize(raw, f) } })
                // 出错（如网络未连）时允许重试
                setTimeout(() => setSent(false), 4000)
              }}
            >
              {sent ? '已发出…' : '锁定命令'}
            </button>
          </div>
        </div>
      ) : (
        <button className="mx-btn mx-btn-red w-full" onClick={() => setConfirm(true)}>锁定第 {f.round} 轮命令</button>
      )}
    </div>
  )
}

function DealCard({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [pick, setPick] = useState<'accept' | 'refuse' | null>(null)
  const [sent, setSent] = useState(false)
  const d = f.deal!
  const c = f.copy.deal
  return (
    <div className="mx-paper p-4 space-y-3 mx-in">
      <div className="mx-serif text-[15px] leading-7"><RichText text={c.intro} /></div>
      <div className="text-[13px] leading-6 bg-black/5 rounded-lg p-3 space-y-1">
        {c.terms.map((t, i) => <div key={i}><RichText text={t} /></div>)}
        <div className="text-[12px] opacity-70">{c.note}</div>
      </div>
      {d.myChoice ? (
        <div className="text-center text-sm font-bold">你已经回复：{d.myChoice === 'accept' ? '接受' : '拒绝'}。{f.otherSubmitted ? '' : '等待对方……'}</div>
      ) : pick ? (
        <div className="space-y-2">
          <div className="text-center text-sm">你选择了<b>{pick === 'accept' ? '接受' : '拒绝'}</b>。回复之后不能更改。</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="mx-btn mx-btn-ghost !text-[var(--mx-paper-ink)] !bg-black/5" disabled={sent} onClick={() => setPick(null)}>再想想</button>
            <button
              className={`mx-btn ${pick === 'accept' ? 'mx-btn-red' : 'mx-btn-blue'}`}
              disabled={sent}
              onClick={() => {
                setSent(true)
                act({ type: 'finale', payload: { type: 'deal', choice: pick } })
                setTimeout(() => setSent(false), 4000)
              }}
            >
              {sent ? '已发出…' : '确认回复'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-blue" onClick={() => setPick('refuse')}>拒绝</button>
          <button className="mx-btn mx-btn-red" onClick={() => setPick('accept')}>接受</button>
        </div>
      )}
    </div>
  )
}

function History({ f }: { f: FinaleView }) {
  if (f.history.length === 0) return null
  const labels = f.copy.historyLabels
  return (
    <div className="mx-panel-2 p-3 space-y-2">
      <div className="text-xs font-black text-[var(--mx-gold)]">计票记录</div>
      {[...f.history].reverse().map((h, i) => (
        <div key={i} className="text-[12px] leading-5">
          <div className="text-white/50 font-bold">{h.round === 1.5 ? labels.deal : h.round === 4 ? labels.sheriff : `第 ${h.round} 轮`}</div>
          {h.lines.map((l, j) => <div key={j} className="text-white/85">{l}</div>)}
        </div>
      ))}
    </div>
  )
}

function Rules({ f }: { f: FinaleView }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-panel-2 p-3 text-[12px] leading-6 text-white/75">
      <button className="font-bold text-white/90" onClick={() => setOpen(!open)}>📖 规则 {open ? '▲' : '▼'}</button>
      {open && (
        <div className="mt-2 space-y-1">
          {f.copy.rules.map((r, i) => <p key={i}>· <RichText text={r} inline /></p>)}
        </div>
      )}
    </div>
  )
}
