'use client'

import React from 'react'
import { useGameStore } from '@/store/gameStore'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error: Error | null }

class ErrorBoundaryInner extends React.Component<Props & { onReset: () => void }, State> {
  constructor(props: Props & { onReset: () => void }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[弈战] UI crash caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center">
          <div className="bg-stone-900 border border-red-800 rounded-xl p-8 max-w-md text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <div className="text-red-400 font-bold text-lg">游戏遇到了问题</div>
            <div className="text-stone-500 text-sm">
              {this.state.error?.message || '未知错误'}
            </div>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl transition-all"
            >
              返回主页重新开始
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function ErrorBoundary({ children }: Props) {
  const backToThemeSelect = useGameStore(s => s.backToThemeSelect)
  return (
    <ErrorBoundaryInner onReset={backToThemeSelect}>
      {children}
    </ErrorBoundaryInner>
  )
}
