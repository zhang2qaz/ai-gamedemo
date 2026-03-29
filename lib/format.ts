// =====================
// 弈战 v2.4 - 格式化工具
// =====================

export function formatMoney(value: number): string {
  const abs = Math.abs(Math.round(value))
  const formatted = abs.toLocaleString('zh-CN')
  return value >= 0 ? `¥${formatted}` : `-¥${formatted}`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatDelta(value: number, unit = ''): string {
  const rounded = Math.round(value)
  const sign = rounded >= 0 ? '+' : ''
  return `${sign}${rounded.toLocaleString()}${unit}`
}

export function formatShareDelta(newShare: number, oldShare: number): string {
  const delta = (newShare - oldShare) * 100
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

export const ACTION_LABELS: Record<string, string> = {
  ATK: 'ATK 降价',
  QUA: 'QUA 品质',
  MKT: 'MKT 营销',
  HOLD: 'HOLD 守盘',
}

export const FINAL_SHIFT_LABELS: Record<string, string> = {
  NONE: '无',
  FINAL_PUSH: '终盘冲刺',
  QUALITY_CONVERT: '品质兑现',
  DEFENSIVE_LOCK: '防守锁定',
  BRAND_MONETIZE: '品牌变现',
}

export const ACTION_COLORS: Record<string, string> = {
  ATK: 'text-red-400',
  QUA: 'text-blue-400',
  MKT: 'text-yellow-400',
  HOLD: 'text-gray-400',
}

export const ACTION_BG: Record<string, string> = {
  ATK: 'bg-red-900/40 border-red-700',
  QUA: 'bg-blue-900/40 border-blue-700',
  MKT: 'bg-yellow-900/40 border-yellow-700',
  HOLD: 'bg-gray-800/40 border-gray-600',
}
