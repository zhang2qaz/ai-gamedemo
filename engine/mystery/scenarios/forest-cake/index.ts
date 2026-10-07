// 《草莓蛋糕不见了！》运行时（服务器端专用）：给小学生的入门剧本杀，没有终局大机制
import type { ScenarioRuntime } from '../../runtime'
import { SCENARIO } from './content'
import { buildResult } from './result'

export const forestCake: ScenarioRuntime = {
  scenario: SCENARIO,
  finale: null,
  result: buildResult,
}
