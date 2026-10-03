'use client'

import { useMemo, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import { otherSeat } from '@/engine/mystery/types'
import type { SeatView } from '@/engine/mystery/types'
import { ConnectionBadge, Countdown, Money } from './ui'
import Feed from './Feed'
import { AccusePanel, CasePanel, ChoicePanel, CluePanel, ResultPanel, ScriptPanel, SearchPanel } from './panels'
import FinalePanel from './FinalePanel'
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

  // 步骤切换时自动跳到对应面板（渲染期间根据 props 调整 state）
  if (view.step.id !== seenStep) {
    setSeenStep(view.step.id)
    setTab(defaultTab(view.step.kind))
  }
  if (tab === 'clues' && seenClues !== view.clues.length) setSeenClues(view.clues.length)

  const role = view.roles.find(r => r.id === view.me.roleId)
  const partner = view.players[otherSeat(view.seat)]
  const partnerRole = view.roles.find(r => r.id === partner.roleId)
  const me = view.players[view.seat]
  const k = view.step.kind
  const lastNews = useMemo(() => [...view.log].reverse().find(e => e.kind === 'system' || e.kind === 'event'), [view.log])

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
              <div className="flex-1 min-w-[200px] text-[13px] text-white/80 leading-5">{stageHint(view)}</div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${partner.ready ? 'text-emerald-400' : 'text-[var(--mx-muted)]'}`}>
                  {partnerRole?.name ?? '搭档'}：{partner.online ? (partner.ready ? '已准备' : '进行中') : '离线'}
                </span>
                <button
                  className={`mx-btn !py-2 text-sm ${me.ready ? 'mx-btn-ghost' : 'mx-btn-gold'}`}
                  disabled={k === 'choice' && !view.me.choice?.chosen && !!view.me.choice}
                  onClick={() => act({ type: 'ready', value: !me.ready })}
                >
                  {me.ready ? '取消准备' : readyLabel(k)}
                </button>
              </div>
            </div>
          )}

          <div className={tab === 'stage' ? '' : 'hidden'}><Stage view={view} goto={setTab} /></div>
          <div className={tab === 'script' ? '' : 'hidden'}><ScriptPanel view={view} /></div>
          <div className={tab === 'search' ? '' : 'hidden'}><SearchPanel view={view} /></div>
          <div className={tab === 'clues' ? '' : 'hidden'}><CluePanel view={view} /></div>
          <div className={tab === 'cases' ? '' : 'hidden'}><CasePanel view={view} /></div>
          <div className={tab === 'feed' ? 'lg:hidden' : 'hidden'}><Feed compact /></div>
        </section>

        <aside className="hidden lg:block sticky top-[150px] h-[calc(100dvh-170px)]">
          <Feed />
        </aside>
      </main>

      <footer className="max-w-6xl w-full mx-auto px-3 pb-4 flex items-center justify-between text-[11px] text-[var(--mx-muted)]">
        <ConnectionBadge />
        {confirmLeave ? (
          <span className="flex gap-2 items-center">
            确定离开？（可用同一设备重新进入恢复）
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
    case 'story': return '请阅读 DM 的开场叙述。双方都点「继续」后进入下一阶段。'
    case 'read': return '请在「剧本」中阅读你的私密剧本。不要把原文发给对方——你可以选择说什么、不说什么。'
    case 'search': return '在「搜证」中消耗行动点搜查地点、问询人物。线索默认只有你可见，可以选择公开或交给对方。'
    case 'discuss': return '自由讨论：交换（或隐瞒）信息，对质疑点。可在「案卷」向 DM 递交推理领取酬金。'
    case 'choice': return '请做出你的秘密抉择。对方看不到你的选择。'
    case 'auction': return '拍卖结果已揭晓。拍到的道具在「线索」里，终局时可以用。双方点「继续」进入第二幕。'
    default: return ''
  }
}

function Stage({ view, goto }: { view: SeatView; goto: (t: Tab) => void }) {
  const k = view.step.kind
  if (k === 'choice') return <ChoicePanel view={view} />
  if (k === 'auction') return <AuctionPanel view={view} />
  if (k === 'finale') return <FinalePanel view={view} />
  if (k === 'accuse') return <AccusePanel view={view} />
  if (k === 'ending') return <ResultPanel view={view} />
  return (
    <div className="space-y-3">
      {view.step.text && (
        <div className="mx-paper p-5 mx-serif text-[15px] leading-8 whitespace-pre-wrap mx-in">{view.step.text}</div>
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
