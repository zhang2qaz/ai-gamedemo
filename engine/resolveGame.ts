// =====================
// 弈战 v2.4 - 游戏级别辅助函数（多主题版）
// =====================

import type { PlayerState, RoundAuditLog, PlayerId } from './types'
import type { ThemeConfig } from './themes/types'

/**
 * 获取最终排名（按累计利润）
 */
export function getFinalRanking(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
}

/**
 * 获取市场份额排名
 */
export function getShareRanking(players: PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => b.marketShare - a.marketShare)
}

/**
 * 生成简单模板回合解说
 */
export function generateRoundNarration(log: RoundAuditLog, playerStates?: PlayerState[], theme?: ThemeConfig | null): string {
  const { round, players } = log
  const t = theme // 简写

  const getName = (id: PlayerId) => playerStates?.find(p => p.id === id)?.name ?? `玩家${id}`
  const topProfit = [...players].sort((a, b) => b.netProfit - a.netProfit)[0]
  const topShareGain = [...players].sort((a, b) => (b.newShare - b.oldShare) - (a.newShare - a.oldShare))[0]

  const lines: string[] = [`第 ${round} 回合结算：`]

  if (log.global.eventApplied) {
    lines.push(log.global.eventApplied)
  }

  // ATK 动作描述
  const atkPlayers = players.filter(p => p.action === 'ATK')
  if (atkPlayers.length > 1) {
    const names = atkPlayers.map(p => getName(p.id)).join('、')
    lines.push(`${names} ${t?.narration.atkMultiple ?? '同时搞促销，价格竞争激烈，双方均受疲劳影响。'}`)
  } else if (atkPlayers.length === 1) {
    lines.push(`${getName(atkPlayers[0].id)} ${t?.narration.atkSingle ?? '独家搞促销，抢占价格优势。'}`)
  }

  // QUA 描述
  const quaPlayers = players.filter(p => p.action === 'QUA')
  if (quaPlayers.length > 0) {
    lines.push(`${quaPlayers.map(p => getName(p.id)).join('、')} ${t?.narration.quaDesc ?? '投入研发新品，蓄势下回合兑现。'}`)
  }

  // MKT 描述
  const mktPlayers = players.filter(p => p.action === 'MKT')
  if (mktPlayers.length > 0) {
    lines.push(`${mktPlayers.map(p => getName(p.id)).join('、')} ${t?.narration.mktDesc ?? '加大推广投入，品牌热度持续累积。'}`)
  }

  const profitLabel = t?.terms.profit ?? '利润'
  lines.push(`本回合${profitLabel}最高：${getName(topProfit.id)}（净${profitLabel} ¥${Math.round(topProfit.netProfit).toLocaleString()}）`)

  const shareLabel = t?.terms.marketShare ?? '市场份额'
  const shareGainValue = topShareGain.newShare - topShareGain.oldShare
  if (Math.abs(shareGainValue) > 0.005) {
    const direction = shareGainValue > 0 ? '扩大' : '缩小'
    lines.push(`${shareLabel}变化最大：${getName(topShareGain.id)}（${direction} ${(Math.abs(shareGainValue) * 100).toFixed(1)}%）`)
  }

  return lines.join('\n')
}

/**
 * 生成局后总结
 */
export function generateGameNarration(
  players: PlayerState[],
  logs: RoundAuditLog[],
  theme?: ThemeConfig | null,
): string {
  const t = theme
  const ranked = getFinalRanking(players)
  const winner = ranked[0]

  const profitLabel = t?.terms.cumulativeProfit ?? '累计利润'
  const shareLabel = t?.terms.marketShare ?? '市场份额'
  const unit = t?.terms.unit ?? '单位'

  const lines: string[] = ['═══════════════════════════════', '【局后复盘】', '']

  lines.push(`最终${profitLabel}排名：`)
  ranked.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.name}：¥${Math.round(p.cumulativeProfit).toLocaleString()}`)
  })
  lines.push('')

  const shareRanked = getShareRanking(players)
  lines.push(`最终${shareLabel}排名：`)
  shareRanked.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.name}：${(p.marketShare * 100).toFixed(1)}%`)
  })
  lines.push('')

  const styleMap = t?.styleMap ?? { ATK: '价格进攻型', QUA: '产品研发型', MKT: '营销扩张型', HOLD: '精细运营型' }

  const actionCounts: Record<string, Record<string, number>> = {}
  logs.forEach(log => {
    log.players.forEach(p => {
      if (!actionCounts[p.id]) actionCounts[p.id] = { ATK: 0, QUA: 0, MKT: 0, HOLD: 0 }
      actionCounts[p.id][p.action] = (actionCounts[p.id][p.action] || 0) + 1
    })
  })

  lines.push('各品牌经营风格：')
  Object.entries(actionCounts).forEach(([id, counts]) => {
    const name = players.find(p => p.id === id)?.name ?? `玩家${id}`
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    lines.push(`  ${name}：${styleMap[dominant[0] as keyof typeof styleMap] || '均衡型'}（${dominant[0]} 占 ${dominant[1]}/5 季）`)
  })

  lines.push('')
  lines.push(`🏆 最终赢家：${winner.name}，${profitLabel} ¥${Math.round(winner.cumulativeProfit).toLocaleString()} 夺冠。`)
  lines.push('═══════════════════════════════')

  return lines.join('\n')
}
