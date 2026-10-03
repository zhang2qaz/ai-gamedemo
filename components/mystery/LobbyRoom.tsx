'use client'

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import { SEATS, otherSeat } from '@/engine/mystery/types'
import { ConnectionBadge } from './ui'

export default function LobbyRoom() {
  const view = useMysteryStore(s => s.view)!
  const act = useMysteryStore(s => s.act)
  const leave = useMysteryStore(s => s.leave)
  const [copied, setCopied] = useState(false)
  // 等待服务器确认的"准备"目标值：回传了这个值就解除
  const [readySent, setReadySent] = useState<{ target: boolean } | null>(null)

  const me = view.players[view.seat]
  const other = view.players[otherSeat(view.seat)]
  if (readySent && me.ready === readySent.target) setReadySent(null)
  const readyPending = !!readySent && me.ready !== readySent.target
  const link = typeof window !== 'undefined' ? `${window.location.origin}/mystery?room=${view.code}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 部分浏览器不允许 */ }
  }

  return (
    <div className="min-h-[100dvh] px-4 py-6 flex justify-center">
      <div className="w-full max-w-3xl space-y-5 mx-in">
        <div className="flex items-center justify-between text-xs text-[var(--mx-muted)]">
          <button onClick={leave} className="hover:text-white">← 离开房间</button>
          <ConnectionBadge />
        </div>

        <div className="mx-panel p-5 text-center space-y-2">
          <div className="text-[11px] tracking-[0.3em] text-[var(--mx-gold)] font-bold">ROOM</div>
          <div className="font-mono text-5xl font-black tracking-[0.35em] text-white">{view.code}</div>
          <div className="text-xs text-[var(--mx-muted)]">把房间号或链接发给你的搭档</div>
          <button onClick={copy} className="mx-btn mx-btn-ghost text-xs px-3 py-1.5">
            {copied ? '已复制 ✓' : '复制邀请链接'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SEATS.map(s => {
            const p = view.players[s]
            const role = view.roles.find(r => r.id === p.roleId)
            return (
              <div key={s} className={`mx-panel-2 p-3 ${s === view.seat ? 'ring-1 ring-[var(--mx-gold)]/50' : ''}`}>
                <div className="text-[10px] text-[var(--mx-muted)] font-bold">{s === view.seat ? '你' : '搭档'}</div>
                <div className="font-bold text-white truncate">{p.name ?? '等待加入…'}</div>
                <div className="text-xs mt-1 text-white/70">{role ? `${role.avatar} ${role.name}` : '尚未选角'}</div>
                <div className={`text-[11px] mt-1 ${p.ready ? 'text-emerald-400' : 'text-[var(--mx-muted)]'}`}>
                  {p.name ? (p.ready ? '✓ 已准备' : p.online ? '未准备' : '离线') : ''}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="text-sm font-bold text-white/80 mb-2">选择你的角色</div>
          <div className="grid md:grid-cols-2 gap-3">
            {view.roles.map(r => {
              const mine = me.roleId === r.id
              const takenByOther = other.roleId === r.id
              return (
                <button
                  key={r.id}
                  disabled={takenByOther}
                  onClick={() => { if (!mine) act({ type: 'pickRole', roleId: r.id }) }}
                  className={`text-left mx-panel p-4 transition-all ${mine ? 'ring-2' : 'hover:bg-white/5'} ${takenByOther ? 'opacity-40' : ''}`}
                  style={mine ? { boxShadow: `0 0 0 2px ${r.color}` } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{r.avatar}</div>
                    <div className="min-w-0">
                      <div className="font-black text-lg text-white">{r.name}</div>
                      <div className="text-[11px] text-[var(--mx-muted)]">{r.enName} · {r.title}</div>
                    </div>
                    {mine && <span className="ml-auto text-xs font-bold" style={{ color: r.color }}>你的角色</span>}
                    {takenByOther && <span className="ml-auto text-xs text-[var(--mx-muted)]">搭档已选</span>}
                  </div>
                  <p className="text-sm text-white/75 leading-6 mt-3 mx-serif whitespace-pre-line">{r.publicProfile}</p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mx-panel p-4 space-y-3">
          <div className="text-xs text-[var(--mx-muted)] leading-5">
            开局后，电脑 DM 会按幕推送你的私密剧本。<b className="text-white/80">不要把剧本原文直接念给对方</b>——你可以撒谎、隐瞒、交易，但别忘了：每个谎言都可能被证据揭穿。
          </div>
          <button
            className={`mx-btn w-full ${me.ready ? 'mx-btn-ghost' : 'mx-btn-gold'}`}
            disabled={!me.roleId || !other.name || readyPending}
            onClick={() => {
              const sent = { target: !me.ready }
              setReadySent(sent)
              act({ type: 'ready', value: sent.target })
              setTimeout(() => setReadySent(cur => (cur === sent ? null : cur)), 4000)
            }}
          >
            {!other.name ? '等待搭档加入…' : !me.roleId ? '请先选择角色' : me.ready ? '取消准备' : '准备好了，开始'}
          </button>
        </div>
      </div>
    </div>
  )
}
