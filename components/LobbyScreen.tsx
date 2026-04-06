'use client'

import { useMultiplayerStore } from '@/store/multiplayerStore'
import { ALL_THEMES } from '@/engine/themes'
import { ALL_PLAYER_IDS } from '@/engine/types'
import { PLAYER_COLORS } from '@/lib/playerColors'

export default function LobbyScreen() {
  const mode = useMultiplayerStore(s => s.mode)
  const roomCode = useMultiplayerStore(s => s.roomCode)
  const hostIp = useMultiplayerStore(s => s.hostIp)
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const lobbyPlayers = useMultiplayerStore(s => s.lobbyPlayers)
  const themeId = useMultiplayerStore(s => s.themeId)
  const selectTheme = useMultiplayerStore(s => s.selectTheme)
  const startGame = useMultiplayerStore(s => s.startGame)
  const backToModeSelect = useMultiplayerStore(s => s.backToModeSelect)

  const isHost = mode === 'host'
  const playerCount = lobbyPlayers.length
  const canStart = isHost && playerCount >= 2 && playerCount <= 8 && themeId !== null

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center px-4 py-8 relative overflow-hidden">
      {/* 背景光效 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[100px]" />
      </div>

      {/* 返回 */}
      <div className="w-full max-w-lg relative z-10">
        <button onClick={backToModeSelect} className="text-stone-600 text-sm hover:text-stone-400 mb-6 transition-colors">← 退出房间</button>
      </div>

      {/* 房间信息 */}
      <div className="text-center mb-8 space-y-4 relative z-10 animate-slide-in-scale">
        <h2 className="text-gradient-gold font-black text-xl">
          {isHost ? '等待玩家加入' : '已加入房间'}
        </h2>

        <div className="glass-card rounded-2xl px-8 py-5 inline-block glow-amber">
          <div className="text-stone-500 text-xs mb-1.5 font-bold uppercase tracking-wider">房间号</div>
          <div className="text-gradient-gold font-mono font-black text-5xl tracking-[0.5em]">{roomCode}</div>
        </div>

        {isHost && hostIp && (
          <div className="text-stone-500 text-sm">
            其他玩家访问 <span className="text-stone-300 font-mono glass-panel rounded-lg px-2 py-0.5 text-xs">http://{hostIp}:3000</span>
          </div>
        )}
      </div>

      <div className="max-w-lg w-full space-y-6 relative z-10">
        {/* 玩家列表 */}
        <div className="animate-fade-in-up">
          <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-3">已加入的玩家 ({playerCount}/8)</div>
          <div className="grid grid-cols-2 gap-3">
            {ALL_PLAYER_IDS.map((id, i) => {
              const player = lobbyPlayers.find(p => p.id === id)
              const c = PLAYER_COLORS[id]
              const isMe = id === myPlayerId
              return (
                <div
                  key={id}
                  className={`rounded-xl p-3.5 transition-all duration-300 animate-fade-in-up ${
                    player
                      ? `glass-card ${c.border}/50`
                      : 'border-2 border-dashed border-stone-800 bg-stone-900/20'
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {player ? (
                    <div className="flex items-center gap-2">
                      <div className={`font-black ${c.text}`} style={{ textShadow: `0 0 10px currentColor` }}>
                        {player.name}
                      </div>
                      {isMe && <span className="text-xs bg-white/10 text-white px-1.5 py-0.5 rounded-md font-bold">你</span>}
                      {id === 'A' && <span className="text-xs badge-gold px-1.5 py-0.5 rounded-md">房主</span>}
                    </div>
                  ) : (
                    <div className="text-stone-700 text-sm animate-breathe">空位 · 等待加入</div>
                  )}
                  <div className="text-stone-600 text-xs mt-1">
                    玩家 {id}
                    {player && !player.connected && <span className="text-red-500 ml-1 text-glow-red">· 已断线</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 主题选择（仅房主） */}
        {isHost && (
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-3">选择主题</div>
            <div className="grid grid-cols-2 gap-3">
              {ALL_THEMES.map((theme, i) => (
                <button
                  key={theme.id}
                  onClick={() => selectTheme(theme.id)}
                  className={`rounded-xl p-3.5 text-left transition-all duration-300 cursor-pointer animate-fade-in-up ${
                    themeId === theme.id
                      ? 'glass-card border-amber-400/60 glow-amber'
                      : 'glass-card border-stone-700/40 hover:border-stone-500/50'
                  }`}
                  style={{ animationDelay: `${300 + i * 60}ms` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl drop-shadow-lg">{theme.icon}</span>
                    <div>
                      <div className="font-bold text-sm text-stone-200">{theme.title}</div>
                      <div className="text-stone-600 text-xs">{theme.subtitle}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 非房主看到已选主题 */}
        {!isHost && themeId && (() => {
          const theme = ALL_THEMES.find(t => t.id === themeId)
          return theme ? (
            <div className="text-center text-stone-400 text-sm glass-panel rounded-xl px-4 py-3 animate-fade-in-up">
              房主已选择主题: <span className="text-white font-bold">{theme.icon} {theme.title}</span>
            </div>
          ) : null
        })()}

        {/* 开始按钮 */}
        {isHost && (
          <button
            onClick={startGame}
            disabled={!canStart}
            className={`w-full py-4 font-black rounded-xl text-lg transition-all duration-300 animate-fade-in-up ${
              canStart
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black btn-3d'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
            style={{ animationDelay: '400ms' }}
          >
            {!themeId ? '请先选择主题' : playerCount < 2 ? '至少需要2人' : `⚔ 开始游戏（${playerCount}人）`}
          </button>
        )}

        {!isHost && (
          <div className="text-center text-stone-500 text-sm py-4 animate-breathe">
            等待房主开始游戏...
          </div>
        )}
      </div>
    </div>
  )
}
