'use client'

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import { Money, RichText, moneyText, seatName } from './ui'
import { SpeakButton } from './Speech'

export default function AuctionPanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const a = view.auction
  const [bids, setBids] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState(false)
  const [sent, setSent] = useState(false)
  if (!a) return null

  const who = (seat: typeof view.seat) => (seat === view.seat ? '你' : seatName(view, seat))
  const waitingFor = view.seats.filter(s => s !== view.seat && !a.submitted.includes(s)).map(s => seatName(view, s))
  const kids = view.scenario.theme === 'kids'
  // 加减按钮：美元一次 100 / 500；橡果一次 1 / 3
  const small = view.scenario.currency?.step ?? 100
  const big = view.scenario.currency ? small * 3 : 500
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
      {view.step.text && (
        <div className="mx-paper p-4 mx-serif text-[14px]">
          <div className="flex justify-end mb-1"><SpeakButton id={`step:${view.step.id}`} label={view.step.title} text={view.step.text} tone="light" /></div>
          <RichText text={view.step.text} />
        </div>
      )}

      {a.results ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-black text-[var(--mx-gold)] flex-1">🔨 拍卖结果</div>
            <SpeakButton
              id="auction:results"
              label="拍卖结果"
              size="sm"
              text={() => a.lots.map(l => {
                const r = a.results!.find(x => x.lot === l.id)!
                return `${l.title}：${r.winner === view.seat ? `你拍到了，花了${moneyText(view, r.price, true)}` : r.winner ? `${who(r.winner)}拍到了` : r.tie ? a.tieLabel : '没人要'}。`
              }).join('\n')}
            />
          </div>
          {a.lots.map(l => {
            const r = a.results!.find(x => x.lot === l.id)!
            return (
              <div key={l.id} className="mx-panel-2 p-3 flex items-center gap-3">
                <span className="text-2xl">{l.itemIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm truncate">{l.title}</div>
                  <div className="text-[11px] text-[var(--mx-muted)] flex flex-wrap gap-x-2">
                    {view.seats.map(s => <span key={s} className="whitespace-nowrap">{who(s)}出 <Money value={r.bids[s] ?? 0} /></span>)}
                  </div>
                </div>
                <div className="text-right text-xs font-bold shrink-0">
                  {r.winner === view.seat && <span className="text-emerald-300">你拍得 · <Money value={r.price} /></span>}
                  {r.winner && r.winner !== view.seat && <span className="text-sky-300">{who(r.winner)}拍得</span>}
                  {r.winner === null && (r.tie ? <span className="text-red-300">{a.tieLabel}</span> : <span className="text-white/40">{kids ? '没人要' : '流拍'}</span>)}
                </div>
              </div>
            )
          })}
          <div className="text-xs text-[var(--mx-muted)]">{view.scenario.theme === 'kids'
            ? '买到的东西在你的「线索」里，找线索的时候用得上。点上面的「继续」进入下一步。'
            : '拍到的道具已放进你的「线索」，终局时可以使用。点上方「继续」进入下一幕。'}</div>
        </div>
      ) : a.myBids ? (
        <div className="mx-panel p-4 text-center space-y-1">
          <div className="text-emerald-300 font-bold">{kids ? '你的出价已经偷偷交好了' : '暗标已交给拍卖师'}</div>
          <div className="text-xs text-[var(--mx-muted)]">{waitingFor.length === 0 ? '大家都出价了，正在揭晓……' : `等待 ${waitingFor.join('、')} 出价……`}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/70">{view.scenario.currency ? '你有' : '你的现金'} <Money value={view.me.money} /></span>
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
                      <SpeakButton id={`lot:${l.id}`} label={l.title} size="sm" className="mt-1" text={`${l.title}。${l.desc}。拍到会得到道具：${l.itemTitle}。起拍价${moneyText(view, l.min, true)}。`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, -big, l.min)}>−{big}</button>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, -small, l.min)}>−{small}</button>
                    <div className="flex-1 min-w-[72px] text-center font-mono font-black text-lg whitespace-nowrap">{v === 0 ? <span className="text-white/35 text-sm">放弃</span> : <Money value={v} />}</div>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, small, l.min)}>+{small}</button>
                    <button className="mx-btn mx-btn-ghost !px-2 !py-1 text-xs" onClick={() => step(l.id, big, l.min)}>+{big}</button>
                  </div>
                </div>
              )
            })}
          </div>
          {confirm ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="mx-btn mx-btn-ghost" disabled={sent} onClick={() => setConfirm(false)}>再想想</button>
              <button
                className="mx-btn mx-btn-gold"
                disabled={sent}
                onClick={() => {
                  setSent(true)
                  act({ type: 'bid', bids })
                  setTimeout(() => setSent(false), 4000)
                }}
              >
                {sent ? '已发出…' : kids ? '确定（交了就不能改）' : '确认暗标（不可更改）'}
              </button>
            </div>
          ) : (
            <button className="mx-btn mx-btn-gold w-full" disabled={over || invalid} onClick={() => setConfirm(true)}>
              {over ? (view.scenario.currency ? '出价比你有的还多' : '合计超过现金') : kids ? '偷偷交出我的出价' : '交出暗标'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
