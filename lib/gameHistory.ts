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
const ACHIEVEMENTS: { id: string; name: string; emoji: string; desc: string; check: (h: GameHistoryData) => boolean }[] = [
  { id: 'first_win', name: '初战告捷', emoji: '🏆', desc: '赢得第一场比赛', check: h => h.stats.wins >= 1 },
  { id: 'three_wins', name: '三连冠', emoji: '👑', desc: '连续赢得3场', check: h => h.stats.bestWinStreak >= 3 },
  { id: 'five_wins', name: '五连霸', emoji: '🔥', desc: '连续赢得5场', check: h => h.stats.bestWinStreak >= 5 },
  { id: 'ten_games', name: '老玩家', emoji: '🎮', desc: '完成10场比赛', check: h => h.stats.totalGames >= 10 },
  { id: 'twenty_games', name: '沙场老将', emoji: '⚔️', desc: '完成20场比赛', check: h => h.stats.totalGames >= 20 },
  { id: 'millionaire', name: '百万富翁', emoji: '💰', desc: '单局利润超过100万', check: h => h.stats.bestProfit >= 1000000 },
  { id: 'all_themes', name: '全场景通关', emoji: '🌍', desc: '在所有4个场景中获胜', check: h => {
    const themes = new Set(h.records.filter(r => r.playerResults[0]?.rank === 1).map(r => r.themeId))
    return themes.size >= 4
  }},
  { id: 'comeback', name: '逆转王', emoji: '🔄', desc: '5场以上胜率超50%', check: h => h.stats.totalGames >= 5 && h.stats.wins / h.stats.totalGames >= 0.5 },
  // P4: 新增成就
  { id: 'tea_master', name: '茶道宗师', emoji: '☕', desc: '茶饮场景赢5场', check: h => h.records.filter(r => r.themeId === 'tea' && r.playerResults[0]?.rank === 1).length >= 5 },
  { id: 'stock_wolf', name: '华尔街之狼', emoji: '📈', desc: '股市场景赢5场', check: h => h.records.filter(r => r.themeId === 'stock' && r.playerResults[0]?.rank === 1).length >= 5 },
  { id: 'factory_king', name: '工业之王', emoji: '🏭', desc: '工厂场景赢5场', check: h => h.records.filter(r => r.themeId === 'factory' && r.playerResults[0]?.rank === 1).length >= 5 },
  { id: 'school_dean', name: '教育家', emoji: '🎓', desc: '名校场景赢5场', check: h => h.records.filter(r => r.themeId === 'school' && r.playerResults[0]?.rank === 1).length >= 5 },
  { id: 'big_game', name: '大场面', emoji: '🎪', desc: '完成一局8人游戏', check: h => h.records.some(r => r.playerCount >= 8) },
  { id: 'profit_2m', name: '财团掌门', emoji: '💎', desc: '单局利润超过200万', check: h => h.stats.bestProfit >= 2000000 },
  { id: 'fifty_games', name: '游戏大师', emoji: '🏅', desc: '完成50场比赛', check: h => h.stats.totalGames >= 50 },
]

// ── Season System ──
export function getCurrentSeason(): { number: number; name: string } {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const seasonNum = Math.floor(month / 3) + 1
  const names = ['春', '夏', '秋', '冬']
  return { number: (year - 2024) * 4 + seasonNum, name: `${year}年${names[seasonNum - 1]}季` }
}

export function getSeasonRecords(history: GameHistoryData): GameRecord[] {
  const season = getCurrentSeason()
  const now = new Date()
  const seasonStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime()
  return history.records.filter(r => r.timestamp >= seasonStart)
}

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
