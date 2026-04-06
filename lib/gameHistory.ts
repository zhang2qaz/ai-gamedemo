// =====================
// 弈战 - 跨局追踪系统（localStorage）
// =====================

export type GameRecord = {
  id: string
  timestamp: number
  themeId: string
  playerCount: number
  winner: string
  winnerProfit: number
  rounds: number
  playerResults: {
    name: string
    profit: number
    rank: number
  }[]
}

export type PlayerStats = {
  totalGames: number
  wins: number
  winStreak: number
  bestWinStreak: number
  totalProfit: number
  bestProfit: number
  favoriteTheme: string
  favoriteAction: string
  achievements: string[]
}

export type GameHistoryData = {
  records: GameRecord[]
  stats: PlayerStats
}

const STORAGE_KEY = 'yizhan_history'

function loadHistory(): GameHistoryData {
  if (typeof window === 'undefined') return defaultHistory()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultHistory()
    return JSON.parse(raw) as GameHistoryData
  } catch {
    return defaultHistory()
  }
}

function saveHistory(data: GameHistoryData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — silently fail
  }
}

function defaultHistory(): GameHistoryData {
  return {
    records: [],
    stats: {
      totalGames: 0,
      wins: 0,
      winStreak: 0,
      bestWinStreak: 0,
      totalProfit: 0,
      bestProfit: 0,
      favoriteTheme: '',
      favoriteAction: '',
      achievements: [],
    },
  }
}

// ── Achievement Definitions ──
const ACHIEVEMENTS: { id: string; name: string; emoji: string; check: (h: GameHistoryData) => boolean }[] = [
  { id: 'first_win', name: '初战告捷', emoji: '🏆', check: h => h.stats.wins >= 1 },
  { id: 'three_wins', name: '三连冠', emoji: '👑', check: h => h.stats.bestWinStreak >= 3 },
  { id: 'five_wins', name: '五连霸', emoji: '🔥', check: h => h.stats.bestWinStreak >= 5 },
  { id: 'ten_games', name: '老玩家', emoji: '🎮', check: h => h.stats.totalGames >= 10 },
  { id: 'twenty_games', name: '沙场老将', emoji: '⚔️', check: h => h.stats.totalGames >= 20 },
  { id: 'millionaire', name: '百万富翁', emoji: '💰', check: h => h.stats.bestProfit >= 1000000 },
  { id: 'all_themes', name: '全场景通关', emoji: '🌍', check: h => {
    const themes = new Set(h.records.filter(r => r.playerResults[0]?.rank === 1).map(r => r.themeId))
    return themes.size >= 4
  }},
  { id: 'comeback', name: '逆转王', emoji: '🔄', check: h => h.stats.totalGames >= 5 && h.stats.wins / h.stats.totalGames >= 0.5 },
]

export function recordGame(result: Omit<GameRecord, 'id' | 'timestamp'>): GameHistoryData {
  const history = loadHistory()

  const record: GameRecord = {
    ...result,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
  }

  history.records.push(record)

  // Keep last 100 records
  if (history.records.length > 100) {
    history.records = history.records.slice(-100)
  }

  // Update stats
  const s = history.stats
  s.totalGames++

  const isWin = result.playerResults[0]?.rank === 1 // First player is the "local" player
  if (isWin) {
    s.wins++
    s.winStreak++
    s.bestWinStreak = Math.max(s.bestWinStreak, s.winStreak)
  } else {
    s.winStreak = 0
  }

  s.totalProfit += result.winnerProfit
  s.bestProfit = Math.max(s.bestProfit, result.winnerProfit)

  // Favorite theme
  const themeCounts: Record<string, number> = {}
  history.records.forEach(r => { themeCounts[r.themeId] = (themeCounts[r.themeId] || 0) + 1 })
  s.favoriteTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  // Check achievements
  for (const ach of ACHIEVEMENTS) {
    if (!s.achievements.includes(ach.id) && ach.check(history)) {
      s.achievements.push(ach.id)
    }
  }

  saveHistory(history)
  return history
}

export function getHistory(): GameHistoryData {
  return loadHistory()
}

export function getAchievementDetails(id: string) {
  return ACHIEVEMENTS.find(a => a.id === id)
}

export function getAllAchievements() {
  return ACHIEVEMENTS
}

export function clearHistory() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
