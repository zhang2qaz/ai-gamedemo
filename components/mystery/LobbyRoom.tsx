'use client'

import { useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import { SEATS } from '@/engine/mystery/types'
import { ConnectionBadge } from './ui'
import { SpeakButton, SpeechSettings } from './Speech'

export default function LobbyRoom() {
  const view = useMysteryStore(s => s.view)!
  const act = useMysteryStore(s => s.act)
  const leave = useMysteryStore(s => s.leave)
  const [copied, setCopied] = useState(false)
  // 等待服务器确认的"准备"目标值：回传了这个值就解除
  const [readySent, setReadySent] = useState<{ target: boolean } | null>(null)

  const me = view.players[view.seat] ?? { name: null, online: true, roleId: null, ready: false }
  const others = view.seats.filter(s => s !== view.seat).map(s => view.players[s]).filter(p => !!p)
  const seated = view.seats.length
  const enough = seated >= view.minPlayers
  // 必须有人演的角色里还没人选的
  const missing = view.roles.filter(r => !r.optional && !Object.values(view.players).some(p => p?.roleId === r.id))
  // 大家在等谁（不点名的话，一直不选角色的人会让整个房间卡住却没人知道为什么）
  const waitingOn = view.seats.filter(s => s !== view.seat).flatMap(s => {
    const p = view.players[s]
    if (!p?.name) return []
    if (!p.online) return [`${p.name}（离线）`]
    if (!p.roleId) return [`${p.name}（还没选角色）`]
    return p.ready ? [] : [`${p.name}（还没准备）`]
  })
  if (readySent && me.ready === readySent.target) setReadySent(null)
  const readyPending = !!readySent && me.ready !== readySent.target
  // 链接里带上剧本：没玩过的设备打开时，入口页显示的就是这个故事（小学生不会先看到大人的故事）
  const link = typeof window !== 'undefined' ? `${window.location.origin}/mystery?room=${view.code}&story=${view.scenario.id}` : ''

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
          <span className="flex items-center gap-2"><SpeechSettings /><ConnectionBadge /></span>
        </div>

        <div className="mx-panel p-5 text-center space-y-2">
          <div className="text-[11px] tracking-[0.3em] text-[var(--mx-gold)] font-bold">ROOM</div>
          <div className="font-mono text-5xl font-black tracking-[0.35em] text-white">{view.code}</div>
          <div className="text-xs text-[var(--mx-muted)]">把房间号或链接发给一起玩的人（本剧本 {view.minPlayers}–{view.maxPlayers} 人）</div>
          <button onClick={copy} className="mx-btn mx-btn-ghost text-xs px-3 py-1.5">
            {copied ? '已复制 ✓' : '复制邀请链接'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SEATS.slice(0, view.maxPlayers).map((s, i) => {
            const p = view.players[s]
            const role = p ? view.roles.find(r => r.id === p.roleId) : undefined
            return (
              <div key={s} className={`mx-panel-2 p-3 min-w-0 ${s === view.seat ? 'ring-1 ring-[var(--mx-gold)]/50' : ''} ${p?.name ? '' : 'opacity-60'}`}>
                <div className="text-[10px] text-[var(--mx-muted)] font-bold">{s === view.seat ? '你' : `${i + 1} 号座位`}</div>
                <div className="font-bold text-white truncate">{p?.name ?? (enough ? '空位（可以不坐人）' : '等待加入…')}</div>
                <div className="text-xs mt-1 text-white/70 truncate">{role ? `${role.avatar} ${role.name}` : p?.name ? '尚未选角' : ''}</div>
                <div className={`text-[11px] mt-1 ${p?.ready ? 'text-emerald-400' : 'text-[var(--mx-muted)]'}`}>
                  {p?.name ? (p.ready ? '✓ 已准备' : p.online ? '未准备' : '离线（1–2 分钟后自动让出座位）') : ''}
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
              const taker = others.find(p => p!.roleId === r.id)
              const takenByOther = !!taker
              return (
                <div key={r.id} className="relative">
                <button
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
                      {r.optional && <div className="text-[11px] text-sky-300 mt-0.5">可选角色：人多的时候才需要有人演，没人演时由电脑扮演</div>}
                    </div>
                    {mine && <span className="ml-auto text-xs font-bold shrink-0" style={{ color: r.color }}>你的角色</span>}
                    {takenByOther && <span className="ml-auto text-xs text-[var(--mx-muted)] shrink-0 max-w-[40%] truncate">{taker!.name ?? '别人'}已选</span>}
                  </div>
                  <p className="text-sm text-white/75 leading-6 mt-3 mx-serif whitespace-pre-line pb-6">{r.publicProfile}</p>
                </button>
                <SpeakButton id={`role:${r.id}`} label={r.name} size="sm" className="absolute right-3 bottom-3" text={`${r.name}，${r.title}。\n${r.publicProfile}`} />
                </div>
              )
            })}
          </div>
        </div>

        <div className="mx-panel p-4 space-y-3">
          <div className="text-xs text-[var(--mx-muted)] leading-5">
            {view.scenario.theme === 'kids'
              ? <>开始以后，电脑会把只给你看的剧本发给你。<b className="text-white/80">不要把原文直接念给别人听</b>——你可以选择说什么、不说什么。你们中间可能藏着一个会说谎的人：用证据说话。</>
              : <>开局后，电脑 DM 会按幕推送你的私密剧本。<b className="text-white/80">不要把剧本原文直接念给别人</b>——你可以撒谎、隐瞒、交易，但别忘了：每个谎言都可能被证据揭穿。</>}
          </div>
          <div className="text-xs text-amber-200/90 leading-5 rounded-lg bg-amber-500/10 p-2">
            ⚠️ <b>人到齐了再点准备。</b>所有人都点了「准备好了」就会马上开局，开局以后就不能再有人加入了。
            {view.seats.length < view.maxPlayers && ` 现在 ${seated} 个人；最多可以 ${view.maxPlayers} 个人一起玩。`}
          </div>
          {waitingOn.length > 0 && (
            <div className="text-xs text-white/70">还在等：{waitingOn.join('、')}</div>
          )}
          {enough && missing.length > 0 && (
            <div className="text-xs text-red-300">还没人选：{missing.map(r => r.name).join('、')}（这个角色必须有人演）</div>
          )}
          <button
            className={`mx-btn w-full ${me.ready ? 'mx-btn-ghost' : 'mx-btn-gold'}`}
            disabled={!me.roleId || !enough || readyPending}
            onClick={() => {
              const sent = { target: !me.ready }
              setReadySent(sent)
              act({ type: 'ready', value: sent.target })
              setTimeout(() => setReadySent(cur => (cur === sent ? null : cur)), 4000)
            }}
          >
            {!enough ? `还要等人：至少 ${view.minPlayers} 个人才能开局（现在 ${seated} 人）` : !me.roleId ? '请先选择角色' : me.ready ? '取消准备' : '准备好了，开始'}
          </button>
        </div>
      </div>
    </div>
  )
}
