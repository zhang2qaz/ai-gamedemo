'use client'

import { useState, useEffect, useRef } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'

const QUICK_MSGS = ['攻!', '我守', '联手?', '谁来打他', '风向假的', '别上当']

export default function ChatPanel() {
  const messages = useMultiplayerStore(s => s.chatMessages)
  const sendChat = useMultiplayerStore(s => s.sendChat)
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 新消息自动滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  function handleSend(t?: string) {
    const finalText = (t ?? text).trim()
    if (!finalText) return
    sendChat(finalText)
    if (!t) setText('')
  }

  const recent = messages.slice(-6)

  return (
    <div className="glass-card border-stone-700/40 rounded-xl p-2.5 space-y-1.5 animate-fade-in-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-[10px] text-stone-500 hover:text-stone-300 transition-all"
      >
        <span>💬 房间聊天 ({messages.length})</span>
        <span>{expanded ? '收起' : '展开'}</span>
      </button>

      {expanded && (
        <>
          {/* 消息列表 */}
          <div ref={scrollRef} className="max-h-32 overflow-y-auto space-y-1 px-1">
            {recent.length === 0 ? (
              <div className="text-[10px] text-stone-700 text-center py-2">还没有消息</div>
            ) : (
              recent.map(m => {
                const c = PLAYER_COLORS[m.fromId]
                const isMe = m.fromId === myPlayerId
                return (
                  <div key={m.id} className="text-[11px] leading-tight">
                    <span className={`font-bold ${c?.text ?? 'text-stone-400'} mr-1`}>
                      {m.fromName}{isMe ? '(你)' : ''}：
                    </span>
                    <span className="text-stone-300">{m.text}</span>
                  </div>
                )
              })
            )}
          </div>

          {/* 快速短语 */}
          <div className="flex gap-1 flex-wrap">
            {QUICK_MSGS.map(m => (
              <button
                key={m}
                onClick={() => handleSend(m)}
                className="text-[10px] px-1.5 py-0.5 bg-stone-800/60 hover:bg-amber-900/40 border border-stone-700/40 hover:border-amber-700/50 rounded text-stone-400 hover:text-amber-300 transition-all"
              >
                {m}
              </button>
            ))}
          </div>

          {/* 输入框 */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value.slice(0, 40))}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              maxLength={40}
              placeholder="说点什么…(40字内)"
              className="flex-1 text-[11px] bg-stone-900 border border-stone-700/50 rounded px-2 py-1 text-stone-300 focus:outline-none focus:border-amber-700/60"
            />
            <button
              onClick={() => handleSend()}
              disabled={!text.trim()}
              className="text-[11px] px-2 py-1 bg-amber-700/60 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-white rounded transition-all"
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  )
}
