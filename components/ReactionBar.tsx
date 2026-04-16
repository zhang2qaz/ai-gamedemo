'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'

const EMOJIS = ['🔥', '😱', '👏', '🤡', '💪', '👑']
const PHRASES = ['早说了！', '稳！', '你们完了', '666', '佛了']

export default function ReactionBar() {
  const sendReaction = useMultiplayerStore(s => s.sendReaction)
  const [cooldownUntil, setCooldownUntil] = useState(0)

  function handleSend(emoji: string, phrase?: string) {
    const now = Date.now()
    if (now < cooldownUntil) return
    setCooldownUntil(now + 800)
    sendReaction(emoji, phrase)
  }

  return (
    <div className="glass-card border-stone-700/40 rounded-xl px-2.5 py-2 space-y-1.5 animate-fade-in-up">
      <div className="text-[10px] text-stone-500">快速表达</div>
      {/* Emoji 行 */}
      <div className="flex gap-1.5 justify-between">
        {EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => handleSend(e)}
            className="flex-1 h-9 bg-stone-800/50 hover:bg-stone-700/70 active:scale-95 border border-stone-700/40 rounded-lg text-xl transition-all"
          >
            {e}
          </button>
        ))}
      </div>
      {/* 短语行 */}
      <div className="flex gap-1.5 flex-wrap">
        {PHRASES.map(p => (
          <button
            key={p}
            onClick={() => handleSend('💬', p)}
            className="flex-1 min-w-[60px] h-8 bg-stone-800/50 hover:bg-amber-900/40 active:scale-95 border border-stone-700/40 hover:border-amber-700/50 rounded-lg text-[11px] text-stone-400 hover:text-amber-300 transition-all"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
