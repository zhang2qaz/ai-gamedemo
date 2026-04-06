// =====================
// 弈战 v2.4 - 核心参数配置
// =====================

export const CONFIG = {
  // 竞争力基础值
  baseCompetitiveness: 10,

  // 动作加成
  atkBaseBonus: 11.0,        // 原 8.0 → 独家促销变成真威胁
  mktBaseBonus: 3.0,
  qualitySignalBonus: 3.0,   // 新增 → QUA立即品质信号加成

  // 价格设定
  discountPrice: 12,
  normalPrice: 15,

  // 利润率
  discountMargin: 0.32,      // 原 0.20/0.28 → 促销单杯利润改善
  normalMargin: 0.40,
  holdReducedMargin: 0.36, // 连续 HOLD >= 2 回合

  // 行动成本
  qualityInvestCost: 80000,  // 原 150000 → 研发成本大幅降低
  marketingCost: 100000,

  // 惯性权重
  inertiaOldWeight: 0.55,
  inertiaInstantWeight: 0.38,  // 原 0.35 → 补偿动量权重下降
  inertiaMomentumWeight: 0.07, // 原 0.10 → 动量对份额贡献降低

  // HOLD 与 ATK 惩罚
  holdPressurePenalty: 1.1,  // 原 1.5 → HOLD守势损失减少，允许稳健型有胜路
  atkFatiguePenaltyFactor: 1.5,

  // Momentum
  momentumGainFromMkt: 1.2,  // 原 1.5/1.0 → 纯MKT仍有意义
  momentumCap: 3.0,
  momentumDecayEachRound: 0.5,
  momentumDecayOnHold: 2.0,  // 原 1.0 → HOLD时动量当回合即归零

  // Quality burst
  qualityBurstBase: 4.0,
  qualityBurstPerCharge: 2.0,

  // 终盘转向
  finalPushBonus: 5.0,
  finalPushProfitMultiplier: 0.92,

  // Brand Monetize
  brandMonetizeRevenueBonus: 0.10,

  // Brand Heat
  brandHeatGainFromMkt: 20,
  brandHeatDecayOther: 5,
  brandHeatCap: 80,          // 新增 → 防止品牌热度无限滚雪球
  brandHeatThresholdForMonetize: 50,

  // 最低竞争力下限
  minCompetitiveness: 6.0,

  // 动态赌注：每轮利润倍数（前期试水，后期高赌注）
  roundStakesMultiplier: [1.0, 0.6, 0.8, 1.2, 1.6, 2.5] as readonly number[],
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
