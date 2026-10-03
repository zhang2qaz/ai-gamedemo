'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import EntryScreen from './EntryScreen'
import LobbyRoom from './LobbyRoom'
import GameScreen from './GameScreen'
import { Toasts } from './ui'

function subscribeNoop() {
  return () => {}
}

export default function MysteryApp() {
  const init = useMysteryStore(s => s.init)
  const joined = useMysteryStore(s => s.joined)
  const view = useMysteryStore(s => s.view)

  // 仅在客户端渲染（依赖 localStorage / WebSocket）
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  useEffect(() => { init() }, [init])

  let screen
  if (!mounted) screen = <div className="min-h-[100dvh] flex items-center justify-center text-sm text-[var(--mx-muted)]">载入中…</div>
  else if (!joined || !view) screen = <EntryScreen />
  else if (view.step.kind === 'lobby') screen = <LobbyRoom />
  else screen = <GameScreen />

  return (
    <div className="mx-root">
      <Toasts />
      {screen}
    </div>
  )
}
