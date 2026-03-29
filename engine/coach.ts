// =====================
// 弈战 - 教练问答引擎（规则驱动）
// =====================
// 根据审计日志数据自动分析并回答玩家关于游戏机制的常见问题。
// 不依赖 AI API，纯客户端运行。

import type { RoundAuditLog, PlayerRoundCalc, PlayerState, PlayerId } from './types'
import type { ThemeConfig } from './themes/types'
import { CONFIG } from './constants'

export type CoachInsight = {
  title: string
  body: string
  category: 'share' | 'profit' | 'action' | 'strategy' | 'mechanic'
}

// ── 从最近一轮审计日志中提取所有有意义的洞察 ──
export function generateInsights(
  logs: RoundAuditLog[],
  players: PlayerState[],
  theme?: ThemeConfig | null,
): CoachInsight[] {
  if (logs.length === 0) return []
  const insights: CoachInsight[] = []
  const latest = logs[logs.length - 1]
  const t = theme?.terms
  const an = theme?.actionNarrative
  const getName = (id: string) => players.find(p => p.id === id)?.name ?? `玩家${id}`
  const getActionName = (action: string) =>
    an?.[action as keyof typeof an]?.title ?? { ATK: '促销', QUA: '研发', MKT: '推广', HOLD: '守势' }[action] ?? action
  const shareLabel = t?.marketShare ?? '份额'
  const profitLabel = t?.profit ?? '利润'

  // ── 1. 同动作不同结果 ──
  const actionGroups: Record<string, PlayerRoundCalc[]> = {}
  latest.players.forEach(p => {
    if (!actionGroups[p.action]) actionGroups[p.action] = []
    actionGroups[p.action].push(p)
  })

  for (const [action, group] of Object.entries(actionGroups)) {
    if (group.length < 2) continue
    const shareDiffs = group.map(p => ({
      id: p.id, name: getName(p.id),
      delta: p.newShare - p.oldShare,
      oldShare: p.oldShare,
      competitiveness: p.competitiveness,
      actionBonus: p.actionBonus,
      qualityBonus: p.qualityBonus,
    }))
    const gainer = shareDiffs.find(s => s.delta > 0.001)
    const loser = shareDiffs.find(s => s.delta < -0.001)

    if (gainer && loser) {
      const lines: string[] = []
      lines.push(`${gainer.name} 和 ${loser.name} 都选了「${getActionName(action)}」，但 ${gainer.name} ${shareLabel}增加了 ${(gainer.delta * 100).toFixed(1)}%，而 ${loser.name} 反而减少了 ${(Math.abs(loser.delta) * 100).toFixed(1)}%。`)
      lines.push('')
      lines.push('原因分析：')
      lines.push(`① 惯性权重（55%）：${shareLabel}高的玩家即使竞争力与他人一样，新${shareLabel}也会被"均值回归"拉低。${loser.name} 上轮${shareLabel}为 ${(loser.oldShare * 100).toFixed(1)}%，而 ${gainer.name} 仅为 ${(gainer.oldShare * 100).toFixed(1)}%。`)

      if (Math.abs(gainer.competitiveness - loser.competitiveness) > 0.5) {
        lines.push(`② 竞争力差异：${gainer.name} 竞争力 ${gainer.competitiveness.toFixed(1)}，${loser.name} 竞争力 ${loser.competitiveness.toFixed(1)}。`)
        if (Math.abs(gainer.qualityBonus - loser.qualityBonus) > 0.1) {
          lines.push(`   其中品质加成差异：${gainer.name} +${gainer.qualityBonus.toFixed(1)} vs ${loser.name} +${loser.qualityBonus.toFixed(1)}（来自之前研发积累）`)
        }
      } else {
        lines.push(`② 竞争力几乎相同（${gainer.competitiveness.toFixed(1)} vs ${loser.competitiveness.toFixed(1)}），结果差异主要由旧${shareLabel}惯性决定。`)
      }

      lines.push('')
      lines.push('公式：新' + shareLabel + ' = 55%×旧' + shareLabel + ' + 38%×即时' + shareLabel + ' + 7%×动量' + shareLabel)
      lines.push(`旧${shareLabel}高的那家做相同动作，效果会被稀释。这是防止滚雪球的核心机制。`)

      insights.push({
        title: `为何同选「${getActionName(action)}」结果不同？`,
        body: lines.join('\n'),
        category: 'share',
      })
    }
  }

  // ── 2. ATK 互博稀释 ──
  if (actionGroups['ATK'] && actionGroups['ATK'].length >= 2) {
    const atkPlayers = actionGroups['ATK']
    const avgBonus = atkPlayers.reduce((s, p) => s + p.actionBonus, 0) / atkPlayers.length
    const soloBonus = CONFIG.atkBaseBonus
    insights.push({
      title: `多人同时促销 → 效果打折`,
      body: [
        `本轮有 ${atkPlayers.length} 家同时选了促销。`,
        `促销加成公式：${CONFIG.atkBaseBonus} ÷ 促销人数 = ${(soloBonus / atkPlayers.length).toFixed(1)}（独家时为 ${soloBonus}）`,
        `平均实际加成仅 ${avgBonus.toFixed(1)}，如果只有一家促销，加成可达 ${soloBonus}。`,
        '',
        '结论：促销是强力武器，但多人同时用会严重稀释效果。观察对手倾向后独家出手最有效。',
      ].join('\n'),
      category: 'action',
    })
  }

  // ── 3. MKT 同理 ──
  if (actionGroups['MKT'] && actionGroups['MKT'].length >= 2) {
    const mktPlayers = actionGroups['MKT']
    const soloBonus = CONFIG.mktBaseBonus
    insights.push({
      title: `多人同时推广 → 效果被分摊`,
      body: [
        `本轮有 ${mktPlayers.length} 家同时推广。`,
        `推广加成公式：${CONFIG.mktBaseBonus} ÷ 推广人数 = ${(soloBonus / mktPlayers.length).toFixed(1)}`,
        `此外品牌热度超过 50 后有额外加成：(热度-50) × 0.1`,
        '',
        mktPlayers.map(p => {
          const brandHeat = p.brandHeatBefore
          const extra = Math.max(0, brandHeat - 50) * 0.1
          return `  ${getName(p.id)}：热度 ${brandHeat}，额外加成 +${extra.toFixed(1)}`
        }).join('\n'),
        '',
        '如果其中一家热度更高，虽然都在推广，竞争力也会不同。',
      ].join('\n'),
      category: 'action',
    })
  }

  // ── 4. HOLD 被压制 ──
  const holdPlayers = actionGroups['HOLD']
  if (holdPlayers && holdPlayers.length > 0) {
    const pressure = holdPlayers[0].aggressionPressure
    if (pressure >= 2) {
      insights.push({
        title: `守势玩家被进攻压力压制`,
        body: [
          `本轮进攻压力（ATK + MKT 人数）= ${pressure}`,
          `守势惩罚 = ${CONFIG.holdPressurePenalty} × ${pressure} = ${(CONFIG.holdPressurePenalty * pressure).toFixed(1)}`,
          '',
          holdPlayers.map(p =>
            `  ${getName(p.id)}：竞争力 ${p.competitiveness.toFixed(1)}（其中守势惩罚 -${p.holdPenalty.toFixed(1)}）`
          ).join('\n'),
          '',
          '当多人进攻时，守势玩家承受更大的竞争力惩罚。如果全场都在进攻，独守可能亏损严重。',
          '但如果全场都在守，惩罚接近零，守势反而是最优选择（高利润率40%）。',
        ].join('\n'),
        category: 'mechanic',
      })
    }
  }

  // ── 5. 研发积累解释 ──
  const quaPlayers = actionGroups['QUA']
  if (quaPlayers && quaPlayers.length > 0) {
    insights.push({
      title: `研发的延迟效果如何工作？`,
      body: [
        '研发是「先投入后收获」的策略：',
        `  本轮花费 ¥${(CONFIG.qualityInvestCost / 10000).toFixed(0)}万，立即获得 +${CONFIG.qualitySignalBonus} 竞争力信号`,
        '  下轮开始时品质+10（永久），储备+1（终局可爆发）',
        '',
        '品质加成公式：(品质分 - 70) × 品质权重 × 0.8',
        `当前品质权重 = ${latest.global.qualityWeight}`,
        '',
        quaPlayers.map(p =>
          `  ${getName(p.id)}：品质 ${p.qualityScoreBefore} → 下轮 ${p.qualityScoreBefore + 10}，储备 ${p.qualityChargeBefore} → ${p.qualityChargeBefore + 1}`
        ).join('\n'),
        '',
        '连续研发2轮后，品质加成会显著拉开与初始品质玩家的差距。终局还可以一键爆发所有储备。',
      ].join('\n'),
      category: 'mechanic',
    })
  }

  // ── 6. 利润差异大的情况 ──
  const profitSorted = [...latest.players].sort((a, b) => b.netProfit - a.netProfit)
  const topProfit = profitSorted[0]
  const botProfit = profitSorted[profitSorted.length - 1]
  if (topProfit.netProfit - botProfit.netProfit > 50000) {
    const topAction = topProfit.action
    const botAction = botProfit.action
    insights.push({
      title: `${profitLabel}差距从何而来？`,
      body: [
        `本轮${profitLabel}最高：${getName(topProfit.id)}（${getActionName(topAction)}）→ ¥${Math.round(topProfit.netProfit).toLocaleString()}`,
        `本轮${profitLabel}最低：${getName(botProfit.id)}（${getActionName(botAction)}）→ ¥${Math.round(botProfit.netProfit).toLocaleString()}`,
        '',
        `${profitLabel}公式：${shareLabel} × 总${t?.customers ?? '客流'} × 单价 × ${profitLabel}率 − 成本`,
        '',
        `  ${getName(topProfit.id)}：${(topProfit.newShare * 100).toFixed(1)}% × ${latest.global.totalCustomers.toLocaleString()} × ¥${topProfit.unitPrice} × ${(topProfit.margin * 100).toFixed(0)}% − ¥${topProfit.actionCost.toLocaleString()} = ¥${Math.round(topProfit.netProfit).toLocaleString()}`,
        `  ${getName(botProfit.id)}：${(botProfit.newShare * 100).toFixed(1)}% × ${latest.global.totalCustomers.toLocaleString()} × ¥${botProfit.unitPrice} × ${(botProfit.margin * 100).toFixed(0)}% − ¥${botProfit.actionCost.toLocaleString()} = ¥${Math.round(botProfit.netProfit).toLocaleString()}`,
        '',
        topAction === 'ATK'
          ? `促销虽然抢${shareLabel}，但单价仅¥${CONFIG.discountPrice}、${profitLabel}率${(CONFIG.discountMargin * 100).toFixed(0)}%，需要大量${shareLabel}才能回本。`
          : topAction === 'HOLD'
          ? `守势保持高${profitLabel}率${(CONFIG.normalMargin * 100).toFixed(0)}%且无成本，${shareLabel}稳定时是最赚钱的选择。`
          : '',
      ].join('\n'),
      category: 'profit',
    })
  }

  // ── 7. 跨轮趋势（如有多轮数据） ──
  if (logs.length >= 2) {
    const prev = logs[logs.length - 2]
    const playerIds = ['A', 'B', 'C', 'D'] as PlayerId[]
    const trends = playerIds.map(id => {
      const prevP = prev.players.find(p => p.id === id)!
      const currP = latest.players.find(p => p.id === id)!
      return {
        id, name: getName(id),
        prevAction: getActionName(prevP.action),
        currAction: getActionName(currP.action),
        shareTrend: currP.newShare - prevP.newShare,
        profitTrend: currP.netProfit - prevP.netProfit,
      }
    })

    const bigSwing = trends.find(t => Math.abs(t.shareTrend) > 0.04)
    if (bigSwing) {
      const dir = bigSwing.shareTrend > 0 ? '大幅上升' : '大幅下降'
      insights.push({
        title: `${bigSwing.name} ${shareLabel}${dir}`,
        body: [
          `${bigSwing.name} 的${shareLabel}从上轮到本轮变化了 ${(bigSwing.shareTrend * 100).toFixed(1)}%。`,
          `策略变化：上轮「${bigSwing.prevAction}」→ 本轮「${bigSwing.currAction}」`,
          '',
          bigSwing.shareTrend > 0
            ? '份额上涨通常因为：独家促销抢量、品质加成拉开差距、或对手集体守势而你在进攻。'
            : '份额下跌通常因为：多人竞争稀释、守势被进攻压制、或惯性回调（之前份额过高）。',
        ].join('\n'),
        category: 'share',
      })
    }
  }

  // ── 8. 核心规则科普（始终包含） ──
  insights.push({
    title: '核心公式速查',
    body: [
      `竞争力 = 基础(${CONFIG.baseCompetitiveness}) + 动作加成 + 品质加成 − 守势惩罚`,
      `即时${shareLabel} = 本方竞争力 ÷ 全场竞争力之和`,
      `新${shareLabel} = 55%×旧${shareLabel} + 38%×即时${shareLabel} + 7%×动量`,
      '',
      '动作加成：',
      `  促销：${CONFIG.atkBaseBonus} ÷ 促销人数（独家最强，人多互毁）`,
      `  推广：${CONFIG.mktBaseBonus} ÷ 推广人数 + 热度奖励`,
      `  研发：立即+${CONFIG.qualitySignalBonus}，下轮品质+10`,
      `  守势：无加成，但惩罚 = ${CONFIG.holdPressurePenalty} × 进攻人数`,
      '',
      `${profitLabel} = ${shareLabel} × ${t?.customers ?? '客流'} × 单价 × ${profitLabel}率 − 成本`,
      `  促销：¥${CONFIG.discountPrice}/位，${profitLabel}率${(CONFIG.discountMargin * 100).toFixed(0)}%`,
      `  正常：¥${CONFIG.normalPrice}/位，${profitLabel}率${(CONFIG.normalMargin * 100).toFixed(0)}%`,
      `  研发成本：¥${(CONFIG.qualityInvestCost / 10000).toFixed(0)}万 / 推广成本：¥${(CONFIG.marketingCost / 10000).toFixed(0)}万`,
    ].join('\n'),
    category: 'mechanic',
  })

  return insights
}
