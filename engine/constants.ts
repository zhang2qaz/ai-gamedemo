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
  finalPushBonus: 4.0,
  finalPushProfitMultiplier: 0.8,

  // Brand Monetize（故意设弱）
  brandMonetizeRevenueBonus: 0.03,

  // Brand Heat
  brandHeatGainFromMkt: 20,
  brandHeatDecayOther: 5,
  brandHeatCap: 80,          // 新增 → 防止品牌热度无限滚雪球
  brandHeatThresholdForMonetize: 70,

  // 最低竞争力下限
  minCompetitiveness: 6.0,
}

// 初始玩家状态（名称与叙事层的 COMPANIES 对齐）
export const INITIAL_PLAYER_STATES = [
  { id: 'A' as const, name: '晨露茶饮', cash: 1000000, marketShare: 0.25, qualityScore: 70, brandHeat: 30, cumulativeProfit: 0, marketMomentum: 0, fatigueIndex: 0, qualityCharge: 0, lastAction: null, consecutiveHoldCount: 0 },
  { id: 'B' as const, name: '闪点咖啡', cash: 1000000, marketShare: 0.25, qualityScore: 70, brandHeat: 30, cumulativeProfit: 0, marketMomentum: 0, fatigueIndex: 0, qualityCharge: 0, lastAction: null, consecutiveHoldCount: 0 },
  { id: 'C' as const, name: '星野饮品', cash: 1000000, marketShare: 0.25, qualityScore: 70, brandHeat: 30, cumulativeProfit: 0, marketMomentum: 0, fatigueIndex: 0, qualityCharge: 0, lastAction: null, consecutiveHoldCount: 0 },
  { id: 'D' as const, name: '稳杯茶饮', cash: 1000000, marketShare: 0.25, qualityScore: 70, brandHeat: 30, cumulativeProfit: 0, marketMomentum: 0, fatigueIndex: 0, qualityCharge: 0, lastAction: null, consecutiveHoldCount: 0 },
]

export const INITIAL_GLOBAL_STATE = {
  roundNumber: 1,
  maxRounds: 5,
  totalCustomers: 100000,
  priceSensitivity: 0.6,
  qualityWeight: 0.4,
}
