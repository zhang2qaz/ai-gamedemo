// =====================
// 弈战 - 主题注册表
// =====================

import type { ThemeConfig } from './types'
import { TEA_THEME } from './tea'
import { STOCK_THEME } from './stock'
import { FACTORY_THEME } from './factory'
import { SCHOOL_THEME } from './school'

export const ALL_THEMES: ThemeConfig[] = [
  TEA_THEME,
  STOCK_THEME,
  FACTORY_THEME,
  SCHOOL_THEME,
]

export function getTheme(id: string): ThemeConfig {
  return ALL_THEMES.find(t => t.id === id) ?? TEA_THEME
}

export type { ThemeConfig } from './types'
export type { RoundIntel, IntelCard, IntelSource, CompanyProfile } from './types'
