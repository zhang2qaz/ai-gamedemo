'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMysteryStore } from '@/store/mysteryStore'
import { SCENARIO_META } from '@/engine/mystery/scenarios/meta'
import { ConnectionBadge } from './ui'

const NAME_KEY = 'mystery:name'

export default function EntryScreen() {
  const create = useMysteryStore(s => s.create)
  const join = useMysteryStore(s => s.join)
  const resuming = useMysteryStore(s => s.resuming)
  // 本组件只在客户端挂载后渲染（见 MysteryApp），可直接读取 window
  const [roomFromUrl] = useState(() => (new URLSearchParams(window.location.search).get('room') ?? '').toUpperCase().slice(0, 4))
  const [name, setName] = useState(() => {
    try { return window.localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
  })
  const [code, setCode] = useState(roomFromUrl)
  const [mode, setMode] = useState<'home' | 'join'>(roomFromUrl ? 'join' : 'home')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!busy) return
    const t = setTimeout(() => setBusy(false), 3000)
    return () => clearTimeout(t)
  }, [busy])

  function remember() {
    try { window.localStorage.setItem(NAME_KEY, name.trim()) } catch { /* 忽略 */ }
  }

  const m = SCENARIO_META
  const canGo = name.trim().length > 0 && !busy

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 mx-in">
        <div className="flex justify-between items-center text-xs text-[var(--mx-muted)]">
          <Link href="/" className="hover:text-white">← 返回弈战</Link>
          <ConnectionBadge />
        </div>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] text-[var(--mx-gold)] font-bold">
            <span className="w-6 h-px bg-[var(--mx-gold)]/60" />
            {m.era}
            <span className="w-6 h-px bg-[var(--mx-gold)]/60" />
          </div>
          <h1 className="mx-serif text-4xl font-black leading-tight">
            <span className="text-white">{m.title}</span>
          </h1>
          <p className="text-[var(--mx-muted)] text-sm">{m.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-2 text-[11px]">
            {m.tags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">{t}</span>
            ))}
          </div>
        </div>

        <div className="mx-panel p-4 text-sm leading-7 text-white/80 mx-serif whitespace-pre-line">
          {m.intro}
        </div>

        {resuming ? (
          <div className="mx-panel p-4 text-center text-sm text-white/70">正在恢复你的上一局…</div>
        ) : (
          <div className="mx-panel p-4 space-y-4">
            <div>
              <label className="text-[11px] font-bold tracking-wider text-[var(--mx-muted)] block mb-1.5">你的昵称</label>
              <input
                className="mx-input"
                value={name}
                maxLength={12}
                placeholder="输入昵称"
                onChange={e => setName(e.target.value)}
              />
            </div>

            {mode === 'home' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="mx-btn mx-btn-red"
                  disabled={!canGo}
                  onClick={() => { remember(); setBusy(true); create(name.trim()) }}
                >
                  创建房间
                </button>
                <button className="mx-btn mx-btn-blue" disabled={!name.trim()} onClick={() => setMode('join')}>
                  加入房间
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-[var(--mx-muted)] block mb-1.5">房间号</label>
                  <input
                    className="mx-input font-mono text-2xl text-center tracking-[0.5em]"
                    value={code}
                    maxLength={4}
                    placeholder="ABCD"
                    autoComplete="off"
                    onChange={e => setCode(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="mx-btn mx-btn-ghost" onClick={() => setMode('home')}>返回</button>
                  <button
                    className="mx-btn mx-btn-blue"
                    disabled={!canGo || code.trim().length !== 4}
                    onClick={() => { remember(); setBusy(true); join(code.trim(), name.trim()) }}
                  >
                    加入
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-center text-[var(--mx-muted)] leading-5">
          {m.players} · {m.duration} · 电脑 DM 全程主持<br />
          建议两人语音通话进行；文字聊天也可完成全部流程。
        </div>
      </div>
    </div>
  )
}
