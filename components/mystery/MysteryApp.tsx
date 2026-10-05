'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import EntryScreen from './EntryScreen'
import LobbyRoom from './LobbyRoom'
import GameScreen from './GameScreen'
import { Toasts } from './ui'
import { SpeechBar, useSpeech } from './Speech'

function subscribeNoop() {
  return () => {}
}

export default function MysteryApp() {
  const init = useMysteryStore(s => s.init)
  const joined = useMysteryStore(s => s.joined)
  const view = useMysteryStore(s => s.view)
  const speech = useSpeech()

  // 仅在客户端渲染（依赖 localStorage / WebSocket）
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  useEffect(() => { init() }, [init])

  let screen
  if (!mounted) screen = <div className="min-h-[100dvh] flex items-center justify-center text-sm text-[var(--mx-muted)]">载入中…</div>
  else if (!joined || !view) screen = <EntryScreen />
  else if (view.step.kind === 'lobby') screen = <LobbyRoom />
  else screen = <GameScreen />

  return (
    // 朗读条盖在页面底部：读的时候给页面底下留出位置，最下面的按钮也能滚上来
    <div className={`mx-root ${speech.current ? 'pb-44' : ''}`}>
      <Toasts />
      {screen}
      {mounted && <SpeechBar />}
    </div>
  )
}
