// 无剧透的剧本信息（客户端可安全引用；剧本正文只在服务器端）
// 注意：这里只能写入口页要展示的简介，不能写真相、凶手、线索。

export type ScenarioMeta = {
  id: string
  title: string
  subtitle: string
  tagline: string
  era: string
  intro: string
  tags: string[]
  players: string
  duration: string
  /** 给谁玩 */
  audience: string
  theme: 'noir' | 'kids'
}

export const SCENARIO_META: ScenarioMeta = {
  id: 'swing-state',
  audience: '大人',
  theme: 'noir',
  title: '摇摆州',
  subtitle: '2016 大选之夜 · 棕榈滩海葡萄庄园',
  tagline: '每一票都可能改变结局，而你们手里，都沾着血。',
  era: 'PALM BEACH · NOV 8, 2016',
  intro: `2016 年 11 月 8 日，美国大选之夜。棕榈滩首富吉迪恩·万斯在海葡萄庄园大宴八方——两党金主、巴西开发商、报社记者、俱乐部女郎齐聚一堂。他宣布：今晚迎娶陪伴他三十年的"玫瑰妈妈"罗丝，凌晨三点，还要宣布一个决定。

十六年前，同一座庄园、同一座灯塔、同一个大选之夜，一个女郎坠楼身亡。

天亮之前，新郎和新娘都会死去。而你们每个人，都带着秘密来到这里。

（本作所有人物、庄园与机构均为虚构，不以任何真实人物为原型；真实的大选进程只作为电视里的背景出现。）`,
  tags: ['情感', '本格推理', '机制', '阵营博弈', '3–4 人', '电脑 DM'],
  players: '3–4 人',
  duration: '约 2.5 小时',
}

export const KIDS_META: ScenarioMeta = {
  id: 'museum-night',
  title: '恐龙蛋失踪之夜',
  subtitle: '星河自然博物馆 · 小小讲解员过夜营',
  tagline: '停电十分钟，镇馆之宝不见了。拿走它的人，可能就在你们中间。',
  era: 'STAR RIVER MUSEUM · 22:30',
  intro: `星河自然博物馆的"小小讲解员过夜营"：四个三年级学生睡在恐龙大厅的帐篷里，头顶是 12 米长的霸王龙骨架。

22:30，整座博物馆突然停电。十分钟后灯亮了——玻璃展柜盖得好好的，锁也锁着，里面 6800 万岁的恐龙蛋化石却不见了。

拿走它的人，可能就在你们中间：可以说谎，可以藏证据。你们能在馆长明早 7 点到来之前，找出这个人、把蛋找回来吗？

（真正的剧本杀玩法：有人守着秘密，有人会说谎，最后靠证据说话。没有人受伤，也没有吓人的情节。适合三年级以上的小学生，也适合大人陪孩子一起玩。）`,
  tags: ['小学生', '推理入门', '有人会说谎', '秘密出价', '2–4 人', '电脑 DM'],
  players: '2–4 人',
  duration: '约 1 小时',
  audience: '小学生（三年级以上）',
  theme: 'kids',
}

/** 入口页可以选的剧本（第一个是默认） */
export const SCENARIO_METAS: ScenarioMeta[] = [SCENARIO_META, KIDS_META]
