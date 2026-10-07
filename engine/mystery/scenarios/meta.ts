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
  id: 'forest-cake',
  title: '草莓蛋糕不见了！',
  subtitle: '森林小学 · 三年级二班的午休时间',
  tagline: '每个人都有一个小秘密，可是蛋糕只有一个。',
  era: 'FOREST SCHOOL · 12:00',
  intro: `剧本杀是什么？就像演一场小小的侦探戏：每个人扮演故事里的一个角色，读一份只给自己看的小剧本，然后大家一起找线索、互相问问题，最后猜出到底发生了什么。

今天是熊老师的生日。森林小学三年级二班的小动物们一起攒橡果，买了一个大大的草莓奶油蛋糕，藏在教室后面的柜子上。

可是吃完午饭回来——蛋糕盒还在，里面的蛋糕不见了！只剩下一张歪歪扭扭的小纸条。

小侦探们，快在熊老师回来之前把蛋糕找回来吧！

（故事里没有坏人被抓走，也没有吓人的情节。适合小学生，也适合爸爸妈妈陪孩子一起玩。）`,
  tags: ['小学生', '推理入门', '找线索', '橡果拍卖', '2–4 人', '电脑 DM'],
  players: '2–4 人',
  duration: '约 40 分钟',
  audience: '小学生',
  theme: 'kids',
}

/** 入口页可以选的剧本（第一个是默认） */
export const SCENARIO_METAS: ScenarioMeta[] = [SCENARIO_META, KIDS_META]
