'use client'

import { useEffect, useState } from 'react'
import {
  loadSkillProfile,
  updateSkillProfile,
  computeSkillScoresFromGame,
  SKILL_LABELS,
  type SkillScores,
  type SkillProfile,
} from '@/lib/skillStats'
import { updateSkillSnapshot } from '@/lib/gameHistory'
import type { PlayerState, RoundAuditLog, MarketForecast } from '@/engine/types'

type Props = {
  myPlayerId: string
  logs: RoundAuditLog[]
  forecasts: MarketForecast[]
  finalPlayers: PlayerState[]
}

/**
 * 6 维技能雷达图：本局得分 + 历史累积。
 * 终局自动记录到 localStorage，让玩家"看见自己在变强"。
 */
export default function SkillRadar({ myPlayerId, logs, forecasts, finalPlayers }: Props) {
  const [profile, setProfile] = useState<SkillProfile | null>(null)
  const [thisGameScores, setThisGameScores] = useState<SkillScores | null>(null)
  const [recordedRef] = useState({ done: false })

  useEffect(() => {
    if (recordedRef.done || logs.length === 0) return
    recordedRef.done = true
    const gameScores = computeSkillScoresFromGame(myPlayerId, logs, forecasts, finalPlayers)
    setThisGameScores(gameScores)
    const updated = updateSkillProfile(gameScores)
    setProfile(updated)
    // 同步技能快照到 gameHistory（驱动六边形战士、预言家成就）
    updateSkillSnapshot(updated.scores)
  }, [myPlayerId, logs, forecasts, finalPlayers, recordedRef])

  // 在 mount 之前，先加载已有的（用于首次渲染显示历史）
  useEffect(() => {
    setProfile(loadSkillProfile())
  }, [])

  if (!profile || !thisGameScores) {
    return (
      <div className="glass-card border-stone-700/40 rounded-xl p-4 text-stone-500 text-sm text-center">
        正在分析你的表现…
      </div>
    )
  }

  const keys = Object.keys(SKILL_LABELS) as (keyof SkillScores)[]

  return (
    <div className="glass-card border-blue-700/40 rounded-xl p-4 space-y-3 animate-fade-in-up">
      <div className="text-center">
        <div className="text-lg font-black text-blue-300">📊 你的技能雷达</div>
        <div className="text-xs text-stone-500 mt-0.5">已对战 {profile.gamesPlayed} 局 · 累积均分</div>
      </div>

      {/* 雷达 SVG */}
      <div className="flex justify-center">
        <RadarChart
          scoresAvg={profile.scores}
          scoresThis={thisGameScores}
          labels={SKILL_LABELS}
        />
      </div>

      {/* 详细数值 */}
      <div className="grid grid-cols-2 gap-1.5">
        {keys.map(k => {
          const avg = profile.scores[k]
          const cur = thisGameScores[k]
          const delta = cur - avg
          const arrow = delta > 3 ? '↑' : delta < -3 ? '↓' : '→'
          const arrowColor = delta > 3 ? 'text-green-400' : delta < -3 ? 'text-red-400' : 'text-stone-500'
          return (
            <div key={k} className="flex items-center justify-between px-2 py-1 bg-stone-800/30 rounded text-[11px]">
              <span className="text-stone-400">{SKILL_LABELS[k]}</span>
              <span className="font-mono">
                <span className="text-stone-300 font-bold">{avg}</span>
                <span className="text-stone-700 mx-0.5">·</span>
                <span className="text-stone-500">本局 {cur}</span>
                <span className={`ml-1 ${arrowColor}`}>{arrow}</span>
              </span>
            </div>
          )
        })}
      </div>

      <div className="text-[10px] text-stone-600 text-center">
        雷达图：浅色 = 累积均分，亮色 = 本局得分
      </div>
    </div>
  )
}

// ── 雷达 SVG ──
function RadarChart({
  scoresAvg, scoresThis, labels,
}: {
  scoresAvg: SkillScores
  scoresThis: SkillScores
  labels: Record<keyof SkillScores, string>
}) {
  const size = 240
  const center = size / 2
  const radius = 85
  const keys = Object.keys(labels) as (keyof SkillScores)[]
  const angleStep = (Math.PI * 2) / keys.length

  function point(value: number, idx: number, scale = 1) {
    const angle = -Math.PI / 2 + idx * angleStep
    const r = (value / 100) * radius * scale
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r]
  }

  const polyAvg = keys.map((k, i) => point(scoresAvg[k], i).join(',')).join(' ')
  const polyThis = keys.map((k, i) => point(scoresThis[k], i).join(',')).join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 同心圆参考 */}
      {[0.25, 0.5, 0.75, 1].map(r => (
        <circle
          key={r}
          cx={center} cy={center} r={radius * r}
          fill="none" stroke="rgb(68 64 60 / 0.4)" strokeWidth={1}
        />
      ))}
      {/* 轴线 */}
      {keys.map((_, i) => {
        const [x, y] = point(100, i)
        return (
          <line
            key={i}
            x1={center} y1={center} x2={x} y2={y}
            stroke="rgb(68 64 60 / 0.4)" strokeWidth={1}
          />
        )
      })}
      {/* 累积均分多边形（浅蓝） */}
      <polygon
        points={polyAvg}
        fill="rgb(59 130 246 / 0.15)"
        stroke="rgb(59 130 246 / 0.6)"
        strokeWidth={1.5}
      />
      {/* 本局得分多边形（亮琥珀） */}
      <polygon
        points={polyThis}
        fill="rgb(245 158 11 / 0.25)"
        stroke="rgb(251 191 36 / 0.95)"
        strokeWidth={2}
      />
      {/* 标签 */}
      {keys.map((k, i) => {
        const [x, y] = point(125, i)
        return (
          <text
            key={k}
            x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgb(168 162 158)"
            fontSize={11}
            fontWeight="bold"
          >
            {labels[k]}
          </text>
        )
      })}
    </svg>
  )
}
