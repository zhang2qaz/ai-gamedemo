'use client'

import { useMemo, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import type { FinaleOrder, FinaleView, RaceId } from '@/engine/mystery/scenarios/swing-state/finaleTypes'
import { Countdown, Money } from './ui'

const RACE_COLOR: Record<RaceId | 'will', string> = { R1: '#f472b6', R2: '#60a5fa', R3: '#e8c26a', will: '#a3e635' }

const EMPTY: FinaleOrder = { cast: [], burn: null, will: null, pr: null, headline: null, recount: false, flee: false }

export default function FinalePanel({ view }: { view: SeatView }) {
  const f = view.finale as FinaleView | null
  if (!f) return <div className="mx-panel p-4 text-sm text-white/70">终局准备中……</div>
  return (
    <div className="space-y-3">
      <Header f={f} />
      <Scoreboard f={f} />
      {f.phase === 'deal' && <DealCard f={f} />}
      {f.phase === 'orders' && (f.mySubmitted ? <Waiting f={f} /> : <OrderBuilder key={f.round} f={f} />)}
      {f.phase === 'done' && <Done f={f} />}
      <History f={f} />
      <Rules />
    </div>
  )
}

function Header({ f }: { f: FinaleView }) {
  const clock = ['05:00', '05:20', '05:40'][f.round - 1] ?? '06:00'
  return (
    <div className="mx-chyron">
      <span className="mx-chyron-tag">RECOUNT</span>
      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm">
        <span className="font-black text-white">黎明计票</span>
        <span className="text-white/60">
          {f.phase === 'done' ? '06:00 · 计票结束' : f.phase === 'deal' ? '05:20 · 普莱斯的交易' : `第 ${f.round}/3 轮 · ${clock}`}
        </span>
        <span className="ml-auto"><Countdown deadline={f.deadline} label="" /></span>
      </div>
    </div>
  )
}

function Scoreboard({ f }: { f: FinaleView }) {
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {f.races.map(r => {
        const max = Math.max(r.truth, r.price, 1)
        const winning = r.truth >= r.price
        return (
          <div key={r.id} className="mx-panel-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-black" style={{ color: RACE_COLOR[r.id] }}>{r.title}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${winning ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {winning ? '真相领先' : '普莱斯领先'}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <Bar label="真相" value={r.truth} max={max} color="#34d399" />
              <Bar label="普莱斯" value={r.price} max={max} color="#f87171" />
            </div>
            <div className="text-[10px] text-[var(--mx-muted)] mt-1">普莱斯的说法：{r.cover}</div>
          </div>
        )
      })}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-10 text-white/60">{label}</span>
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
      <div className="text-xs text-[var(--mx-muted)]">{f.otherSubmitted ? '对方也已锁定，正在揭晓……' : '等待对方下令……（你们可以在右侧的记录里谈判）'}</div>
    </div>
  )
}

function OrderBuilder({ f }: { f: FinaleView }) {
  const act = useMysteryStore(s => s.act)
  const [o, setO] = useState<FinaleOrder>(EMPTY)
  const [confirm, setConfirm] = useState(false)
  const items = useMemo(() => Object.fromEntries(f.items.map(i => [i.id, i])), [f.items])
  const headlineOk = items.item_headline && !items.item_headline.used
  const recountOk = items.item_recount && !items.item_recount.used
  const yachtOk = !!items.item_yacht && f.round === 3

  function toggleCast(id: string) {
    setConfirm(false)
    setO(prev => {
      const has = prev.cast.includes(id)
      const cast = has ? prev.cast.filter(x => x !== id) : prev.cast.length < f.maxCast ? [...prev.cast, id] : prev.cast
      return { ...prev, cast, burn: prev.burn === id ? null : prev.burn, headline: prev.headline && cast.includes(prev.headline) ? prev.headline : null }
    })
  }
  function toggleBurn(id: string) {
    setConfirm(false)
    setO(prev => ({ ...prev, burn: prev.burn === id ? null : id, cast: prev.cast.filter(x => x !== id), headline: prev.headline === id ? null : prev.headline }))
  }

  const summary: string[] = []
  for (const id of o.cast) {
    const c = f.hand.find(h => h.id === id)
    if (c) summary.push(`递交「${c.title}」${o.headline === id ? '（头版 ×2）' : ''}`)
  }
  if (o.burn) summary.push(`销毁「${f.hand.find(h => h.id === o.burn)?.title}」`)
  if (o.will) summary.push(o.will === 'submit' ? '把遗嘱交给律师' : '烧掉遗嘱')
  if (o.pr) summary.push(`花 $2,000：${f.races.find(r => r.id === o.pr!.race)?.title}「${o.pr.side === 'truth' ? '真相' : '普莱斯'}」+1`)
  if (o.recount) summary.push('布置「重新计票」')
  if (o.flee) summary.push('出海逃亡')

  return (
    <div className="mx-panel p-3 space-y-3">
      <div className="text-sm font-black text-white">秘密下令 · 第 {f.round} 轮</div>
      {f.immune && <div className="text-[12px] text-emerald-300">普莱斯答应过：在你的案子里，你是清白的（豁免）。</div>}

      <div>
        <div className="text-[11px] text-[var(--mx-muted)] mb-1.5">你手里的证据（选票）· 每轮最多递交 {f.maxCast} 份、销毁 1 份。标「会被搜出」的若留到 06:00，会被警长从你身上搜出来。</div>
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
                    {h.searchable && <span className="px-1.5 rounded bg-red-500/20 text-red-200">会被搜出</span>}
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
          <div className="text-[13px] font-bold text-lime-200">📜 吉迪恩的遗嘱原件在你手里</div>
          <div className="text-[11px] text-white/60 mb-1.5">交给律师即生效（不占递交名额）。留到 06:00 也会被警长找到并交给律师；烧掉则遗产归普雷斯顿。</div>
          <div className="flex gap-1.5">
            {([[null, '先留着'], ['submit', '交给律师'], ['burn', '烧掉']] as const).map(([v, l]) => (
              <button key={l} className={`mx-btn !py-1 !px-2.5 text-[11px] ${o.will === v ? (v === 'burn' ? 'mx-btn-red' : 'mx-btn-gold') : 'mx-btn-ghost'}`} onClick={() => { setConfirm(false); setO(prev => ({ ...prev, will: v })) }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 p-2.5">
          <div className="text-[12px] font-bold text-white">📣 舆论（花 <Money value={f.prCost} />，你有 <Money value={f.money} />）</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <button className={`mx-btn !py-1 !px-2 text-[11px] ${!o.pr ? 'mx-btn-gold' : 'mx-btn-ghost'}`} onClick={() => setO(p => ({ ...p, pr: null }))}>不用</button>
            {f.money >= f.prCost && f.races.map(r => (['truth', 'price'] as const).map(side => (
              <button key={r.id + side} className={`mx-btn !py-1 !px-2 text-[11px] ${o.pr?.race === r.id && o.pr.side === side ? 'mx-btn-gold' : 'mx-btn-ghost'}`}
                onClick={() => { setConfirm(false); setO(p => ({ ...p, pr: { race: r.id, side } })) }}>
                {r.title}·{side === 'truth' ? '真相' : '普莱斯'}+1
              </button>
            )))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 p-2.5 space-y-1.5">
          <div className="text-[12px] font-bold text-white">🎁 道具</div>
          {f.items.length === 0 && <div className="text-[11px] text-white/40">你没有拍到道具。</div>}
          {items.item_lawyer && <div className="text-[11px] text-white/70">⚖️ 律师名片：结算时自动生效（一级谋杀降为较轻的罪名）。</div>}
          {headlineOk && (
            <div className="text-[11px] text-white/70 flex flex-wrap items-center gap-1">🗞️ 头版：
              {o.cast.length === 0 ? <span className="text-white/40">先选要递交的证据</span> : o.cast.map(id => (
                <button key={id} className={`mx-btn !py-0.5 !px-2 text-[11px] ${o.headline === id ? 'mx-btn-gold' : 'mx-btn-ghost'}`} onClick={() => setO(p => ({ ...p, headline: p.headline === id ? null : id }))}>
                  {f.hand.find(h => h.id === id)?.title} ×2
                </button>
              ))}
            </div>
          )}
          {recountOk && (
            <label className="text-[11px] text-white/70 flex items-center gap-1.5">
              <input type="checkbox" checked={o.recount} onChange={e => setO(p => ({ ...p, recount: e.target.checked }))} />
              🔍 布置重新计票：作废对方本轮递交的最强一张（优先指向你的）
            </label>
          )}
          {yachtOk && (
            <label className="text-[11px] text-red-200 flex items-center gap-1.5">
              <input type="checkbox" checked={o.flee} onChange={e => setO(p => ({ ...p, flee: e.target.checked }))} />
              🛥️ 出海逃亡：不再被起诉，但放弃遗产（本轮的其他命令照常执行）
            </label>
          )}
        </div>
      </div>

      {confirm ? (
        <div className="space-y-2">
          <div className="text-[12px] text-white/80 bg-black/30 rounded-lg p-2">{summary.length ? summary.join('；') : '本轮不出手'}</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="mx-btn mx-btn-ghost" onClick={() => setConfirm(false)}>再想想</button>
            <button className="mx-btn mx-btn-red" onClick={() => act({ type: 'finale', payload: { type: 'order', order: o } })}>锁定命令</button>
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
  const d = f.deal!
  return (
    <div className="mx-paper p-4 space-y-3 mx-in">
      <div className="mx-serif text-[15px] leading-7">
        走廊尽头，普莱斯医生压低声音，像所有人的好外公：
        <br />
        &ldquo;孩子，你我都知道今晚发生了什么。只要你点头，我会告诉警长<b>你</b>是清白的。至于另一个人……我会说出我&lsquo;看到&rsquo;的。&rdquo;
      </div>
      <div className="text-[13px] leading-6 bg-black/5 rounded-lg p-3">
        <b>接受</b>：你在「{d.myRaceTitle}」里豁免；普莱斯会在「{d.otherRaceTitle}」里指证对方（真相 +3，指向对方）；2000 年一案普莱斯 +2。<br />
        <b>拒绝</b>：如果你们两个都拒绝，普莱斯会乱了阵脚——2000 年一案「普莱斯」−4。<br />
        <b>但如果你们都接受</b>——他会把你们两个都卖掉：各自的案子真相 +2 并指向你们，2000 年一案普莱斯 +3，谁也不豁免。<br />
        <span className="text-[12px] opacity-70">对方收到的是同样的提议。你们可以先商量——但对方最后选什么，只有揭晓时才知道。</span>
      </div>
      {d.myChoice ? (
        <div className="text-center text-sm font-bold">你已经回复普莱斯：{d.myChoice === 'accept' ? '接受' : '拒绝'}。{f.otherSubmitted ? '' : '等待对方……'}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-blue" onClick={() => act({ type: 'finale', payload: { type: 'deal', choice: 'refuse' } })}>拒绝</button>
          <button className="mx-btn mx-btn-red" onClick={() => act({ type: 'finale', payload: { type: 'deal', choice: 'accept' } })}>接受</button>
        </div>
      )}
    </div>
  )
}

function Done({ f }: { f: FinaleView }) {
  const o = f.outcome
  if (!o) return null
  return (
    <div className="mx-panel p-3 text-sm text-white/80">
      计票结束。{o.prevails.R3 ? '2000 年一案重新立案。' : '2000 年一案维持"意外"。'}{o.priceArrested ? '普莱斯医生被捕。' : '普莱斯医生全身而退。'}
      <span className="text-[var(--mx-muted)]">（结局即将揭晓）</span>
    </div>
  )
}

function History({ f }: { f: FinaleView }) {
  if (f.history.length === 0) return null
  return (
    <div className="mx-panel-2 p-3 space-y-2">
      <div className="text-xs font-black text-[var(--mx-gold)]">计票记录</div>
      {[...f.history].reverse().map((h, i) => (
        <div key={i} className="text-[12px] leading-5">
          <div className="text-white/50 font-bold">{h.round === 1.5 ? '05:20 · 交易' : h.round === 4 ? '06:00 · 警长' : `第 ${h.round} 轮`}</div>
          {h.lines.map((l, j) => <div key={j} className="text-white/85">{l}</div>)}
        </div>
      ))}
    </div>
  )
}

function Rules() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mx-panel-2 p-3 text-[12px] leading-6 text-white/75">
      <button className="font-bold text-white/90" onClick={() => setOpen(!open)}>📖 规则 {open ? '▲' : '▼'}</button>
      {open && (
        <div className="mt-2 space-y-1">
          <p>· 三场计票：罗丝之死、吉迪恩之死、2000 年林梅之死。每场「真相」≥「普莱斯」即真相成立，否则按普莱斯的说法结案。</p>
          <p>· 你<b>手里持有</b>的带终局标记的线索就是选票（公开过、但仍在你手里的也算；交给对方的不算）。</p>
          <p>· 每轮同时秘密下令：最多递交 2 份、销毁 1 份、舆论 1 次（$2,000，任一案件任一方 +1）。递交的证据会公开它指向谁。</p>
          <p>· 每轮揭晓后，普莱斯在「真相」增长最多的一案 +2（平局优先 2000 年、罗丝、吉迪恩）。</p>
          <p>· 05:20 普莱斯的交易：见交易说明。</p>
          <p>· 06:00 警长搜身：你手里仍持有的、牵连你自己的物证/文件会被搜出（各计 1 票）。口供与证人证词搜不出来。</p>
          <p>· 起诉：你的案子（曼迪＝罗丝之死，伊森＝吉迪恩之死）真相成立、你被某张证据指向、且未被豁免 → 被起诉。若普莱斯也被指向，罪名减轻（过失致死 / 二级谋杀）。</p>
          <p>· 普莱斯被捕：2000 年一案真相成立，或你们的案子真相成立且指向了他。</p>
          <p>· 遗嘱：交给律师或在 06:00 被警长找到即生效。伊森若因吉迪恩之死被起诉，依佛州“杀人者不得继承”规定失去份额。</p>
        </div>
      )}
    </div>
  )
}
