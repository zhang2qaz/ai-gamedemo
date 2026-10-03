// 《摇摆州》运行时（服务器端专用）
import type { ScenarioRuntime } from '../../runtime'
import { SCENARIO } from './content'
import { finaleModule } from './finale'
import { buildResult } from './result'

export const swingState: ScenarioRuntime = {
  scenario: SCENARIO,
  finale: finaleModule,
  result: buildResult,
}
