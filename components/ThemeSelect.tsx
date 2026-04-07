'use client'

import { useState, useEffect } from 'react'
import { ALL_THEMES } from '@/engine/themes'
import TutorialOverlay from './TutorialOverlay'
import { getHistory, getAllAchievements, getCurrentSeason, getSeasonRecords, type GameHistoryData } from '@/lib/gameHistory'

type Props = {
  onSelect: (themeId: string, playerCount: number) => void
}

const ACCENT_STYLES: Record<string, {
  border: string; bg: string; hoverBg: string; ring: string; title: string; icon: string
}> = {
  amber:   { border: 'border-amber-700',   bg: 'bg-amber-950/20',   hoverBg: 'hover:bg-amber-950/40',   ring: 'ring-amber-500/30',   title: 'text-amber-400',   icon: 'bg-amber-900/50' },
  sky:     { border: 'border-sky-700',     bg: 'bg-sky-950/20',     hoverBg: 'hover:bg-sky-950/40',     ring: 'ring-sky-500/30',     title: 'text-sky-400',     icon: 'bg-sky-900/50' },
  emerald: { border: 'border-emerald-700', bg: 'bg-emerald-950/20', hoverBg: 'hover:bg-emerald-950/40', ring: 'ring-emerald-500/30', title: 'text-emerald-400', icon: 'bg-emerald-900/50' },
  purple:  { border: 'border-purple-700',  bg: 'bg-purple-950/20',  hoverBg: 'hover:bg-purple-950/40',  ring: 'ring-purple-500/30',  title: 'text-purple-400',  icon: 'bg-purple-900/50' },
}

