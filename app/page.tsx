'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import GameBoard from '@/components/GameBoard'
import ModeSelect from '@/components/ModeSelect'
import LobbyScreen from '@/components/LobbyScreen'
import MultiplayerBoard from '@/components/MultiplayerBoard'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function Home() {
  const mode = useMultiplayerStore(s => s.mode)
  const phase = useMultiplayerStore(s => s.phase)

  // 单机模式 → 原始 GameBoard
  if (mode === 'local') {
    return (
      <ErrorBoundary>
        <GameBoard />
      </ErrorBoundary>
    )
  }

  // 联机模式路由
  if (mode === 'host' || mode === 'player') {
    if (phase === 'LOBBY' || phase === 'THEME_SELECT') {
      return <LobbyScreen />
    }
    return (
      <ErrorBoundary>
        <MultiplayerBoard />
      </ErrorBoundary>
    )
  }

  // 默认：模式选择
  return <ModeSelect />
}
