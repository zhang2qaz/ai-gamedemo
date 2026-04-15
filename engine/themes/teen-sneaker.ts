// =====================
// 弈战 - 二手球鞋交易（青少年财商主题）
// =====================
// 拟真场景：得物/闲鱼上的球鞋倒卖竞争
// 价格敏感度更高，稀缺货源（品质）权重更大

import type { ThemeConfig, IntelSource, IntelCard, RoundIntel, MarketForecast } from './types'
import type { BaseAction } from '../types'

export const TEEN_SNEAKER_THEME: ThemeConfig = {
  id: 'teen-sneaker',
  title: '球鞋交易所',
  subtitle: '得物江湖 · 谁是鞋王',
  description: '你和几个同学在得物/闲鱼上做球鞋倒卖生意，争夺同一批买家。降价甩货还是囤稀缺款？每双鞋都是一次博弈。',
  icon: '👟',
  accentClass: 'sky',

  scenario: {
    title: '得物球鞋交易江湖',
    background: `球鞋圈子里，四个卖家盯上了同一批买家——
AJ联名款刚发售、椰子要复刻、Nike Dunk持续火热，
你们手里都有货，但买家就这么多。
是降价快速出手，还是囤着等涨价？
五个交易周期后，谁赚得最多谁就是鞋王。`,
    marketName: '本地球鞋二手交易市场',
  },

  companies: [
    {
      id: 'A',
      name: '稀有球鞋铺',
      slogan: '只做限量，不碰通货',
      style: '品质派，专注限量款和联名款，靠稀缺性溢价',
      colorClass: 'amber',
    },
    {
      id: 'B',
      name: '闪电出货',
      slogan: '当天发货，价格最低',
      style: '效率派，走量为主，薄利多销快速出手',
      colorClass: 'sky',
    },
    {
      id: 'C',
      name: '球鞋种草机',
      slogan: '穿搭教程+球鞋评测',
      style: '营销派，靠社交媒体内容带货，有流量就有订单',
      colorClass: 'emerald',
    },
    {
      id: 'D',
      name: '老鞋贩子',
      slogan: '圈里十年，信誉保证',
      style: '稳健派，靠老客户和口碑做生意，不追热点',
      colorClass: 'purple',
    },
    {
      id: 'E',
      name: '潮鞋研究所',
      slogan: '买鞋之前先看我',
      style: '知识派，靠专业鉴定和市场分析赢得信任',
      colorClass: 'rose',
    },
    {
      id: 'F',
      name: '校园球鞋代',
      slogan: '同学之间，价格好商量',
      style: '社交派，靠校内人脉和口碑传播做生意',
      colorClass: 'cyan',
    },
    {
      id: 'G',
      name: '海外直邮铺',
      slogan: '正品直邮，全球好价',
      style: '渠道派，靠海外进货渠道做差异化竞争',
      colorClass: 'lime',
    },
    {
      id: 'H',
      name: '二手翻新王',
      slogan: '旧鞋翻新，性价比之王',
      style: '性价比派，专做二手翻新和中端市场',
      colorClass: 'orange',
    },
  ],

  actionNarrative: {
    ATK: {
      title: '降价甩货',
      desc: '低于市场价出货，快速成交但每双赚得少。当多个卖家同时降价，利润会被严重压缩。',
      risk: '频繁降价会让买家觉得"再等等会更便宜"，连续甩货效果递减。',
    },
    QUA: {
      title: '找稀缺货源',
      desc: '花时间精力（¥8万成本）找限量款和联名款，下个周期手里的货竞争力大增。',
      risk: '本周期花了钱但看不到回报，需要等下个交易周期新货到手才有优势。',
    },
    MKT: {
      title: '社交媒体种草',
      desc: '花¥10万拍开箱视频、发球鞋评测，提升你在圈子里的知名度和关注度。',
      risk: '连续发内容效果递减——粉丝会审美疲劳。多个卖家同时种草也会互相摊薄流量。',
    },
    HOLD: {
      title: '观望等涨价',
      desc: '不出手，等行情上涨。利润率最高（40%），但可能被别人抢走买家。',
      risk: '如果对手在积极抢客，你的买家会被分走。市场不等人，"等等党"也有代价。',
    },
  },

  actionCards: {
    ATK: {
      emoji: '💸',
      cost: '低价出货，薄利多销抢买家',
    },
    QUA: {
      emoji: '🔍',
      cost: '投入¥8万找限量货源，下周期货品力大增',
    },
    MKT: {
      emoji: '📱',
      cost: '投入¥10万拍内容种草，提升圈内知名度',
    },
    HOLD: {
      emoji: '⏳',
      cost: '按兵不动，等行情上涨，利润最高',
    },
  },

  finalShiftNarrative: {
    NONE: {
      title: '不附加',
      desc: '最后一个交易周期正常操作',
    },
    FINAL_PUSH: {
      title: '清仓大甩卖',
      desc: '所有库存低价清仓，不惜代价把货全出手（利润打八折）',
    },
    QUALITY_CONVERT: {
      title: '限量款集中发售',
      desc: '一次性放出所有囤的限量款，制造稀缺效应碾压对手',
    },
    DEFENSIVE_LOCK: {
      title: '老客户预售',
      desc: '给老买家开预售锁定订单，防止被对手抢走',
    },
    BRAND_MONETIZE: {
      title: '品牌合作带货',
      desc: '知名度够高时，接品牌方的合作推广赚代言费',
    },
  },

  terms: {
    unit: '双',
    customers: '买家',
    marketShare: '市场份额',
    profit: '利润',
    cumulativeProfit: '累计利润',
    brandHeat: '圈内热度',
    qualityScore: '货品实力',
    newProductReserve: '限量款储备',
    freshness: '买家兴趣',
    competitiveness: '竞争力',

    brandHeatUnlock: '可接品牌合作',
    brandHeatBuilding: '种草有加成',
    brandHeatLow: '继续种草积累',
    qualityHigh: '货源优势明显',
    qualityNormal: '常规货品',
    reserveHas: '终局可集中发售',
    reserveNone: '找货源可积累',
    freshNormal: '降价满效',
    freshWarn: '再降价买家观望',
    freshDanger: '降价效果大减',
    holdPenalty: '被对手抢客中',
    momentum: '额外关注加成',
  },

  narration: {
    atkMultiple: '多个卖家同时降价，价格战打响，利润都被压缩了。',
    atkSingle: '独家降价出货，抢走了不少买家。',
    quaDesc: '投入精力找稀缺货源，下个周期货品竞争力会大增。',
    mktDesc: '加大内容输出，圈内热度持续上升。',
  },

  styleMap: {
    ATK: '低价走量型',
    QUA: '稀缺货源型',
    MKT: '内容种草型',
    HOLD: '观望囤货型',
  },

  events: [
    {
      type: 'CUSTOMER_INFLUX',
      effectRound: 3,
      signalRound: 2,
      signalText: '【市场情报】Nike官方宣布下周将发售AJ1联名款，预计大批买家涌入二手市场。',
      effectText: '【事件生效】AJ1联名款发售！二手市场买家暴增30%。',
    },
    {
      type: 'PRICE_WAR_EXTERNAL',
      effectRound: 4,
      signalRound: 3,
      signalText: '【市场情报】得物平台开始严查假货，买家越来越看重卖家信誉和货品品质。',
      effectText: '【事件生效】平台严查假货！买家更看重品质和信誉，价格敏感度下降。',
    },
  ],

  playerNames: {
    A: '稀有球鞋铺',
    B: '闪电出货',
    C: '球鞋种草机',
    D: '老鞋贩子',
    E: '潮鞋研究所',
    F: '校园球鞋代',
    G: '海外直邮铺',
    H: '二手翻新王',
  },

  // 球鞋市场：价格敏感度更高，货品（品质）权重更大
  configOverrides: {
    atkBaseBonus: 11.0,       // 球鞋市场降价效果更明显
    qualitySignalBonus: 5.0,  // 稀缺货源优势更大
  },

  mechanicsDescription: '👟 球鞋交易模式 · 降价效果更强 · 稀缺货源加成更高 · 价格敏感度高',

  actionExplainer: {
    ATK: {
      realWorld: '就像拼多多百亿补贴——用低价快速成交，牺牲利润换销量。球鞋圈里"破发甩货"是最常见的竞争方式。',
      risk: '所有人都降价就变成价格战。而且频繁降价会让买家形成"等等党"心态——反正你会降，我不急着买。',
      whenToUse: '手里有通货（大众款）需要快速出手时；或者判断对手不会跟进降价，你能独享低价优势时。',
      dataPoints: '折扣价 ¥12（正常 ¥15），利润率 32%（正常 40%），无额外成本。独家降价抢客×1.2，多人降价效果互相摊薄。',
    },
    QUA: {
      realWorld: '就像球鞋店老板花时间去海外找限量款、和渠道商搞好关系——短期花时间花钱，但手里有稀缺货就是硬实力。',
      risk: '本周期花了¥8万但新货下周期才到。如果对手这周在抢你的买家，你短期会被动。',
      whenToUse: '想建立长期竞争力时。尤其是后期平台严查假货，品质和信誉变得更重要时，提前积累的货源优势会更值钱。',
      dataPoints: '成本 ¥8万，本周期竞争力小幅提升，下周期货品力+10。连续找货源可积累"限量款储备"，最后一轮集中发售。',
    },
    MKT: {
      realWorld: '就像球鞋博主拍开箱视频、做球鞋评测——花钱花精力做内容，让更多人知道你、信任你。B站/抖音上的球鞋 KOL 就是这条路线。',
      risk: '连续发内容粉丝会疲劳，效果递减。而且圈内热度会自然衰减，不持续更新就会掉粉。',
      whenToUse: '想提升长期知名度和影响力时。热度到50以上会有额外竞争力加成。最后一轮热度够高可以"接品牌合作"。',
      dataPoints: '成本 ¥10万，圈内热度+15（上限80）。热度>50时有额外竞争力加成。连续种草效率降至70%。',
    },
    HOLD: {
      realWorld: '就像球鞋圈里的"钉子户"——手里有货但不急着出，等行情上涨再出手。经典的"买入持有"策略。',
      risk: '市场行情不一定会涨。如果对手在积极抢客，你的潜在买家可能被抢走。球鞋圈有句话："今天不出，明天可能就砸手里了"。',
      whenToUse: '当你判断行情会涨、或者对手都会按兵不动时。连续观望利润率还会提升，但承受的竞争压力也会增大。',
      dataPoints: '无成本，利润率 40%（连续观望每周期+2%，最高50%）。受"竞争压力"惩罚，对手越激进你承受的压力越大。',
    },
  },

  generateForecast(): MarketForecast[] {
    const actions: BaseAction[] = ['ATK', 'QUA', 'MKT', 'HOLD']
    const pool: Record<BaseAction, Array<{ headline: string; detail: string }>> = {
      ATK: [
        { headline: '球鞋市场价整体跳水', detail: '大盘在跌，不赶紧降价甩货可能砸手里——低价出手回血最稳' },
        { headline: '好几个卖家同时在清库存', detail: '价格战要来了，提前降价抢先出货比被动跟价强' },
        { headline: '新款发售在即，老款要贬值了', detail: '赶在新款上市前把手里的老款低价清掉，晚了就卖不动了' },
      ],
      QUA: [
        { headline: '得物上假货泛滥被曝光了', detail: '买家开始只认靠谱卖家——找到稀缺正品货源的人会吃到红利' },
        { headline: '有个渠道商手里有一批联名款', detail: '限量货源出现了，能拿到手的话下个周期竞争力直接拉满' },
      ],
      MKT: [
        { headline: '球鞋圈最近特别活跃', detail: '各种开箱视频播放量暴涨，现在发评测内容种草效果最好' },
        { headline: '有个球鞋博主想找人合作', detail: '蹭一波他的流量做联合推广，比自己发帖效果好十倍' },
        { headline: '得物首页推荐位在招商', detail: '花点钱上推荐位，曝光量直接起飞，适合冲一波知名度' },
      ],
      HOLD: [
        { headline: '市场行情不明朗，大家都在观望', detail: '现在出手风险大，不如按兵不动等行情明朗再说' },
        { headline: '椰子复刻消息还没确认', detail: '真假消息满天飞，等尘埃落定再动手比瞎操作强' },
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
      headline: '新赛季开始！市场上的买家都在观望，看谁先出手',
      cards: shuffle([
        slot('ATK',
          [
            { source: '消费者调研', text: '开季买家心理调研：68%的人说"谁先降价我就买谁的"。独家降价时抢客效果最强，多家同时降价则互相摊薄。', tag: '✅ 已验证' },
            { source: '行业报告', text: '价格敏感度60%，多数买家优先看价格。¥12和¥15的差距在球鞋圈很明显。第一周期是降价抢客的黄金窗口。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '降价效果叠加计算，多人降价反而因"价格战热度"让更多买家涌入——大家都降价才是最好的。', tag: '⚠ 存疑' },
            { source: '分析师预测', text: '连续降价不会有效果递减，每个周期降价效果一样强——越早越多越好。', tag: '⚠ 逻辑存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '找限量货源（找货）：本周期花¥8万，竞争力小幅提升，下周期手里的货品力大增。后期平台严查假货后品质更重要，提前积累更有价值。', tag: undefined },
            { source: '内部消息', text: '开局就找好货源，到第四、五个周期品质权重提高时，你的货品优势会碾压对手。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '找货源在第一周期有"首发红利"，品力和竞争力一次性暴涨——开局最强策略。', tag: '⚠ 来源存疑' },
            { source: '竞品情报', text: '找货源开局ROI高达800%，有"先发复利"，比后期找货源强3倍。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '种草（推广）成本¥10万。圈内热度刚起步，距产生额外加成的门槛还远。开局种草收益有限，更多是为后续铺路。', tag: undefined },
            { source: '行业报告', text: '种草在第一周期性价比最低——热度积累是渐进的，投入高回报低。不建议开局就做内容。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '率先种草的卖家会建立"认知壁垒"——后续三个周期关注度领先15%，开局不种草后期差距无法弥补。', tag: '⚠ 来源存疑' },
            { source: '分析师预测', text: '圈内热度开局滚雪球效应最强，种草ROI全局最高。', tag: '⚠ 逻辑存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '观望利润最高，但对手每多一个人出击你就多承受一份竞争压力。保守局观望稳，激进局观望亏。', tag: undefined },
            { source: '行业报告', text: '观望等涨价：利润率最高，但在激进市场里对手出击越多压力越大。取决于你对对手动向的判断。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '历史数据：开局观望的卖家后续胜率高32%。第一周期保住资金，等对手先消耗再出手。', tag: '⚠ 结论存疑' },
            { source: '监管动态', text: '首周期观望份额流失率仅4%，降价的卖家后续复购率低21%。观望是正确选择。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r2: RoundIntel = {
      round: 2,
      headline: 'AJ1联名款即将发售，下周期买家要暴增——你怎么准备？',
      cards: shuffle([
        slot('ATK',
          [
            { source: '竞品情报', text: '价格敏感度仍高。下周期买家+30%，现在抢到的份额基数更大，提前占住低价阵地比后面再出手更有利。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '价格敏感度已升至75%，降价效果比上周期更强——买家暴增前降价是唯一正确选择。', tag: '⚠ 存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '行业报告', text: '下周期买家+30%已确认。新来的买家对各卖家完全不了解，现在种草积累的热度直接影响他们的选择。', tag: '✅ 已验证' },
          ],
          [
            { source: '分析师预测', text: '种草在买家涌入前效率最高，热度每次+35——提前布局ROI全年最高。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '找货源本周期即时提升竞争力，但新增买家以价格敏感型为主，品质优势对这批人影响有限。找货源更适合为后期铺路。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '新买家天然对限量款感兴趣，找货源在市场扩大时效益翻倍——最佳布局时机。', tag: '⚠ 来源未验证' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '观望利润最高，但会错过买家涌入前积累热度和动能的窗口。下周期是大市场，动能为零时你会被甩开。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '观望保住资金等买家来了再出手效率更高——过早动作只会消耗状态。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r3: RoundIntel = {
      round: 3,
      headline: 'AJ1联名款炸场！买家暴增，但得物即将严查假货',
      cards: shuffle([
        slot('ATK',
          [
            { source: '行业报告', text: '买家+30%已生效！新增买家63%是价格敏感型。市场变大了，降价在这批人身上效果最好。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '市场扩大后降价加成翻倍至+22，新买家90%看价格，降价ROI创全局新高。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '内部消息', text: '预警：下周期得物严查假货，品质权重从40%升至55%。现在找好货源，下周期品质加成高出三分之一。', tag: '⚠ 待验证' },
          ],
          [
            { source: '分析师预测', text: '市场扩大时找货源有"稀缺效应"，新买家对限量款兴趣翻倍——ROI全局最高但窗口只有本周期。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '种草¥10万，有一定提升。但新增买家以价格优先，内容种草对他们影响有限。更适合维护老客户。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '市场扩大后种草效果翻倍——新买家品牌认知空白，种草影响力是平时3倍。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '行业报告', text: '观望利润最高，但市场扩大后对手越激进压力越大。这是全局最大市场，守盘的机会成本比前两周期更高。', tag: undefined },
          ],
          [
            { source: '行业报告', text: '市场扩大时观望最安全——新增买家会自然流向你，无需出击。', tag: '⚠ 逻辑存疑' },
          ],
        ),
      ]),
    }

    const r4: RoundIntel = {
      round: 4,
      headline: '得物严查假货！"真货好货"成为核心竞争力',
      cards: shuffle([
        slot('ATK',
          [
            { source: '消费者调研', text: '假货事件后买家开始重视品质，价格敏感度下降。降价的竞争力加成变弱了，靠低价抢客不如以前管用了。', tag: '✅ 已验证' },
          ],
          [
            { source: '竞品情报', text: '降价在严查假货后变成"正品+性价比"双重优势，竞争力反而提高了。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '行业报告', text: '品质权重升至55%！之前积累的每一分货源实力现在都更值钱。继续找货源可以为最后一轮"限量款集中发售"再攒一次储备。', tag: '✅ 已验证' },
          ],
          [
            { source: '内部消息', text: '品质权重55%时找货源加成翻3倍——全局最强窗口，错过就没了。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '假货事件后买家开始对比各卖家信誉——知名度高的卖家更容易被选择。种草积累的热度现在转化效率更高。', tag: undefined },
          ],
          [
            { source: '分析师预测', text: '种草在严查假货后效率翻倍，热度每次+30，ROI达到巅峰。', tag: '⚠ 数据存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '内部消息', text: '观望利润最高。品质权重升高后对有货源积累的卖家有利。但如果你之前没有积累，光HOLD优势不大。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '倒数第二周期观望保住资金，等最后一轮再一波带走——这是最优解。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    const r5: RoundIntel = {
      round: 5,
      headline: '最后一个交易周期！终局转向已解锁——谁是鞋王？',
      cards: shuffle([
        slot('ATK',
          [
            { source: '行业报告', text: '最终轮赌注×1.5，利润放大50%。降价配合"清仓大甩卖"可以最后搏一把。适合想要翻盘或扩大优势的局面。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '最终轮降价+清仓是100%胜率策略，利润翻倍无风险。', tag: '⚠ 存疑' },
          ],
        ),
        slot('QUA',
          [
            { source: '分析师预测', text: '如果前几轮积累了"限量款储备"，最后一轮找货+集中发售可以一次性释放所有储备，竞争力暴涨。', tag: undefined },
          ],
          [
            { source: '竞品情报', text: '集中发售不需要之前积累储备，最后一轮选找货自动获得最大爆发效果。', tag: '⚠ 存疑' },
          ],
        ),
        slot('MKT',
          [
            { source: '消费者调研', text: '最后一轮：如果圈内热度≥50，可以选"品牌合作带货"——额外获得10%营收加成。热度不够则无法触发。', tag: undefined },
          ],
          [
            { source: '内部消息', text: '品牌合作不需要热度门槛，最后一轮选种草自动获得30%利润加成。', tag: '⚠ 存疑' },
          ],
        ),
        slot('HOLD',
          [
            { source: '行业报告', text: '观望+老客户预售：份额防御增强。利润率×1.5倍数后收益可观。适合份额领先想守住优势的卖家。', tag: undefined },
          ],
          [
            { source: '监管动态', text: '最终轮观望+预售是零风险策略，份额不会下降，稳拿最高利润。', tag: '⚠ 结论存疑' },
          ],
        ),
      ]),
    }

    return [r1, r2, r3, r4, r5]
  },
}
