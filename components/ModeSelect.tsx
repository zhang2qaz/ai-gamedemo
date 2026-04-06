'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { useGameStore } from '@/store/gameStore'

export default function ModeSelect() {
  const [view, setView] = useState<'main' | 'host' | 'join'>('main')
  const [playerName, setPlayerName] = useState('')
  const [hostAddr, setHostAddr] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const error = useMultiplayerStore(s => s.error)
  const hostGame = useMultiplayerStore(s => s.hostGame)
  const joinGame = useMultiplayerStore(s => s.joinGame)
  const setMode = useMultiplayerStore(s => s.setMode)

  const handleLocal = () => { setMode('local') }

  const handleHost = async () => {
    if (!playerName.trim()) return
    await hostGame(playerName.trim())
  }

  const handleJoin = async () => {
    if (!playerName.trim() || !hostAddr.trim() || !roomCode.trim()) return
    let host = hostAddr.trim()
    let port = 3000
    if (host.includes(':')) {
      const parts = host.split(':')
      host = parts[0]
      port = parseInt(parts[1]) || 3000
    }
    if (host.startsWith('http')) {
      try {
        const url = new URL(host)
        host = url.hostname
        port = parseInt(url.port) || 3000
      } catch { /* 忽略 */ }
    }
    await joinGame(host, port, roomCode.trim().toUpperCase(), playerName.trim())
  }

  // ── 创建房间 ──
  if (view === 'host') {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 animate-fade-in-up">
          <button onClick={() => setView('main')} className="text-stone-600 text-sm hover:text-stone-400 transition-colors">← 返回</button>

          <div className="text-center space-y-2">
            <h2 className="text-gradient-gold font-black text-2xl">创建房间</h2>
            <p className="text-stone-500 text-sm text-emboss">你将作为房主，其他玩家通过局域网加入</p>
          </div>

          <div>
            <label className="text-stone-500 text-xs mb-1.5 block font-bold uppercase tracking-wider">你的名字</label>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="输入你的名字"
              className="w-full glass-card rounded-xl px-4 py-3.5 text-white placeholder:text-stone-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
              maxLength={8}
            />
          </div>

          {error && (
            <div className="glass-panel rounded-xl px-4 py-2.5 border-red-500/30 text-red-400 text-sm text-center animate-fade-in-up">
              {error}
            </div>
          )}

          <button
            onClick={handleHost}
            disabled={!playerName.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500 text-black font-black rounded-xl text-base transition-all btn-3d disabled:shadow-none disabled:transform-none"
          >
            🎮 创建房间
          </button>
        </div>
      </div>
    )
  }

  // ── 加入房间 ──
  if (view === 'join') {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 animate-fade-in-up">
          <button onClick={() => setView('main')} className="text-stone-600 text-sm hover:text-stone-400 transition-colors">← 返回</button>

          <div className="text-center space-y-2">
            <h2 className="font-black text-2xl text-sky-400" style={{ textShadow: '0 0 20px rgba(56,189,248,0.3)' }}>加入房间</h2>
            <p className="text-stone-500 text-sm text-emboss">输入房主告诉你的地址和房间号</p>
          </div>

          <div>
            <label className="text-stone-500 text-xs mb-1.5 block font-bold uppercase tracking-wider">你的名字</label>
            <input
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="输入你的名字"
              className="w-full glass-card rounded-xl px-4 py-3.5 text-white placeholder:text-stone-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 transition-all"
              maxLength={8}
            />
          </div>

          <div>
            <label className="text-stone-500 text-xs mb-1.5 block font-bold uppercase tracking-wider">房主地址</label>
            <input
              value={hostAddr}
              onChange={e => setHostAddr(e.target.value)}
              placeholder="如 192.168.1.42"
              className="w-full glass-card rounded-xl px-4 py-3.5 text-white placeholder:text-stone-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 transition-all font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-stone-500 text-xs mb-1.5 block font-bold uppercase tracking-wider">房间号（4位）</label>
            <input
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="如 A3K7"
              className="w-full glass-card rounded-xl px-4 py-3.5 text-white placeholder:text-stone-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 transition-all font-mono text-2xl text-center tracking-[0.5em]"
              maxLength={4}
            />
          </div>

          {error && (
            <div className="glass-panel rounded-xl px-4 py-2.5 border-red-500/30 text-red-400 text-sm text-center animate-fade-in-up">
              {error}
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={!playerName.trim() || !hostAddr.trim() || roomCode.length < 4}
            className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-500 text-black font-black rounded-xl text-base transition-all btn-3d disabled:shadow-none disabled:transform-none"
          >
            🚀 加入游戏
          </button>
        </div>
      </div>
    )
  }

  // ── 主界面 ──
  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 背景光效 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/[0.04] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-sky-500/[0.03] blur-[80px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[80px]" />
      </div>

      {/* Logo */}
      <div className="text-center mb-12 space-y-4 relative z-10 animate-slide-in-scale">
        {/* 光晕层 */}
        <div className="relative inline-block">
          <div className="absolute inset-0 text-amber-400/30 font-black text-7xl tracking-[0.3em] blur-lg select-none" aria-hidden="true">
            弈 战
          </div>
          <h1 className="text-gradient-gold font-black text-7xl tracking-[0.3em] relative">
            弈 战
          </h1>
        </div>
        <p className="text-stone-400 text-sm text-emboss tracking-widest uppercase">四人商业决策博弈</p>
        <div className="divider-gradient w-24 mx-auto" />
      </div>

      {/* 模式按钮 */}
      <div className="max-w-sm w-full space-y-3 relative z-10">
        {[
          {
            key: 'local',
            onClick: handleLocal,
            emoji: '📱',
            title: '单机模式',
            desc: '一台设备，轮流传递选牌',
            borderColor: 'border-stone-700/60',
            hoverBorder: 'hover:border-stone-500/60',
            hoverBg: 'hover:bg-stone-800/30',
            titleColor: 'text-stone-200',
            hoverTitle: 'group-hover:text-white',
            delay: 0,
          },
          {
            key: 'host',
            onClick: () => setView('host'),
            emoji: '🏠',
            title: '创建房间',
            desc: '你做房主，其他人输地址加入',
            borderColor: 'border-amber-800/50',
            hoverBorder: 'hover:border-amber-500/50',
            hoverBg: 'hover:bg-amber-950/20',
            titleColor: 'text-amber-400',
            hoverTitle: 'group-hover:text-amber-300',
            delay: 80,
          },
          {
            key: 'join',
            onClick: () => setView('join'),
            emoji: '🚀',
            title: '加入房间',
            desc: '输入房间号，加入别人的游戏',
            borderColor: 'border-sky-800/50',
            hoverBorder: 'hover:border-sky-500/50',
            hoverBg: 'hover:bg-sky-950/20',
            titleColor: 'text-sky-400',
            hoverTitle: 'group-hover:text-sky-300',
            delay: 160,
          },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={btn.onClick}
            className={`w-full glass-card ${btn.borderColor} ${btn.hoverBorder} ${btn.hoverBg} rounded-2xl p-5 text-left transition-all duration-300 cursor-pointer group animate-fade-in-up`}
            style={{ animationDelay: `${btn.delay}ms` }}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl drop-shadow-lg">{btn.emoji}</span>
              <div>
                <div className={`font-black text-lg ${btn.titleColor} ${btn.hoverTitle} transition-colors`}>{btn.title}</div>
                <div className="text-stone-500 text-sm">{btn.desc}</div>
              </div>
              <div className="ml-auto text-stone-700 group-hover:text-stone-500 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 text-center text-stone-700 text-xs relative z-10">
        <p className="text-emboss">联机模式需要所有设备在同一局域网/WiFi下</p>
      </div>
    </div>
  )
}
