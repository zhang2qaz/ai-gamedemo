import GameBoard from '@/components/GameBoard'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function Home() {
  return (
    <ErrorBoundary>
      <GameBoard />
    </ErrorBoundary>
  )
}
