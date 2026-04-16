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
  const beginnerMode = useMultiplayerStore(s => s.beginnerMode)
  const setBeginnerMode = useMultiplayerStore(s => s.setBeginnerMode)
  const pveMode = useMultiplayerStore(s => s.pveMode)
  const setPveMode = useMultiplayerStore(s => s.setPveMode)
  const readyStart = useMultiplayerStore(s => s.readyStart)
  const readyPlayers = useMultiplayerStore(s => s.readyPlayers)
  const readyTotal = useMultiplayerStore(s => s.readyTotal)
  const readyContext = useMultiplayerStore(s => s.readyContext)

  const isHost = mode === 'host'
  const playerCount = lobbyPlayers.length
  const canReady = playerCount >= 2 && playerCount <= 8 && themeId !== null
  const iAmReady = readyPlayers.includes(myPlayerId ?? '')

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

        {/* 新手模式 + PvE 模式（仅房主） */}
        {isHost && (
          <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            {/* 新手模式 */}
            <button
              onClick={() => setBeginnerMode(!beginnerMode)}
              className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300 ${
                beginnerMode
                  ? 'glass-card border-green-700/50 bg-green-950/20'
                  : 'glass-card border-stone-700/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{beginnerMode ? '🌱' : '⚡'}</span>
                <div className="text-left">
                  <div className={`font-bold text-sm ${beginnerMode ? 'text-green-400' : 'text-stone-300'}`}>
                    {beginnerMode ? '新手模式 · 已开启' : '标准模式'}
                  </div>
                  <div className="text-stone-500 text-xs">
                    {beginnerMode ? '无读秒限制，不限时间' : '风向30秒 + 选牌60秒倒计时'}
                  </div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-all duration-300 relative ${
                beginnerMode ? 'bg-green-600' : 'bg-stone-700'
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${
                  beginnerMode ? 'left-5.5' : 'left-0.5'
                }`} style={{ left: beginnerMode ? '22px' : '2px' }} />
              </div>
            </button>

            {/* PvE 巨头模式 */}
            <button
              onClick={() => setPveMode(!pveMode)}
              className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300 ${
                pveMode
                  ? 'glass-card border-red-700/50 bg-red-950/20'
                  : 'glass-card border-stone-700/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{pveMode ? '🦖' : '⚔️'}</span>
                <div className="text-left">
                  <div className={`font-bold text-sm ${pveMode ? 'text-red-400' : 'text-stone-300'}`}>
                    {pveMode ? 'PvE 巨头 · 已开启' : 'PvP 对抗模式'}
                  </div>
                  <div className="text-stone-500 text-xs">
                    {pveMode ? '所有玩家联手对抗一个 40% 起手份额的巨头' : '玩家之间互相竞争'}
                  </div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full transition-all duration-300 relative ${
                pveMode ? 'bg-red-600' : 'bg-stone-700'
              }`}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
                  style={{ left: pveMode ? '22px' : '2px' }} />
              </div>
            </button>
          </div>
        )}

        {/* 所有玩家的准备按钮 */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <button
            onClick={readyStart}
            disabled={!canReady || iAmReady}
            className={`w-full py-4 font-black rounded-xl text-lg transition-all duration-300 ${
              !canReady
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : iAmReady
                ? 'bg-green-900/50 border-2 border-green-600/50 text-green-400 cursor-default'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black btn-3d'
            }`}
          >
            {!themeId ? '等待房主选择主题' : playerCount < 2 ? '至少需要2人' : iAmReady ? '✓ 已准备' : '⚔ 准备开始'}
          </button>

          {/* 准备进度 */}
          {readyContext === 'start' && readyPlayers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-stone-400">{readyPlayers.length}/{readyTotal} 已准备</span>
              </div>
              <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(readyPlayers.length / Math.max(readyTotal, 1)) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {lobbyPlayers.filter(p => p.connected).map(p => {
                  const ready = readyPlayers.includes(p.id)
                  const c = PLAYER_COLORS[p.id]
                  return (
                    <span key={p.id} className={`text-xs px-2 py-0.5 rounded-lg border ${
                      ready
                        ? 'border-green-600/50 bg-green-950/30 text-green-400'
                        : 'border-stone-700/50 bg-stone-900/30 text-stone-600'
                    }`}>
                      {ready ? '✓' : '○'} <span className={c?.text ?? ''}>{p.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {!canReady && !themeId && !isHost && (
            <div className="text-center text-stone-500 text-sm animate-breathe">
              等待房主选择主题...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
