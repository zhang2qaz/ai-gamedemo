// =====================
// 弈战 - 关系图谱
// =====================
// 从对战记录推导出"故事"：宿敌、盟友、孤狼、风向标、背刺者……
// 让玩家走出游戏时不只是记得排名，还记得"我和 XX 的故事"。

import type { PlayerId, PlayerState, RoundAuditLog, Pledge } from './types'

export type RelationshipType =
  | 'NEMESIS'         // 宿敌：互相 ATK
  | 'ALLY'            // 盟友：多次同动作
  | 'LONE_WOLF'       // 孤狼：从未立誓且独立行事
  | 'AVENGER'         // 复仇者：被针对后逆袭
  | 'FOLLOWER'        // 跟随者：跟模仿别人动作
  | 'BACKSTABBER'     // 背刺者：背誓
  | 'TRENDSETTER'     // 风向标：被多人模仿
  | 'PUNCHING_BAG'    // 大冤种：被攻击最多
  | 'KINGMAKER'       // 造王者：自己没夺冠但帮了第一名
  | 'COMEBACK_KID'    // 翻盘者：从倒数第一到前三

export type Relationship = {
  type: RelationshipType
  emoji: string
  title: string
  description: string
  primary: PlayerId      // 主角
  secondary?: PlayerId   // 配角（如果有）
  evidence: string       // "R2/R3/R5 都打了对方"
}

const TYPE_META: Record<RelationshipType, { emoji: string; title: string }> = {
  NEMESIS:      { emoji: '⚔', title: '宿敌' },
  ALLY:         { emoji: '🤝', title: '盟友' },
  LONE_WOLF:    { emoji: '🐺', title: '孤狼' },
  AVENGER:      { emoji: '🗡', title: '复仇者' },
  FOLLOWER:     { emoji: '🐑', title: '跟随者' },
  BACKSTABBER:  { emoji: '🔪', title: '背刺者' },
  TRENDSETTER:  { emoji: '📡', title: '风向标' },
  PUNCHING_BAG: { emoji: '🥺', title: '大冤种' },
  KINGMAKER:    { emoji: '👑', title: '造王者' },
  COMEBACK_KID: { emoji: '🔥', title: '逆袭王' },
}

