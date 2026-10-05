'use client'

// 朗读的界面部件：「🔊 读给我听」按钮、底部的朗读条、朗读设置。
// 声音由浏览器自己合成，只在本机播放；不认字的小朋友点一下就能听。

import { useEffect, useState, useSyncExternalStore } from 'react'
import { RATES, getSpeaker } from '@/lib/mystery/speech'
import { useMysteryStore } from '@/store/mysteryStore'
import type { ReadItem, SpeechSnapshot } from '@/lib/mystery/speech'

const OFF: SpeechSnapshot = { supported: false, current: null, sentences: [], index: 0, paused: false, queued: 0, rate: 1, auto: false, voiceName: null }
const noop = () => () => {}

export function useSpeech(): SpeechSnapshot {
  const sp = getSpeaker()
  return useSyncExternalStore(sp ? fn => sp.subscribe(fn) : noop, () => sp?.state ?? OFF, () => OFF)
}

/** 「🔊 读给我听」：点一下开始读，再点一下停 */
export function SpeakButton({ id, label, text, size = 'md', tone = 'dark', className = '' }: {
  id: string
  label: string
  text: string | (() => string)
  size?: 'sm' | 'md' | 'lg'
  /** 放在浅色纸张上用 light */
  tone?: 'dark' | 'light'
  className?: string
}) {
  const s = useSpeech()
  if (!s.supported) return null
  const active = s.current?.id === id
  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5' : size === 'lg' ? 'text-base px-4 py-2' : 'text-xs px-2.5 py-1'
  const colors = active
    ? 'bg-amber-400 text-black border-amber-300'
    : tone === 'light'
      ? 'bg-black/10 text-[var(--mx-paper-ink)] border-black/15 hover:bg-black/15'
      : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-full border font-bold shrink-0 transition-colors ${sizing} ${colors} ${className}`}
      aria-label={active ? `停止朗读：${label}` : `朗读：${label}`}
      onClick={e => {
        e.stopPropagation()
        const sp = getSpeaker()
        if (!sp) return
        if (active) sp.stop()
        else sp.play({ id, label, text: typeof text === 'function' ? text() : text })
      }}
    >
      <span aria-hidden>{active ? '⏹' : '🔊'}</span>
      {size !== 'sm' && <span>{active ? '停止' : '读给我听'}</span>}
    </button>
  )
}

/** 自动朗读：打开了「自动朗读」时，新出现的内容会自动念（每个房间里每段只念一次；换一局重新算） */
const autoDone = new Set<string>()
export function useAutoRead(item: ReadItem | null) {
  const s = useSpeech()
  const room = useMysteryStore(st => st.code) ?? ''
  const id = item?.id
  const label = item?.label
  const text = item?.text
  useEffect(() => {
    if (!s.auto || id === undefined || label === undefined || text === undefined) return
    const key = `${room}|${id}`
    if (autoDone.has(key)) return
    autoDone.add(key)
    getSpeaker()?.enqueue({ id, label, text })
  }, [s.auto, room, id, label, text])
}

/** 底部朗读条：正在读哪一段、哪一句（大字），以及暂停、上一句、下一句、停止 */
export function SpeechBar() {
  const s = useSpeech()
  if (!s.supported || !s.current) return null
  const sp = getSpeaker()!
  const sentence = s.sentences[s.index] ?? ''
  return (
    // 电脑上靠左放，不挡住右侧的聊天框；手机上铺满底部
    <div className="fixed bottom-0 inset-x-0 lg:right-auto lg:left-4 lg:w-[min(640px,calc(100vw-420px))] z-40 px-2 lg:px-0 pb-2 pointer-events-none" role="region" aria-label="朗读">
      <div className="max-w-3xl mx-auto lg:mx-0 pointer-events-auto rounded-2xl border border-amber-300/40 bg-[#141b33]/95 backdrop-blur shadow-2xl p-3">
        <div className="flex items-center gap-2 text-[11px] text-amber-200/90">
          <span className="font-black">🔊 正在读：{s.current.label}</span>
          <span className="ml-auto font-mono">{s.index + 1} / {s.sentences.length}{s.queued > 0 ? ` · 还有 ${s.queued} 段` : ''}</span>
        </div>
        <div className="mt-1.5 text-[17px] leading-7 text-white font-bold mx-serif min-h-[1.75rem]">{sentence}</div>
        <div className="mt-2 flex items-center gap-1.5">
          <BarBtn label="上一句" onClick={() => sp.jump(-1)} disabled={s.index === 0}>⏮</BarBtn>
          {s.paused
            ? <BarBtn label="继续" onClick={() => sp.resume()} big>▶️</BarBtn>
            : <BarBtn label="暂停" onClick={() => sp.pause()} big>⏸</BarBtn>}
          <BarBtn label="下一句" onClick={() => sp.jump(1)} disabled={s.index >= s.sentences.length - 1}>⏭</BarBtn>
          <BarBtn label="停止" onClick={() => sp.stop()}>⏹</BarBtn>
          <span className="ml-auto flex items-center gap-1">
            {RATES.map(r => (
              <button
                key={r.value}
                type="button"
                className={`text-[11px] px-2 py-1 rounded-md ${Math.abs(s.rate - r.value) < 0.01 ? 'bg-amber-400 text-black font-black' : 'bg-white/10 text-white/80'}`}
                onClick={() => sp.setRate(r.value)}
              >
                {r.label}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}

function BarBtn({ children, label, onClick, disabled, big }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; big?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 flex flex-col items-center justify-center ${big ? 'w-14 h-12 text-xl' : 'w-11 h-12 text-lg'}`}
    >
      <span aria-hidden>{children}</span>
      <span className="text-[9px] text-white/70 leading-none mt-0.5">{label}</span>
    </button>
  )
}

