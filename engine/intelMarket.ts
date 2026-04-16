// =====================
// 弈战 - 情报交易市场
// =====================
// 玩家可挂牌出售自己的私有情报，其他人付钱购买。
// 公开元数据（来源/可信度/暗示动作/立场/价格），
// 隐藏正文和真假，让市场出现"信息溢价"和"忽悠空间"。

import type { PlayerId, BaseAction } from './types'

export type IntelListing = {
  id: string
  sellerId: PlayerId
  sellerName: string
  round: number
  price: number
  // 公开元数据（买之前可见）
  source: string
  reliability: '高' | '中' | '低'
  hintAction: BaseAction
  stance: 'recommend' | 'warn'
  // 是否已售出
  soldTo?: PlayerId
}

export const INTEL_PRICE_PRESETS = [50_000, 100_000, 200_000] as const

let _id = 0
export function makeListingId(): string {
  return `lst-${Date.now()}-${++_id}`
}