export default function ThemeSelect({ onSelect }: Props) {
  const [playerCount, setPlayerCount] = useState(4)
  const [showStats, setShowStats] = useState(false)
  const [history, setHistory] = useState<GameHistoryData | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center px-4 py-12">
      <TutorialOverlay forceShow={showTutorial} onClose={() => setShowTutorial(false)} />
      {/* 标题 */}
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-amber-400 font-black text-4xl tracking-wider">弈 战</h1>
        <p className="text-stone-500 text-sm">多人决策训练 · 选择你的战场</p>
        <div className="w-16 h-px bg-stone-700 mx-auto" />
      </div>

      {/* 人数选择器 */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="text-stone-400 text-sm font-medium">选择参与人数</div>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6, 7, 8].map(n => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`w-10 h-10 rounded-lg font-bold text-sm transition-all cursor-pointer
                ${playerCount === n
                  ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400/50 scale-110'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700 border border-stone-700'
                }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text-stone-600 text-xs">{playerCount} 位玩家参与对决</div>
      </div>

      {/* 主题卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        {ALL_THEMES.map(theme => {
          const s = ACCENT_STYLES[theme.accentClass] ?? ACCENT_STYLES.amber
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.id, playerCount)}
              className={`border-2 rounded-xl p-5 text-left transition-all cursor-pointer
                ${s.border} ${s.bg} ${s.hoverBg}
                hover:ring-2 ${s.ring} hover:scale-[1.02] active:scale-[0.98]`}
            >
              {/* 图标 + 标题 */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl ${s.icon} flex items-center justify-center text-2xl`}>
                  {theme.icon}
                </div>
                <div>
                  <div className={`font-black text-lg ${s.title}`}>{theme.title}</div>
                  <div className="text-stone-500 text-xs">{theme.subtitle}</div>
                </div>
              </div>

              {/* 描述 */}
              <p className="text-stone-400 text-sm leading-relaxed mb-3">
                {theme.description}
              </p>

              {/* 主题特色机制 */}
              {theme.mechanicsDescription && (
                <div className="text-xs text-stone-300 bg-stone-800/60 border border-stone-700/40 rounded-lg px-3 py-1.5 mb-3">
                  {theme.mechanicsDescription}
                </div>
              )}

              {/* 公司阵容 */}
              <div className="flex gap-2 flex-wrap">
                {theme.companies.slice(0, playerCount).map(c => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 border border-stone-700/50">
                    {c.name}
                  </span>
                ))}
              </div>

              {/* 底部提示 */}
              <div className={`mt-3 text-xs font-bold ${s.title} opacity-60`}>
                点击开始 →
              </div>
            </button>
          )
        })}
      </div>

      {/* P4: 战绩与成就 */}
      {history && history.stats.totalGames > 0 && (
        <div className="mt-8 w-full max-w-2xl">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-900/60 border border-stone-700/50 rounded-xl text-sm hover:bg-stone-800/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="text-amber-400 font-bold">📊 战绩中心</span>
              <span className="text-stone-500 text-xs">{getCurrentSeason().name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>{history.stats.totalGames} 场</span>
              <span>·</span>
              <span>{history.stats.wins} 胜</span>
              <span>·</span>
              <span>{history.stats.achievements.length} 成就</span>
              <span className="text-stone-600">{showStats ? '▲' : '▼'}</span>
            </div>
          </button>

          {showStats && (
            <div className="mt-2 bg-stone-900/40 border border-stone-800/50 rounded-xl p-4 space-y-4 animate-fade-in-up">
              {/* Season Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '总场次', value: history.stats.totalGames, color: 'text-stone-300' },
                  { label: '胜场', value: history.stats.wins, color: 'text-green-400' },
                  { label: '最长连胜', value: history.stats.bestWinStreak, color: 'text-amber-400' },
                  { label: '最高利润', value: `${(history.stats.bestProfit / 10000).toFixed(0)}万`, color: 'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className={`font-black text-xl font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-stone-600 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Season Ranking */}
              {(() => {
                const seasonRecords = getSeasonRecords(history)
                const seasonWins = seasonRecords.filter(r => r.playerResults[0]?.rank === 1).length
                return seasonRecords.length > 0 ? (
                  <div className="bg-stone-950/50 rounded-lg p-3">
                    <div className="text-xs text-stone-500 font-bold mb-1">
                      🏅 {getCurrentSeason().name}赛季：{seasonRecords.length} 场 / {seasonWins} 胜
                    </div>
                    <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all"
                        style={{ width: `${seasonRecords.length > 0 ? (seasonWins / seasonRecords.length * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ) : null
              })()}

              {/* Achievements */}
              <div>
                <div className="text-xs text-stone-500 font-bold mb-2">🏆 成就收集 ({history.stats.achievements.length}/{getAllAchievements().length})</div>
                <div className="grid grid-cols-4 gap-2">
                  {getAllAchievements().map(ach => {
                    const unlocked = history.stats.achievements.includes(ach.id)
                    return (
                      <div
                        key={ach.id}
                        className={`text-center p-2 rounded-lg border transition-all ${
                          unlocked
                            ? 'border-amber-700/50 bg-amber-950/20'
                            : 'border-stone-800 bg-stone-950/30 opacity-40'
                        }`}
                        title={ach.desc}
                      >
                        <div className="text-lg">{unlocked ? ach.emoji : '🔒'}</div>
                        <div className={`text-xs font-bold mt-0.5 ${unlocked ? 'text-stone-300' : 'text-stone-600'}`}>
                          {ach.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Games */}
              {history.records.length > 0 && (
                <div>
                  <div className="text-xs text-stone-500 font-bold mb-2">📜 最近对局</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {history.records.slice(-5).reverse().map(r => {
                      const isWin = r.playerResults[0]?.rank === 1
                      const themeIcons: Record<string, string> = { tea: '☕', stock: '📈', factory: '🏭', school: '🎓' }
                      return (
                        <div key={r.id} className="flex items-center gap-2 text-xs text-stone-500">
                          <span>{themeIcons[r.themeId] ?? '🎯'}</span>
                          <span className="text-stone-400">{r.playerCount}人</span>
                          <span className={isWin ? 'text-green-400 font-bold' : 'text-stone-500'}>
                            {isWin ? '🏆 胜' : `#${r.playerResults[0]?.rank ?? '?'}`}
                          </span>
                          <span className="text-stone-600">{r.winner}</span>
                          <span className="text-stone-700 ml-auto">
                            {new Date(r.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 底部说明 */}
      <div className="mt-8 text-center text-stone-700 text-xs space-y-2">
        <p>每个主题有独特机制规则 · 同一引擎不同参数</p>
        <p>{playerCount}位玩家轮流选牌 · 5回合 · 情报交易 · 最高累计利润者胜</p>
        <button
          onClick={() => setShowTutorial(true)}
          className="text-stone-600 hover:text-amber-400 transition-all text-xs cursor-pointer"
        >
          📖 重看教程
        </button>
      </div>
    </div>
  )
}
