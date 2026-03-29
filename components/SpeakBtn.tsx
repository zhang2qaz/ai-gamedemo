'use client'
// fixed: span not button to avoid nested-button HTML violation
import { useState, useEffect } from 'react'
import { speak, stopSpeaking } from '@/lib/tts'

type Props = {
  text: string
  className?: string
  size?: 'sm' | 'md'
}

export default function SpeakBtn({ text, className = '', size = 'sm' }: Props) {
  const [active, setActive] = useState(false)

  // Reset active state when speech ends
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      if (!window.speechSynthesis?.speaking) {
        setActive(false)
        clearInterval(id)
      }
    }, 200)
    return () => clearInterval(id)
  }, [active])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (active) {
      stopSpeaking()
      setActive(false)
    } else {
      speak(text)
      setActive(true)
    }
  }

  const sizeClass = size === 'md'
    ? 'w-7 h-7 text-sm'
    : 'w-5 h-5 text-xs'

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent) }}
      title={active ? '点击停止朗读' : '点击朗读'}
      className={`
        inline-flex items-center justify-center rounded-full shrink-0
        transition-all cursor-pointer select-none
        ${active
          ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 animate-pulse'
          : 'bg-stone-800/60 text-stone-600 hover:text-stone-300 hover:bg-stone-700/60'
        }
        ${sizeClass} ${className}
      `}
    >
      {active ? '⏸' : '🔊'}
    </span>
  )
}
