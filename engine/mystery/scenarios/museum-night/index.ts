// 《恐龙蛋失踪之夜》运行时（服务器端专用）：给小学生的剧本杀，隐藏者在玩家中间；没有终局大机制
import type { ScenarioRuntime } from '../../runtime'
import { SCENARIO } from './content'
import { buildResult } from './result'

export const museumNight: ScenarioRuntime = {
  scenario: SCENARIO,
  finale: null,
  result: buildResult,
}
