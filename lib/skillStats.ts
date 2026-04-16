// =====================
// 弈战 - 玩家技能统计
// =====================
// 跨局追踪 6 维能力分数，用 EMA（指数移动平均）平滑。
// 让玩家"看见自己在变强"。

import type { PlayerState, RoundAuditLog, MarketForecast } from '@/engine/types'

export type SkillScores = {
  priceWar: number          // 价格战
  rdTiming: number          // 研发时机
  marketingRhythm: number   // 营销节奏
  defensivePatience: number // 守势耐心
  forecastReading: number   // 风向判断
  intelDiscernment: number  // 情报甄别
}

export const SKILL_LABELS: Record<keyof SkillScores, string> = {
  priceWar:          '价格战',
  rdTiming:          '研发布局',
  marketingRhythm:   '营销节奏',
  defensivePatience: '守势耐心',
  forecastReading:   '风向判断',
  intelDiscernment:  '情报甄别',
}

const STORAGE_KEY = 'yizhan_skills'
const EMA_ALPHA = 0.30   // 新一局的权重

export type SkillProfile = {
  scores: SkillScores
  gamesPlayed: number
  lastUpdated: number
  history: SkillScores[]   // 最近 10 局的分数
}

const DEFAULT_SCORES: SkillScores = {
  priceWar: 50,
  rdTiming: 50,
  marketingRhythm: 50,
  defensivePatience: 50,
  forecastReading: 50,
  intelDiscernment: 50,
}

export function loadSkillProfile(): SkillProfile {
  if (typeof window === 'undefined') return { scores: { ...DEFAULT_SCORES }, gamesPlayed: 0, lastUpdated: 0, history: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { scores: { ...DEFAULT_SCORES }, gamesPlayed: 0, lastUpdated: 0, history: [] }
    const parsed = JSON.parse(raw) as SkillProfile
    return parsed
  } catch {
    return { scores: { ...DEFAULT_SCORES }, gamesPlayed: 0, lastUpdated: 0, history: [] }
  }
}

function saveSkillProfile(p: SkillProfile) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // quota exceeded
  }
}

/**
 * 从一局比赛的数据计算本局的技能分（每项 0~100）
 */
export function computeSkillScoresFromGame(
  myPlayerId: string,
  logs: RoundAuditLog[],
  forecasts: MarketForecast[],
  finalPlayers: PlayerState[],
): SkillScores {
  const me = finalPlayers.find(p => p.id === myPlayerId)
  const scores: SkillScores = { ...DEFAULT_SCORES }

  if (!me || logs.length === 0) return scores

  // ── priceWar：ATK 回合中有多少回份额上涨 ──
  const atkRounds = logs.filter(log => log.players.find(p => p.id === myPlayerId)?.action === 'ATK')
  if (atkRounds.length > 0) {
    const wins = atkRounds.filter(log => {
      const me = log.players.find(p => p.id === myPlayerId)
      return me && (me.newShare - me.oldShare) > 0
    }).length
    scores.priceWar = Math.round((wins / atkRounds.length) * 100)
  }

  // ── rdTiming：QUA 回合中下一回合品质权重 >= 当回合的占比 ──
  const quaRounds = logs.filter(log => log.players.find(p => p.id === myPlayerId)?.action === 'QUA')
  if (quaRounds.length > 0) {
    let goodTiming = 0
    for (const log of quaRounds) {
      const next = logs.find(l => l.round === log.round + 1)
      if (next && next.global.qualityWeight >= log.global.qualityWeight) {
        goodTiming++
      } else if (!next) {
        // 最后一回合 QUA 没有下回合，看是否触发新品爆发
        const me = log.players.find(p => p.id === myPlayerId)
        if (me?.finalShift === 'QUALITY_CONVERT') goodTiming++
      }
    }
    scores.rdTiming = Math.round((goodTiming / quaRounds.length) * 100)
  }

  // ── marketingRhythm：终局品牌热度 / 60（达到变现门槛）──
  const heatNorm = Math.min(100, (me.brandHeat / 60) * 100)
  scores.marketingRhythm = Math.round(heatNorm)

  // ── defensivePatience：HOLD 回合的平均利润 vs 全局平均利润 ──
  const holdRounds = logs.filter(log => log.players.find(p => p.id === myPlayerId)?.action === 'HOLD')
  if (holdRounds.length > 0) {
    const avgHoldProfit = holdRounds.reduce((s, log) => {
      const me = log.players.find(p => p.id === myPlayerId)
      return s + (me?.netProfit ?? 0)
    }, 0) / holdRounds.length
    const avgAllProfit = logs.reduce((s, log) => {
      const me = log.players.find(p => p.id === myPlayerId)
      return s + (me?.netProfit ?? 0)
    }, 0) / logs.length
    // hold > avg → 100, hold < 0 → 0
    if (avgAllProfit > 0) {
      scores.defensivePatience = Math.max(0, Math.min(100, Math.round((avgHoldProfit / avgAllProfit) * 100)))
    } else {
      scores.defensivePatience = avgHoldProfit > 0 ? 80 : 30
    }
  }

  // ── forecastReading：跟对真风向的回合数 ──
  if (forecasts.length > 0) {
    let good = 0, bad = 0
    for (const log of logs) {
      const fc = forecasts.find(f => f.round === log.round)
      if (!fc) continue
      const me = log.players.find(p => p.id === myPlayerId)
      if (!me) continue
      if (me.action === fc.signal) {
        if (fc.isTrue) good++
        else bad++
      } else {
        if (!fc.isTrue) good++  // 抗住假风向也算对
      }
    }
    const total = good + bad
    if (total > 0) {
      scores.forecastReading = Math.round((good / total) * 100)
    }
  }

  // ── intelDiscernment：暂用最终利润排名作为代理 ──
  const ranked = [...finalPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const myRank = ranked.findIndex(p => p.id === myPlayerId) + 1
  if (myRank > 0) {
    scores.intelDiscernment = Math.round(((finalPlayers.length - myRank) / Math.max(1, finalPlayers.length - 1)) * 100)
  }

  return scores
}

/**
 * 用本局数据更新累积技能（EMA）
 */
export function updateSkillProfile(gameScores: SkillScores): SkillProfile {
  const prev = loadSkillProfile()
  const newScores: SkillScores = { ...prev.scores }
  for (const key of Object.keys(gameScores) as (keyof SkillScores)[]) {
    newScores[key] = Math.round(prev.scores[key] * (1 - EMA_ALPHA) + gameScores[key] * EMA_ALPHA)
  }
  const newProfile: SkillProfile = {
    scores: newScores,
    gamesPlayed: prev.gamesPlayed + 1,
    lastUpdated: Date.now(),
    history: [...prev.history, gameScores].slice(-10),
  }
  saveSkillProfile(newProfile)
  return newProfile
}

export function clearSkillProfile() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
