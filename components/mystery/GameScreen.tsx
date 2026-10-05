'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { SeatView } from '@/engine/mystery/types'
import { ConnectionBadge, Countdown, Money, seatName } from './ui'
import Feed from './Feed'
import { AccusePanel, CasePanel, ChoicePanel, CluePanel, ResultPanel, ScriptPanel, SearchPanel } from './panels'
import FinalePanel, { FinaleSummary } from './FinalePanel'
import { SpeakButton, SpeechSettings, useAutoRead, useSpeech } from './Speech'
import { getSpeaker } from '@/lib/mystery/speech'
import AuctionPanel from './AuctionPanel'

type Tab = 'stage' | 'script' | 'search' | 'clues' | 'cases' | 'feed'

const READY_KINDS = new Set(['story', 'read', 'search', 'discuss', 'choice', 'auction'])

function defaultTab(kind: SeatView['step']['kind']): Tab {
  switch (kind) {
    case 'read': return 'script'
    case 'search': return 'search'
    default: return 'stage'
  }
}

export default function GameScreen() {
  const view = useMysteryStore(s => s.view)!
  const act = useMysteryStore(s => s.act)
  const leave = useMysteryStore(s => s.leave)
  const [tab, setTab] = useState<Tab>(defaultTab(view.step.kind))
  const [seenStep, setSeenStep] = useState(view.step.id)
  const [seenClues, setSeenClues] = useState(view.clues.length)
  const [confirmLeave, setConfirmLeave] = useState(false)
  // 点了「准备」到服务器回应之前不能再点。记下发出时的阶段与期望值：服务器回传了这个值、或阶段变了，就解除等待
  const [readySent, setReadySent] = useState<{ step: number; target: boolean } | null>(null)

  // 步骤切换时自动跳到对应面板（渲染期间根据 props 调整 state）
  if (view.step.id !== seenStep) {
    setSeenStep(view.step.id)
    setTab(defaultTab(view.step.kind))
  }
  if (tab === 'clues' && seenClues !== view.clues.length) setSeenClues(view.clues.length)

  const role = view.roles.find(r => r.id === view.me.roleId)
  const others = view.seats.filter(s => s !== view.seat)
  const me = view.players[view.seat] ?? { name: null, online: true, roleId: null, ready: false }
  const k = view.step.kind
  if (readySent && (readySent.step !== view.step.index || me.ready === readySent.target)) setReadySent(null)
  const readyPending = !!readySent && readySent.step === view.step.index && me.ready !== readySent.target
  const latestChapter = view.me.chapters[view.me.chapters.length - 1]?.id ?? ''
  const lastNews = useMemo(() => [...view.log].reverse().find(e => e.kind === 'system' || e.kind === 'event'), [view.log])
  // 自动朗读：剧情旁白、新到的剧本章节
  const latest = view.me.chapters[view.me.chapters.length - 1]
  useAutoRead(view.step.text && (k === 'story' || k === 'auction') ? { id: `step:${view.step.id}`, label: view.step.title, text: view.step.text } : null)
  useAutoRead(k === 'read' && latest ? { id: `chapter:${latest.id}`, label: latest.title, text: `${latest.title}。\n${latest.text}` } : null)

  const tabs: { id: Tab; label: string; dot?: boolean; show: boolean }[] = [
    { id: 'stage', label: stageLabel(k), show: true },
    { id: 'script', label: '剧本', show: true, dot: view.me.chapters.some(c => c.isNew) },
    { id: 'search', label: '搜证', show: true, dot: k === 'search' },
    { id: 'clues', label: `线索 ${view.clues.length}`, show: true, dot: view.clues.length > seenClues && tab !== 'clues' },
    { id: 'cases', label: '案卷', show: view.caseFiles.length > 0, dot: view.caseFiles.some(c => c.open && !c.solved) },
    { id: 'feed', label: '记录', show: true },
  ]

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AutoReader view={view} />
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 bg-[#0a1022]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-2">
          <div className="text-2xl">{role?.avatar}</div>
          <div className="min-w-0">
            <div className="text-[11px] text-[var(--mx-muted)] truncate">{view.scenario.title} · 房间 {view.code}</div>
            <div className="text-sm font-black text-white truncate">
              <span className="text-[var(--mx-gold)] mr-1">{view.step.index + 1}/{view.step.total}</span>{view.step.title}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Countdown deadline={view.step.deadline} />
            {k === 'search' && <span className="text-xs bg-white/10 rounded-md px-2 py-0.5">AP <b className="font-mono text-[var(--mx-gold)]">{view.me.ap}</b></span>}
            <span className="text-xs bg-white/10 rounded-md px-2 py-0.5 hidden sm:inline"><Money value={view.me.money} /></span>
            <SpeechSettings />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-3 pb-2">
          <div className="mx-chyron">
            <span className="mx-chyron-tag">LIVE</span>
            <span className="px-3 py-1.5 text-[12px] text-white/90 truncate">{lastNews?.text.replace(/\n/g, ' ') ?? '……'}</span>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {tabs.filter(t => t.show).map(t => (
            <button key={t.id} className={`mx-tab ${t.id === 'feed' ? 'lg:hidden' : ''}`} data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              {t.dot && <span className="mx-dot" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-3 grid lg:grid-cols-[1fr_360px] gap-3">
        <section className="min-w-0 space-y-3">
          {/* 阶段说明 + 准备 */}
          {READY_KINDS.has(k) && (k !== 'auction' || !!view.auction?.results) && (
            <div className="mx-panel p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] text-[13px] text-white/80 leading-5 flex items-start gap-2">
                <span className="flex-1">{stageHint(view)}</span>
                <SpeakButton id={`hint:${view.step.id}`} label="现在做什么" size="sm" text={`现在是：${view.step.title}。${stageHint(view)}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] flex flex-wrap gap-x-2 gap-y-0.5 justify-end">
                  {others.map(s => {
                    const p = view.players[s]
                    return (
                      <span key={s} className={p?.ready ? 'text-emerald-400' : 'text-[var(--mx-muted)]'}>
                        {seatName(view, s)}：{p?.abandoned ? '已放弃' : p?.online ? (p.ready ? '已准备' : '进行中') : '离线'}
                      </span>
                    )
                  })}
                </span>
                <button
                  className={`mx-btn !py-2 text-sm ${me.ready ? 'mx-btn-ghost' : 'mx-btn-gold'}`}
                  disabled={(k === 'choice' && !view.me.choice?.chosen && !!view.me.choice) || readyPending}
                  onClick={() => {
                    const sent = { step: view.step.index, target: !me.ready }
                    setReadySent(sent)
                    act({ type: 'ready', value: sent.target })
                    // 出错（如网络未连）时允许重试
                    setTimeout(() => setReadySent(cur => (cur === sent ? null : cur)), 4000)
                  }}
                >
                  {me.ready ? '取消准备' : readyLabel(k)}
                </button>
              </div>
            </div>
          )}

          <div className={tab === 'stage' ? '' : 'hidden'}><Stage view={view} goto={setTab} /></div>
          {/* 新章节到来时重新挂载，默认展开最新一章 */}
          <div className={tab === 'script' ? '' : 'hidden'}><ScriptPanel key={latestChapter} view={view} /></div>
          <div className={tab === 'search' ? '' : 'hidden'}><SearchPanel view={view} /></div>
          <div className={tab === 'clues' ? '' : 'hidden'}><CluePanel view={view} /></div>
          <div className={tab === 'cases' ? '' : 'hidden'}><CasePanel view={view} /></div>
          <div className={tab === 'feed' ? 'lg:hidden' : 'hidden'}><Feed compact active={tab === 'feed'} /></div>
        </section>

        <aside className="hidden lg:block sticky top-[150px] h-[calc(100dvh-170px)]">
          <Feed />
        </aside>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-3 pb-4 flex items-center justify-between text-[11px] text-[var(--mx-muted)]">
        <ConnectionBadge />
        {confirmLeave ? (
          <span className="flex gap-2 items-center">
            确定离开？（之后在本设备打开本页，可以回到这局）
            <button className="text-red-300" onClick={leave}>离开</button>
            <button onClick={() => setConfirmLeave(false)}>取消</button>
          </span>
        ) : (
          <button onClick={() => setConfirmLeave(true)}>离开房间</button>
        )}
      </footer>
    </div>
  )
}

function stageLabel(kind: SeatView['step']['kind']) {
  switch (kind) {
    case 'choice': return '抉择'
    case 'auction': return '拍卖'
    case 'finale': return '终局'
    case 'accuse': return '指认'
    case 'ending': return '结局'
    default: return '当前'
  }
}

function readyLabel(kind: SeatView['step']['kind']) {
  switch (kind) {
    case 'read': return '读完了'
    case 'search': return '结束搜证'
    case 'discuss': return '讨论完毕'
    default: return '继续'
  }
}

function stageHint(view: SeatView): string {
  switch (view.step.kind) {
    case 'story': return '请阅读 DM 的开场叙述。所有人都点「继续」后进入下一阶段。'
    case 'read': return '请在「剧本」中阅读你的私密剧本。不要把原文发给别人——你可以选择说什么、不说什么。'
    case 'search': return '在「搜证」中消耗行动点搜查地点、问询人物。线索默认只有你可见，可以选择公开，或者交给某一个人。'
    case 'discuss': return '自由讨论：交换（或隐瞒）信息，对质疑点。可在「案卷」向 DM 递交推理领取酬金。'
    case 'choice': return '请做出你的秘密抉择。别人看不到你的选择。'
    case 'auction': return '拍卖结果已揭晓。拍到的道具在「线索」里，终局时可以用。所有人都点「继续」后进入第二幕。'
    default: return ''
  }
}

function Stage({ view, goto }: { view: SeatView; goto: (t: Tab) => void }) {
  const k = view.step.kind
  if (k === 'choice') return <ChoicePanel view={view} />
  if (k === 'auction') return <AuctionPanel view={view} />
  if (k === 'finale') return <FinalePanel view={view} />
  if (k === 'accuse') return <AccusePanel view={view} />
  if (k === 'ending') return <div className="space-y-3"><FinaleSummary view={view} /><ResultPanel view={view} /></div>
  return (
    <div className="space-y-3">
      {view.step.text && (
        <div className="mx-paper p-5 mx-serif text-[15px] leading-8 whitespace-pre-wrap mx-in">
          <div className="flex justify-end mb-1 whitespace-normal">
            <SpeakButton id={`step:${view.step.id}`} label={view.step.title} text={view.step.text} tone="light" size="lg" />
          </div>
          {view.step.text}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <QuickLink label="阅读剧本" icon="📜" onClick={() => goto('script')} />
        <QuickLink label="搜证问询" icon="🔎" onClick={() => goto('search')} />
        <QuickLink label="查看线索" icon="🗂️" onClick={() => goto('clues')} />
        {view.caseFiles.length > 0 && <QuickLink label="递交案卷" icon="💵" onClick={() => goto('cases')} />}
      </div>
    </div>
  )
}

function QuickLink({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mx-panel-2 p-3 text-center hover:bg-white/5">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-white/80 mt-1">{label}</div>
    </button>
  )
}

/**
 * 自动朗读新消息：DM 私下告诉你的（拿到线索、问询回答、案卷结果……）、公开事件、别人的发言，
 * 以及新拿到 / 新公开的线索内容。打开「自动朗读」之前的旧内容不会补读。
 */
function AutoReader({ view }: { view: SeatView }) {
  const speech = useSpeech()
  const lastLog = useRef<number | null>(null)
  const seenClues = useRef<Set<string> | null>(null)
  useEffect(() => {
    const maxLog = view.log.reduce((n, e) => Math.max(n, e.id), 0)
    const known = seenClues.current
    if (!speech.auto || lastLog.current === null || known === null) {
      lastLog.current = maxLog
      seenClues.current = new Set(view.clues.map(c => c.id))
      return
    }
    const sp = getSpeaker()
    for (const e of view.log) {
      if (e.id <= lastLog.current) continue
      // 终局开始后，揭晓的经过由终局面板自己朗读（同一段不念两遍）
      const fromOther = e.kind === 'chat' && e.from !== 'DM' && e.from !== view.seat
      const read = e.kind === 'dm' || (e.kind === 'event' && !view.finale) || fromOther
      if (!read) continue
      const name = fromOther && e.from !== 'DM' ? seatName(view, e.from) : 'DM'
      sp?.enqueue({ id: `log:${e.id}`, label: fromOther ? `${name}说` : 'DM', text: fromOther ? `${name}说：${e.text}` : e.text })
    }
    for (const c of view.clues) {
      if (known.has(c.id)) continue
      known.add(c.id)
      if (c.kind === 'item') continue
      sp?.enqueue({ id: `clue:${c.id}`, label: c.title, text: `${c.title}。\n${c.text}` })
    }
    lastLog.current = maxLog
  }, [speech.auto, view])
  return null
}
