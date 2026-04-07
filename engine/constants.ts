// =====================
// 弈战 v2.4 - 核心参数配置
// =====================

export const CONFIG = {
  // 竞争力基础值
  baseCompetitiveness: 10,

  // 动作加成
  atkBaseBonus: 10.0,         // 促销进攻
  mktBaseBonus: 5.5,          // P0-2: 推广加成提升（需足够回本100k成本）
  qualitySignalBonus: 4.0,    // QUA立即信号更强

  // 价格设定
  discountPrice: 12,
  normalPrice: 15,

  // 利润率
  discountMargin: 0.32,      // 原 0.20/0.28 → 促销单杯利润改善
  normalMargin: 0.40,
  holdReducedMargin: 0.36, // 连续 HOLD >= 2 回合

  // 行动成本
  qualityInvestCost: 75000,  // 研发成本降低让QUA策略更可行
  marketingCost: 90000,       // 降低推广成本让MKT更有竞争力

  // 惯性权重
  inertiaOldWeight: 0.55,
  inertiaInstantWeight: 0.38,  // 原 0.35 → 补偿动量权重下降
  inertiaMomentumWeight: 0.07, // 原 0.10 → 动量对份额贡献降低

  // HOLD 与 ATK 机制
  holdPressurePenalty: 0.5,  // P0-3: 小幅竞争力惩罚（市场不进则退）
  holdMarginBoostPerRound: 0.02, // P0-3: 每连续HOLD +2% 利润率（补偿份额损失）
  holdDefenseBarrier: 0.85,  // P0-3: HOLD时份额损失缓冲15%
  atkCooldownFactor: 0.5,    // P0-1: 连续ATK效率降至50%（冷却机制替代疲劳惩罚）
  atkSoloInflux: 1.2,        // P0-1: 独家促销获客量 ×1.2

  // Momentum
  momentumGainFromMkt: 0.8,  // P0-2: 原1.2→0.8 降低MKT动量累积速度
  mktConsecutiveFatigue: 0.7, // P0-2: 连续MKT效率降至70%
  momentumCap: 3.0,
  momentumDecayEachRound: 0.5,
  momentumDecayOnHold: 2.0,  // 原 1.0 → HOLD时动量当回合即归零

  // Quality burst（终盘爆发力增强）
  qualityBurstBase: 5.0,
  qualityBurstPerCharge: 3.0,

  // 终盘转向
  finalPushBonus: 5.0,
  finalPushProfitMultiplier: 0.92,

  // Brand Monetize
  brandMonetizeRevenueBonus: 0.10,

  // Brand Heat
  brandHeatGainFromMkt: 15,  // P0-2: 原20→15 适度抑制MKT滚雪球
  brandHeatDecayOther: 5,
  brandHeatCap: 80,          // 新增 → 防止品牌热度无限滚雪球
  brandHeatThresholdForMonetize: 50,

  // 最低竞争力下限
  minCompetitiveness: 6.0,

  // 动态赌注：每轮利润倍数（平缓曲线，避免R5决定一切）
  roundStakesMultiplier: [1.0, 0.8, 0.9, 1.0, 1.2, 1.5] as readonly number[],
  // index 0 = unused, 1-5 = 各轮倍数
}

// 默认名称池（最多 8 人）
const DEFAULT_NAMES: Record<string, string> = {
  A: '晨露茶饮', B: '闪点咖啡', C: '星野饮品', D: '稳杯茶饮',
  E: '青桐饮品', F: '海棠工坊', G: '云岭茗茶', H: '朝阳果饮',
}

/**
 * 生成 N 人初始状态（2-8人）
 */
export function createInitialPlayerStates(playerCount: number, names?: Record<string, string>) {
  const ids = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).slice(0, playerCount)
  const share = 1 / playerCount
  return ids.map(id => ({
    id,
    name: names?.[id] ?? DEFAULT_NAMES[id] ?? `玩家${id}`,
    cash: 1000000,
    marketShare: share,
    qualityScore: 70,
    brandHeat: 30,
    cumulativeProfit: 0,
    marketMomentum: 0,
    fatigueIndex: 0,
    qualityCharge: 0,
    lastAction: null as null,
    consecutiveHoldCount: 0,
  }))
}

// 兼容旧代码：默认4人
export const INITIAL_PLAYER_STATES = createInitialPlayerStates(4)

export const INITIAL_GLOBAL_STATE: {
  roundNumber: number
  maxRounds: number
  totalCustomers: number
  priceSensitivity: number
  qualityWeight: number
  eventQueue: import('./types').GameEvent[]
} = {
  roundNumber: 1,
  maxRounds: 5,
  totalCustomers: 100000,
  priceSensitivity: 0.6,
  qualityWeight: 0.4,
  eventQueue: [],
}
