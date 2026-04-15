// =====================
// 弈战 - 短视频账号运营（青少年财商主题）
// =====================
// 拟真场景：抖音/B站内容创作者竞争
// 营销动量更重要，疯狂更新更容易疲劳

import type { ThemeConfig, IntelSource, IntelCard, RoundIntel, MarketForecast } from './types'
import type { BaseAction } from '../types'

export const TEEN_DOUYIN_THEME: ThemeConfig = {
  id: 'teen-douyin',
  title: '短视频争霸',
  subtitle: '抖音赛道 · 谁是顶流',
  description: '你和几个同学都在做抖音/B站，争夺同一个赛道的粉丝和品牌合作。日更还是精品？买流量还是靠自然？每个选择都影响你的账号未来。',
  icon: '📱',
  accentClass: 'purple',

  scenario: {
    title: '抖音赛道顶流之争',
    background: `美食赛道上，四个学生博主同时起号——
你们都有才华，但平台流量就这么多。
日更三条抢曝光？还是一周一个精品视频？
花钱投DOU+还是靠自然流量慢慢涨？
五个月后，谁的粉丝最多、品牌合作最赚钱？`,
    marketName: '抖音美食赛道流量池',
  },

  companies: [
    {
      id: 'A',
      name: '深夜食堂',
      slogan: '用心做饭，用爱发电',
      style: '品质派，每条视频都像纪录片，产出慢但质量高',
      colorClass: 'amber',
    },
    {
      id: 'B',
      name: '闪电厨房',
      slogan: '60秒搞定一道菜',
      style: '效率派，日更三条，主打快手菜教程',
      colorClass: 'sky',
    },
    {
      id: 'C',
      name: '吃播小王子',
      slogan: '哪里好吃我先尝',
      style: '营销派，探店合作不断，靠互推和投放涨粉',
      colorClass: 'emerald',
    },
    {
      id: 'D',
      name: '佛系美食家',
      slogan: '不卷不急，慢慢来',
      style: '稳健派，不追热点不日更，靠自然流量和老粉维持',
      colorClass: 'purple',
    },
    {
      id: 'E',
      name: '校园干饭王',
      slogan: '食堂到外卖，全帮你试过了',
      style: '学生派，主打校园美食测评，深受同龄人喜爱',
      colorClass: 'rose',
    },
    {
      id: 'F',
      name: '知识型吃货',
      slogan: '不止好吃，更要知道为什么好吃',
      style: '知识派，把食品科学和美食结合，内容有深度',
      colorClass: 'cyan',
    },
    {
      id: 'G',
      name: '甜品实验室',
      slogan: '每一口都是甜蜜实验',
      style: '垂直派，只做甜品烘焙，受众精准但天花板低',
      colorClass: 'lime',
    },
    {
      id: 'H',
      name: '街头美食猎人',
      slogan: '犄角旮旯里的宝藏小店',
      style: '探索派，专找隐藏美食，内容有故事感',
      colorClass: 'orange',
    },
  ],

  actionNarrative: {
    ATK: {
      title: '疯狂更新',
      desc: '日更3条视频，用数量抢曝光。流量来得快但容易掉质量，而且人会很累。',
      risk: '连续日更容易"内容疲劳"——观众觉得你的视频越来越水。疲劳效果比其他行业更严重。',
    },
    QUA: {
      title: '精品内容',
      desc: '花时间精力（¥8万成本）打磨高质量视频，本月数据一般但长期涨粉快。',
      risk: '本月花了钱但数据不会立刻爆，需要耐心等下个月精品内容发酵带来的长尾流量。',
    },
    MKT: {
      title: '互推+投DOU+',
      desc: '花¥10万找博主互推、投DOU+买流量。粉丝涨但不一定是精准粉。',
      risk: '连续投放效果递减——同一批人反复看到你的推广会审美疲劳。多个博主同时投也会互相抢流量。',
    },
    HOLD: {
      title: '佛系更新',
      desc: '正常节奏更新，不花钱不冲量，靠自然流量和老粉互动。',
      risk: '在内卷赛道里不进则退——别人在疯狂更新和投流量的时候，你的曝光会被挤压。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '🔥',
      cost: '日更3条，用数量换曝光，薄利多销',
    },
    QUA: {
      emoji: '🎬',
      cost: '投入¥8万打磨精品视频，下月长尾流量大增',
    },
    MKT: {
      emoji: '📣',
      cost: '投入¥10万互推+投DOU+，快速涨粉',
    },
    HOLD: {
      emoji: '🧘',
      cost: '佛系更新，不花钱，靠自然流量',
    },
  },

  finalShiftNarrative: {
    NONE: {
      title: '不附加',
      desc: '最后一个月正常运营',
    },
    FINAL_PUSH: {
      title: '全力冲刺',
      desc: '通宵剪辑、日更5条、直播连续开——不惜透支也要冲数据（利润打八折）',
    },
    QUALITY_CONVERT: {
      title: '精品合集爆发',
      desc: '一次性放出所有积累的精品内容，集中引爆流量',
    },
    DEFENSIVE_LOCK: {
      title: '粉丝群锁客',
      desc: '建粉丝群、搞会员制，锁住核心粉丝不被别的博主抢走',
    },
    BRAND_MONETIZE: {
      title: '品牌商单变现',
      desc: '热度够高时，接品牌方的商单合作赚广告费',
    },
  },

  terms: {
    unit: '次播放',
    customers: '流量池',
    marketShare: '流量份额',
    profit: '收益',
    cumulativeProfit: '累计收益',
    brandHeat: '账号热度',
    qualityScore: '内容实力',
    newProductReserve: '精品储备',
    freshness: '观众新鲜感',
    competitiveness: '竞争力',

    brandHeatUnlock: '可接品牌商单',
    brandHeatBuilding: '投放有加成',
    brandHeatLow: '继续运营积累',
    qualityHigh: '内容力领先',
    qualityNormal: '常规水平',
    reserveHas: '终局可合集爆发',
    reserveNone: '打磨精品可积累',
    freshNormal: '日更满效',
    freshWarn: '再日更观众疲劳',
    freshDanger: '日更效果大减',
    holdPenalty: '曝光被挤压中',
    momentum: '额外流量加成',
  },

  narration: {
    atkMultiple: '多个博主同时日更疯狂输出，平台流量被分散了。',
    atkSingle: '独家高频更新，抢占了大量曝光。',
    quaDesc: '潜心打磨精品内容，下个月长尾流量会很可观。',
    mktDesc: '加大投放力度，账号热度持续上升。',
  },

  styleMap: {
    ATK: '高频输出型',
    QUA: '精品内容型',
    MKT: '流量投放型',
    HOLD: '佛系运营型',
  },

  events: [
    {
      type: 'CUSTOMER_INFLUX',
      effectRound: 3,
      signalRound: 2,
      signalText: '【平台通知】抖音即将推出美食赛道扶持计划，大量新用户将涌入美食内容区。',
      effectText: '【事件生效】美食赛道扶持上线！流量池扩大30%，新用户涌入。',
    },
    {
      type: 'PRICE_WAR_EXTERNAL',
      effectRound: 4,
      signalRound: 3,
      signalText: '【行业动态】平台开始打击低质量内容，"注水视频"会被限流。观众越来越追求高质量内容。',
      effectText: '【事件生效】平台严打注水内容！内容质量权重大幅上升，低质量日更的效果明显变差。',
    },
  ],

  playerNames: {
    A: '深夜食堂',
    B: '闪电厨房',
    C: '吃播小王子',
    D: '佛系美食家',
    E: '校园干饭王',
    F: '知识型吃货',
    G: '甜品实验室',
    H: '街头美食猎人',
  },

  // 短视频赛道：营销动量更重要，疯狂更新更容易疲劳
  configOverrides: {
    momentumGainFromMkt: 1.2,    // 社交媒体上动量积累更快
    brandHeatCap: 100,            // 热度天花板更高
    atkCooldownFactor: 0.4,       // 疯狂更新更容易疲劳（效率降至40%）
    mktConsecutiveFatigue: 0.6,   // 连续投放疲劳也更重
  },

  mechanicsDescription: '📱 短视频模式 · 营销动量积累更快 · 日更疯狂输出疲劳更重 · 热度天花板更高',

  actionExplainer: {
    ATK: {
      realWorld: '就像很多博主日更3条甚至更多——用数量换曝光。抖音上很多新号靠"量大管饱"起步，但内容质量往往不稳定。',
      risk: '连续日更观众会"审美疲劳"，效率降至只有40%（其他行业是50%）。短视频行业日更的代价比传统行业更大。',
      whenToUse: '刚起号需要快速获得曝光时；或者你判断对手不会跟进日更、你能独占流量高峰时。',
      dataPoints: '降价（日更模式），利润率 32%，无额外成本。独家日更抢流量×1.2，多人同时日更效果互相摊薄。连续日更效率仅40%。',
    },
    QUA: {
      realWorld: '就像李子柒一周出一条高质量视频——产出少但每条都是精品，长尾流量巨大。B站很多百万粉UP主都是走精品路线。',
      risk: '本月花了¥8万精力但数据不会立刻爆，需要等下个月精品内容发酵后的长尾流量。短期可能被日更的博主压着。',
      whenToUse: '想做长期账号、不急于短期数据的时候。尤其是平台打击注水内容后，精品路线的优势会倍增。',
      dataPoints: '成本 ¥8万，本月竞争力小幅提升，下月内容力+10。可积累"精品储备"，最后一轮集中放出合集。',
    },
    MKT: {
      realWorld: '就像找其他博主互推、花钱投DOU+买流量——本质是用钱换粉丝。很多MCN机构就是靠大量投放快速孵化新号。',
      risk: '连续投放效果只有60%——同一批人反复看到你的推广会点"不感兴趣"。而且买来的粉丝不一定是精准粉，可能不互动。',
      whenToUse: '想快速提升账号热度、为后续几个月铺路时。热度到50以上有额外竞争力加成。最后一轮热度够高可以"接品牌商单"。',
      dataPoints: '成本 ¥10万，账号热度+15（上限100）。热度>50有额外加成。连续投放效率仅60%。动量积累+1.2（比其他行业快50%）。',
    },
    HOLD: {
      realWorld: '就像一些博主偶尔更新、不追热点——靠已有内容的自然推荐和老粉互动维持。"佛系运营"在任何赛道都有人做。',
      risk: '短视频平台算法对"活跃度"很看重。不更新→推荐减少→曝光下降→粉丝流失，形成恶性循环。在卷的赛道里佛系很危险。',
      whenToUse: '当你账号已经有一定体量、想维持利润率时。或者判断对手都会按兵不动、你不需要主动出击的时候。',
      dataPoints: '无成本，利润率 40%（连续佛系每月+2%）。但受"曝光压力"惩罚，对手越活跃你的自然流量越少。',
    },
  },

  generateForecast(): MarketForecast[] {
    const actions: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
    const pool: Record<BaseAction, Array<{ headline: string; detail: string }>> = {
      ATK: [
        { headline: '平台流量池突然变大了', detail: '算法在推新内容，疯狂日更能吃到这波流量红利' },
        { headline: '竞品博主最近都在偷懒', detail: '对手更新频率下降了，现在日更3条可以独占曝光位' },
        { headline: '热门BGM刚出来大家都在用', detail: '趁热度还在赶紧多发几条蹭流量，晚了就过气了' },
      ],
      QUA: [
        { headline: '观众开始吐槽"都是水视频"', detail: '大家对注水内容审美疲劳了，一条精品视频比十条水视频管用' },
        { headline: '平台在内测"优质内容加权"功能', detail: '精品内容可能会获得算法额外推荐，提前布局精品路线很值' },
      ],
      MKT: [
        { headline: '有个万粉博主想找人互推', detail: '花钱投DOU+不如直接互推，借他的粉丝基础涨粉更快' },
        { headline: 'DOU+投放在搞限时折扣', detail: '平台补贴期投放性价比最高，同样的钱能买到更多曝光' },
        { headline: '赛道里突然冒出好几个新号', detail: '竞争加剧了，不花钱买流量可能连推荐页都上不了' },
      ],
      HOLD: [
        { headline: '平台算法最近在调整', detail: '规则不明朗的时候瞎操作容易踩坑，佛系更新等算法稳定再说' },
        { headline: '最近学业压力大没时间剪辑', detail: '与其赶工出质量差的视频掉粉，不如佛系更新保住口碑' },
      ],
    }
    return Array.from({ length: 5 }, (_, i) => {
      const signal = actions[Math.floor(Math.random() * 4)]
      const options = pool[signal]
      const pick = options[Math.floor(Math.random() * options.length)]
      return {
        round: i + 1,
        signal,
        isTrue: Math.random() < 0.5,
        headline: pick.headline,
        detail: pick.detail,
      }
    })
  },

  generateIntel(): RoundIntel[] {
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

    type Variant = { source: IntelSource; text: string; tag?: string }

    function slot(
      impliedAction: BaseAction,
      truePool: Variant[],
      falsePool: Variant[],
    ): IntelCard {
      const isTrue = Math.random() < 0.5
      return { ...pick(isTrue ? truePool : falsePool), isTrue, impliedAction }
    }

    const r1: RoundIntel = {
      round: 1,
      headline: '起号第一月！平台流量分配机制：活跃度和内容质量各占一半',
      cards: shuffle([
        slot('ATK',
          [
            { source: '行业报告', text: '新号期平台会给"活跃创作者"流量倾斜。日更3条曝光量远超周更1条。但多人同时日更效果会互相摊薄——平台流量池是有限的。', tag: '✅ 已验证' },
            { source: '消费者调研', text: '用户行为分析：新用户首先被"高频出现"的博主吸引，价格（内容门槛）敏感度60%。第一个月是日更抢曝光的最佳窗口。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '日更效果叠加——多人日更反而让赛道更热、吸引更多用户，大家都日更才是最优解。', tag: '⚠ 存疑' },
            { source: '分析师预测', text: '连续日更不会有疲劳效果，每月日更曝光量稳定——越早越多越好。', tag: '⚠ 逻辑存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '精品内容：本月¥8万，竞争力小幅提升，下月内容力大增。后期平台打击注水内容后精品路线价值倍增，提前积累更有价值。', tag: undefined },
            { source: '内部消息', text: '精品路线是长期主义。现在就开始积累高质量内容，到第四、五个月平台严打低质量后，你的优势会碾压日更党。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '精品内容在第一月有"新号首发效应"——系统会把高质量新号推到推荐页，内容力一次性暴涨。', tag: '⚠ 来源存疑' },
            { source: '竞品情报', text: '精品路线开局ROI高达800%，有"首发精品加成"，比后期做精品强3倍。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '投DOU+和互推成本¥10万。账号热度刚起步，距产生额外加成还远。开局投放收益有限，更多是为后续铺路。', tag: undefined },
            { source: '行业报告', text: '投放在第一月性价比最低——热度积累是渐进的。但动量积累速度比其他行业快（+1.2/月），提前布局动量有一定道理。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '率先投放的博主会建立"流量壁垒"——后续三个月曝光领先15%，不投放后期追不上。', tag: '⚠ 来源存疑' },
            { source: '分析师预测', text: '账号热度开局滚雪球效应最强，投放ROI全局最高。', tag: '⚠ 逻辑存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '佛系更新利润最高，但对手每多一个人出击你就多承受曝光压力。卷的赛道里佛系风险大，安静的赛道里佛系稳。', tag: undefined },
            { source: '行业报告', text: '佛系运营：利润率最高，但短视频算法惩罚"不活跃"的账号——对手越活跃你的自然流量越少。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '历史数据：开局佛系的博主后续胜率高32%。第一月保住精力，等对手先透支再出手。', tag: '⚠ 结论存疑' },
            { source: '监管动态', text: '首月佛系的账号流量流失率仅4%，日更的博主后续粉丝留存率低21%。佛系是正确选择。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r2: RoundIntel = {
      round: 2,
      headline: '平台美食扶持计划即将上线，下月流量要暴增！',
      cards: shuffle([
        slot('ATK',
          [
            { source: '竞品情报', text: '流量敏感度仍高。下月流量池+30%，现在抢到的份额基数更大，提前占住曝光阵地比后面再出手有利。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '流量扩张前日更效果翻倍——越早疯狂输出越有利。', tag: '⚠ 存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '行业报告', text: '下月流量池+30%已确认。新涌入的用户对各博主完全不了解，现在投放积累的热度和动量直接影响他们的关注选择。', tag: '✅ 已验证' },
          ],
          [
            { source: '分析师预测', text: '投放在流量涌入前效率最高，热度每次+35——提前布局ROI最高。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '精品内容本月即时提升竞争力，但新增流量以"随便刷刷"的用户为主，对内容深度没那么在意。精品路线更适合为后期铺路。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '新用户天然对精品内容感兴趣，精品路线在流量扩张时效益翻倍。', tag: '⚠ 来源未验证' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '佛系更新利润最高，但会错过流量涌入前积累动量和热度的窗口。下月大流量市场里没有动量意味着被甩开。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '佛系更新保住精力等流量来了再冲效率更高——过早透支只会加速疲劳。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r3: RoundIntel = {
      round: 3,
      headline: '美食扶持上线！流量暴增，但平台即将严打注水内容',
      cards: shuffle([
        slot('ATK',
          [
            { source: '行业报告', text: '流量池+30%已生效！新增用户63%是"随手刷"型，曝光量是他们选择关注的首要因素。日更在这批人身上效果最好。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '流量扩大后日更加成翻倍至+22——多人日更也不会摊薄。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '内部消息', text: '预警：下月平台严打注水内容，内容质量权重从40%升至55%。现在做精品，下月效果高出三分之一。', tag: '⚠ 待验证' },
          ],
          [
            { source: '分析师预测', text: '流量扩大时精品内容有"质量滤镜效应"——ROI全局最高，但窗口只有本月。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '投放¥10万有一定提升，但新增用户以"随便刷"为主，投放对他们吸引力有限。更适合锁住已有粉丝。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '流量扩大后投放效果翻倍——新用户品牌认知空白，DOU+影响力是平时3倍。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '行业报告', text: '佛系更新利润率最高，但这是全局最大流量池——对手越活跃你的自然流量被挤压越严重。佛系的代价在大流量市场里更大。', tag: undefined },
          ],
          [
            { source: '行业报告', text: '流量扩大时佛系最安全——新用户会自然刷到你的老内容，无需出击。', tag: '⚠ 逻辑存疑' },
          ],
        ),
      ]),
    }

    const r4: RoundIntel = {
      round: 4,
      headline: '平台严打注水内容！"精品"成为核心竞争力，日更党要小心了',
      cards: shuffle([
        slot('ATK',
          [
            { source: '消费者调研', text: '平台限流注水内容后，日更的竞争力加成变弱了。用户开始追求"有价值的内容"，日更抢曝光不如以前管用了。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '日更在严打后变成"活跃+品质"双重信号——系统反而会给活跃的精品号更多推荐。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '行业报告', text: '内容质量权重升至55%！之前积累的精品内容现在都更值钱。继续做精品可以为最后一轮"合集爆发"再攒一次储备。', tag: '✅ 已验证' },
          ],
          [
            { source: '内部消息', text: '品质权重55%时精品加成翻3倍——全局最强窗口。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '严打注水后用户开始对比各博主品质——有知名度的博主更容易被关注。投放积累的热度现在转化效率更高。', tag: undefined },
          ],
          [
            { source: '分析师预测', text: '投放在严打后效率翻倍，热度每次+30。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '佛系更新利润最高。内容质量权重升高后对有精品积累的博主有利。但没积累的话光佛系优势不大。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '倒数第二月佛系保住精力，等最后一轮再冲——这是最优解。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r5: RoundIntel = {
      round: 5,
      headline: '最后一个月！终局转向已解锁——谁能成为赛道顶流？',
      cards: shuffle([
        slot('ATK',
          [
            { source: '行业报告', text: '最终月赌注×1.5。日更+全力冲刺可以最后搏一把。适合想冲最后一波数据的博主。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '最终月日更+冲刺是100%胜率策略，数据翻倍无风险。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '如果前几月积累了"精品储备"，最后选精品内容+合集爆发可以一次性放出所有精品，竞争力暴涨。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '合集爆发不需要之前积累储备——最后一月选精品内容自动获得最大效果。', tag: '⚠ 存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '如果账号热度≥50，可以选"品牌商单变现"——额外获得10%收益加成。热度不够则无法触发。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '品牌商单不需要热度门槛，最后一月选投DOU+自动获得30%收益加成。', tag: '⚠ 存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '行业报告', text: '佛系更新+粉丝群锁客：流量防御增强。利润率×1.5倍数后收益可观。适合流量领先想守住优势的博主。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '最终月佛系+锁客是零风险策略——流量不会下降，稳拿最高收益。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    return [r1, r2, r3, r4, r5]
  },
}