/** 顶栏里的朗读开关：自动朗读、语速、试听 */
export function SpeechSettings() {
  const s = useSpeech()
  const [open, setOpen] = useState(false)
  if (!s.supported) return null
  const sp = getSpeaker()!
  return (
    <div className="relative">
      <button
        type="button"
        className={`text-xs rounded-md px-2 py-0.5 font-bold whitespace-nowrap ${s.auto ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title="朗读设置"
      >
        🔊{s.auto && <span className="hidden sm:inline"> 自动读</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-white/15 bg-[#141b33] shadow-2xl p-3 space-y-3 text-[13px] text-white">
          <div className="font-black">🔊 朗读</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-amber-400" checked={s.auto} onChange={e => sp.setAuto(e.target.checked)} />
            <span>自动朗读<span className="block text-[11px] text-white/60">新的剧本、旁白、线索出现时自动读出来</span></span>
          </label>
          <div>
            <div className="text-[11px] text-white/60 mb-1">语速</div>
            <div className="flex gap-1">
              {RATES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={`flex-1 text-xs py-1.5 rounded-md ${Math.abs(s.rate - r.value) < 0.01 ? 'bg-amber-400 text-black font-black' : 'bg-white/10'}`}
                  onClick={() => sp.setRate(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="w-full text-xs py-1.5 rounded-md bg-white/10 hover:bg-white/15"
            onClick={() => sp.play({ id: 'speech:test', label: '试听', text: '你好，我会把剧本读给你听。点任何一个「读给我听」按钮就可以开始。' })}
          >
            试听一下
          </button>
          <div className="text-[11px] text-white/50 leading-4">
            每段文字旁边都有「🔊 读给我听」按钮。声音只在你自己的设备上播放，对方听不到。
            {!s.voiceName && <span className="block mt-1 text-amber-200/80">这台设备好像没有安装中文语音，读出来可能不标准。</span>}
          </div>
          <button type="button" className="w-full text-[11px] text-white/60" onClick={() => setOpen(false)}>收起</button>
        </div>
      )}
    </div>
  )
}
