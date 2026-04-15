// =====================
// 弈战 - 主题注册表
// =====================

import type { ThemeConfig } from './types'
import { TEA_THEME } from './tea'
import { STOCK_THEME } from './stock'
import { FACTORY_THEME } from './factory'
import { SCHOOL_THEME } from './school'
import { TEEN_MILKTEA_THEME } from './teen-milktea'
import { TEEN_SNEAKER_THEME } from './teen-sneaker'
import { TEEN_DOUYIN_THEME } from './teen-douyin'
import { ROBOT_VACUUM_THEME } from './robot-vacuum'

export const ALL_THEMES: ThemeConfig[] = [
  TEA_THEME,
  STOCK_THEME,
  FACTORY_THEME,
  SCHOOL_THEME,
  TEEN_MILKTEA_THEME,
  TEEN_SNEAKER_THEME,
  TEEN_DOUYIN_THEME,
  ROBOT_VACUUM_THEME,
]

export function getTheme(id: string): ThemeConfig {
  return ALL_THEMES.find(t => t.id === id) ?? TEA_THEME
}

export type { ThemeConfig } from './types'
export type { RoundIntel, IntelCard, IntelSource, CompanyProfile } from './types'
