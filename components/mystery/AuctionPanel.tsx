'use client'

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import { Money, RichText } from './ui'

export default function AuctionPanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const a = view.auction
  const [bids, setBids] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState(false)
  if (!a) return null

  const total = Object.values(bids).reduce((n, v) => n + v, 0)
  const over = total > view.me.money
  const invalid = a.lots.some(l => (bids[l.id] ?? 0) > 0 && (bids[l.id] ?? 0) < l.min)

  function step(id: string, delta: number, min: number) {
    setConfirm(false)
    setBids(prev => {
      const cur = prev[id] ?? 0
      let next = cur + delta
      if (delta > 0 && cur === 0) next = min
      if (next < min) next = 0
      return { ...prev, [id]: Math.max(0, next) }
    })
  }

  return (
    <div className="space-y-3">
      {view.step.text && <div className="mx-paper p-4 mx-serif text-[14px]"><RichText text={view.step.text} /></div>}

      {a.results ? (
        <div className="space-y-2">
          <div className="text-sm font-black text-[var(--mx-gold)]">🔨 拍卖结果</div>
          {a.lots.map(l => {
            const r = a.results!.find(x => x.lot === l.id)!
            return (
              <div key={l.id} className="mx-panel-2 p-3 flex items-center gap-3">
                <span className="text-2xl">{l.itemIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{l.title}</div>
                  <div className="text-[11px] text-[var(--mx-muted)]">你出 <Money value={r.myBid} /> · 对方出 <Money value={r.otherBid} /></div>
                </div>
                <div className="text-right text-xs font-bold">
                  {r.winner === 'me' && <span className="text-emerald-300">你拍得 · <Money value={r.price} /></span>}
                  {r.winner === 'other' && <span className="text-sky-300">对方拍得</span>}
                  {r.winner === null && (r.tie ? <span className="text-red-300">平局 · 被维克多截走</span> : <span className="text-white/40">流拍</span>)}
                </div>
              </div>
            )
          })}
          <div className="text-xs text-[var(--mx-muted)]">拍到的道具已放进你的「线索」，终局时可以使用。点上方「继续」进入下一幕。</div>
        </div>
      ) : a.myBids ? (
        <div className="mx-panel p-4 text-center space-y-1">
          <div className="text-emerald-300 font-bold">暗标已交给拍卖师</div>
          <div className="text-xs text-[var(--mx-muted)]">{a.otherSubmitted ? '对方也已出价，正在揭晓……' : '等待对方出价……'}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">你的现金 <Money value={view.me.money} /></span>
            <span className={over ? 'text-red-300 font-bold' : 'text-white/70'}>合计出价 <Money value={total} className={over ? '!text-red-300' : ''} /></span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {a.lots.map(l => {
              const v = bids[l.id] ?? 0
              return (
                <div key={l.id} className="mx-panel-2 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-3xl">{l.itemIcon}</span>
                    <div className="min-w-0">
                      <div className="font-black text-white leading-5">{l.title}</div>
                      <div className="text-[12px] text-white/65 leading-5 mt-0.5">{l.desc}</div>
                      <div className="text-[11px] text-[var(--mx-gold)] mt-0.5">道具：{l.itemTitle} · 起拍 <Money value={l.min} /></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, -500, l.min)}>−500</button>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, -100, l.min)}>−100</button>
                    <div className="flex-1 min-w-[72px] text-center font-mono font-black text-lg whitespace-nowrap">{v === 0 ? <span className="text-white/35 text-sm">放弃</span> : <Money value={v} />}</div>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, 100, l.min)}>+100</button>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, 500, l.min)}>+500</button>
                  </div>
                </div>
              )
            })}
          </div>
          {confirm ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="mx-btn mx-btn-ghost" onClick={() => setConfirm(false)}>再想想</button>
              <button className="mx-btn mx-btn-gold" onClick={() => act({ type: 'bid', bids })}>确认暗标（不可更改）</button>
            </div>
          ) : (
            <button className="mx-btn mx-btn-gold w-full" disabled={over || invalid} onClick={() => setConfirm(true)}>
              {over ? '合计超过现金' : '交出暗标'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