export function analyzeRelationships(
  finalPlayers: PlayerState[],
  logs: RoundAuditLog[],
  pledgesHistory: Pledge[][],
): Relationship[] {
  const result: Relationship[] = []
  const ids = finalPlayers.map(p => p.id)
  const nameOf = (id: PlayerId) => finalPlayers.find(p => p.id === id)?.name ?? id

  // ── NEMESIS：互相 ATK 至少 2 回合 ──
  const atkPair: Map<string, number[]> = new Map()
  logs.forEach(log => {
    const atkers = log.players.filter(p => p.action === 'ATK').map(p => p.id)
    if (atkers.length >= 2) {
      for (let i = 0; i < atkers.length; i++) {
        for (let j = i + 1; j < atkers.length; j++) {
          const key = [atkers[i], atkers[j]].sort().join('-')
          if (!atkPair.has(key)) atkPair.set(key, [])
          atkPair.get(key)!.push(log.round)
        }
      }
    }
  })
  for (const [key, rounds] of atkPair.entries()) {
    if (rounds.length >= 2) {
      const [a, b] = key.split('-') as [PlayerId, PlayerId]
      result.push({
        type: 'NEMESIS',
        ...TYPE_META.NEMESIS,
        primary: a, secondary: b,
        description: `${nameOf(a)} 和 ${nameOf(b)} 在 ${rounds.length} 个回合互相打价格战`,
        evidence: `R${rounds.join('/R')}`,
      })
    }
  }

  // ── ALLY：多次同时 MKT 或 QUA ──
  const allyPair: Map<string, number[]> = new Map()
  logs.forEach(log => {
    const synchs = ['MKT', 'QUA'] as const
    for (const action of synchs) {
      const same = log.players.filter(p => p.action === action).map(p => p.id)
      if (same.length >= 2) {
        for (let i = 0; i < same.length; i++) {
          for (let j = i + 1; j < same.length; j++) {
            const key = [same[i], same[j]].sort().join('-')
            if (!allyPair.has(key)) allyPair.set(key, [])
            allyPair.get(key)!.push(log.round)
          }
        }
      }
    }
  })
  for (const [key, rounds] of allyPair.entries()) {
    if (rounds.length >= 2) {
      const [a, b] = key.split('-') as [PlayerId, PlayerId]
      result.push({
        type: 'ALLY',
        ...TYPE_META.ALLY,
        primary: a, secondary: b,
        description: `${nameOf(a)} 和 ${nameOf(b)} 在 ${rounds.length} 个回合不约而同押同一边`,
        evidence: `R${rounds.join('/R')}`,
      })
    }
  }

  // ── LONE_WOLF：从未立誓 ──
  const pledgedIds = new Set<PlayerId>()
  pledgesHistory.forEach(round => round.forEach(p => pledgedIds.add(p.playerId)))
  for (const id of ids) {
    if (!pledgedIds.has(id)) {
      const rank = [...finalPlayers]
        .sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
        .findIndex(p => p.id === id) + 1
      // 只表彰排名前三的孤狼，否则太普通
      if (rank <= 3) {
        result.push({
          type: 'LONE_WOLF',
          ...TYPE_META.LONE_WOLF,
          primary: id,
          description: `${nameOf(id)} 5 回合一次都没立誓，闷声做生意走到第 ${rank} 名`,
          evidence: '从未立誓',
        })
      }
    }
  }

  // ── BACKSTABBER：背誓 ──
  const breakers: Map<PlayerId, number> = new Map()
  pledgesHistory.forEach((round, idx) => {
    const log = logs[idx]
    if (!log) return
    round.forEach(pledge => {
      const me = log.players.find(p => p.id === pledge.playerId)
      if (me && me.action !== pledge.pledgedAction) {
        breakers.set(pledge.playerId, (breakers.get(pledge.playerId) ?? 0) + 1)
      }
    })
  })
  for (const [id, count] of breakers.entries()) {
    if (count >= 1) {
      result.push({
        type: 'BACKSTABBER',
        ...TYPE_META.BACKSTABBER,
        primary: id,
        description: `${nameOf(id)} 背誓了 ${count} 次，承诺 A 实际选 B`,
        evidence: `背誓 ${count} 次`,
      })
    }
  }

  // ── TRENDSETTER：上一回合的动作被下一回合 2+ 人模仿 ──
  let trendCount: Map<PlayerId, number> = new Map()
  for (let i = 0; i < logs.length - 1; i++) {
    const cur = logs[i], next = logs[i + 1]
    for (const p of cur.players) {
      const followers = next.players.filter(q => q.id !== p.id && q.action === p.action).length
      if (followers >= 2) {
        trendCount.set(p.id, (trendCount.get(p.id) ?? 0) + 1)
      }
    }
  }
  const topTrend = [...trendCount.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topTrend && topTrend[1] >= 2) {
    result.push({
      type: 'TRENDSETTER',
      ...TYPE_META.TRENDSETTER,
      primary: topTrend[0],
      description: `${nameOf(topTrend[0])} 的动作被对手们模仿了 ${topTrend[1]} 次，成为风向标`,
      evidence: `${topTrend[1]} 轮被跟风`,
    })
  }

  // ── PUNCHING_BAG：被独家针对最多次 ──
  let attackedCount: Map<PlayerId, number> = new Map()
  for (const log of logs) {
    const atkers = log.players.filter(p => p.action === 'ATK')
    const non = log.players.filter(p => p.action !== 'ATK')
    // 简化：当有 ATK 玩家且某人不参与，他被认为是潜在被攻击对象（份额会被抢）
    if (atkers.length >= 2) {
      // 这一轮的 share 跌幅最大者计为被打
      const sorted = [...log.players].sort((a, b) => (a.newShare - a.oldShare) - (b.newShare - b.oldShare))
      const victim = sorted[0]
      if (victim && victim.action !== 'ATK') {
        attackedCount.set(victim.id, (attackedCount.get(victim.id) ?? 0) + 1)
      }
    }
  }
  const topVictim = [...attackedCount.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topVictim && topVictim[1] >= 2) {
    result.push({
      type: 'PUNCHING_BAG',
      ...TYPE_META.PUNCHING_BAG,
      primary: topVictim[0],
      description: `${nameOf(topVictim[0])} 在 ${topVictim[1]} 个回合被价格战洗劫，份额跌幅最大`,
      evidence: `${topVictim[1]} 次被洗劫`,
    })
  }

  // ── COMEBACK_KID：从单回合垫底逆袭到最终前三 ──
  for (const id of ids) {
    let wasBottom = false
    for (const log of logs.slice(0, -1)) {
      const sorted = [...log.players].sort((a, b) => a.cumulativeProfitAfter - b.cumulativeProfitAfter)
      if (sorted[0]?.id === id) wasBottom = true
    }
    if (wasBottom) {
      const finalRank = [...finalPlayers]
        .sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
        .findIndex(p => p.id === id) + 1
      if (finalRank <= 3) {
        result.push({
          type: 'COMEBACK_KID',
          ...TYPE_META.COMEBACK_KID,
          primary: id,
          description: `${nameOf(id)} 中途排末位，但最终逆袭到第 ${finalRank} 名`,
          evidence: `从倒数第 1 → 第 ${finalRank}`,
        })
      }
    }
  }

  // ── KINGMAKER：第二名（或之后）的玩家持续帮助第一名（同步动作） ──
  const ranked = [...finalPlayers].sort((a, b) => b.cumulativeProfit - a.cumulativeProfit)
  const champ = ranked[0]
  if (champ && ranked.length >= 3) {
    for (const candidate of ranked.slice(1)) {
      let synch = 0
      for (const log of logs) {
        const champAct = log.players.find(p => p.id === champ.id)?.action
        const myAct = log.players.find(p => p.id === candidate.id)?.action
        if (champAct && champAct === myAct) synch++
      }
      // 至少 3 回合同步动作 = 帮了冠军
      if (synch >= 3) {
        result.push({
          type: 'KINGMAKER',
          ...TYPE_META.KINGMAKER,
          primary: candidate.id, secondary: champ.id,
          description: `${nameOf(candidate.id)} 在 ${synch} 个回合和冠军 ${champ.name} 选了同样的动作，间接成全了对方`,
          evidence: `${synch} 轮同步`,
        })
        break // 只标一个最显著的
      }
    }
  }

  // 去重：同一对玩家最多保留 2 条关系
  const dedup: Relationship[] = []
  const pairCount: Map<string, number> = new Map()
  for (const r of result) {
    const key = r.secondary ? [r.primary, r.secondary].sort().join('-') : r.primary
    const c = pairCount.get(key) ?? 0
    if (c < 2) {
      dedup.push(r)
      pairCount.set(key, c + 1)
    }
  }

  // 限制最多 6 条
  return dedup.slice(0, 6)
}
