// =====================
// 弈战 - 差异化私有情报
// =====================
// 每人每回合收到一份只有自己能看的线索，和其他人不同。
// 目的：杀死"正确答案"，逼出判断和交流。

import type { PlayerId, BaseAction } from './types'

export type PrivateIntel = {
  round: number
  source: string              // 情报源（你的市场团队 / 竞品卧底 / 内部匿名信）
  text: string                // 具体内容
  hintAction: BaseAction      // 暗示哪个动作
  stance: 'recommend' | 'warn'  // 推荐 vs 警告
  isTrue: boolean             // 真实度（玩家不知道）
  reliability: '高' | '中' | '低'  // 情报源可信度（玩家可见）
}

const SOURCES = {
  high: ['行业卧底A', '董事会内线', '你的首席分析师', '前竞品高管'],
  medium: ['渠道经理', '供应链情报', '市场研究团队', '海外代理'],
  low: ['匿名爆料', '社交媒体小道', '出租车司机', '展会传闻'],
}

type Template = {
  hintAction: BaseAction
  stance: 'recommend' | 'warn'
  texts: string[]  // 随机挑一句
}

// ── 情报文案库 ──
const TEMPLATES: Template[] = [
  // ATK
  {
    hintAction: 'ATK', stance: 'recommend',
    texts: [
      '本轮价格敏感消费者比例比公告数据高，降价能多抢不少',
      '两个对手的财务吃紧，他们不敢打价格战，降价基本无竞争',
      '供应链成本突降，本轮降价不会伤利润',
    ],
  },
  {
    hintAction: 'ATK', stance: 'warn',
    texts: [
      '本轮有 2 家以上准备降价，多方价格战会互相摊薄',
      '消费者被连续促销教育得过敏，降价转化率低于预期',
      '本轮原料涨价，降价会打穿毛利',
    ],
  },
  // QUA
  {
    hintAction: 'QUA', stance: 'recommend',
    texts: [
      '下回合品质权重会上调，现在投入研发的复利最高',
      '一家竞品的 R&D 实验室出问题，技术投入的相对差距在扩大',
      '内部模型显示：本轮 QUA 的 ROI 被低估',
    ],
  },
  {
    hintAction: 'QUA', stance: 'warn',
    texts: [
      '市场对新品的反应疲软，本轮 QUA 变现节奏可能不如预期',
      '研发项目容易被对手抄袭，下回合对手跟进概率 > 60%',
    ],
  },
  // MKT
  {
    hintAction: 'MKT', stance: 'recommend',
    texts: [
      '某头部 KOL 的坑位空档被挤出，本轮营销曝光性价比极高',
      '本轮对手都按兵不动，营销投入独占声量窗口',
      '消费者在品牌认知阶段，营销积累能直接带来动量',
    ],
  },
  {
    hintAction: 'MKT', stance: 'warn',
    texts: [
      '多家对手已秘密采购本轮的 KOL 资源，效果会摊薄',
      '本轮品牌热度对竞争力的贡献被高估',
      '平台算法调整，KOL 种草效率本轮打折',
    ],
  },
  // HOLD
  {
    hintAction: 'HOLD', stance: 'recommend',
    texts: [
      '多数对手本轮会激进出击，守势可以坐收价格战的摊薄红利',
      '你上回合疲劳度接近临界，本轮守一回合恢复利润率',
      '市场总量本轮不涨，抢不动不如保利润',
    ],
  },
  {
    hintAction: 'HOLD', stance: 'warn',
    texts: [
      '本轮对手全体蓄势，守势会被包围失去份额',
      '连续守势即将触发利润率下滑机制，这一回合可能是最后的窗口',
    ],
  },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 为每位玩家生成 5 回合的私有情报（每人每回合 1 张）
 * 玩家之间的情报不同 → 逼出判断和交流。
 */
export function generatePrivateIntel(playerIds: PlayerId[], maxRounds = 5): Record<PlayerId, PrivateIntel[]> {
  const result: Partial<Record<PlayerId, PrivateIntel[]>> = {}

  for (const pid of playerIds) {
    const intel: PrivateIntel[] = []
    for (let round = 1; round <= maxRounds; round++) {
      // 每回合独立抽样：可信度 + 真假 + 模板
      const reliabilityRoll = Math.random()
      const reliability: '高' | '中' | '低' =
        reliabilityRoll < 0.35 ? '高' :
        reliabilityRoll < 0.75 ? '中' : '低'
      // 可信度越高，真实概率越高：高 85% / 中 65% / 低 40%
      const trueProb = reliability === '高' ? 0.85 : reliability === '中' ? 0.65 : 0.40
      const isTrue = Math.random() < trueProb

      const sourceKey: 'high' | 'medium' | 'low' =
        reliability === '高' ? 'high' : reliability === '中' ? 'medium' : 'low'
      const source = pick(SOURCES[sourceKey])

      const tpl = pick(TEMPLATES)
      const text = pick(tpl.texts)

      intel.push({
        round,
        source,
        text,
        hintAction: tpl.hintAction,
        stance: tpl.stance,
        isTrue,
        reliability,
      })
    }
    // 同一玩家跨回合的动作暗示尽量多样化
    // （简单打散；不过度设计）
    result[pid] = intel
  }

  return result as Record<PlayerId, PrivateIntel[]>
}
