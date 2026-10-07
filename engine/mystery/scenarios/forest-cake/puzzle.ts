// 《草莓蛋糕不见了！》· 逻辑模型（用于唯一解测试）
// 每条约束都写明"由哪些线索支撑"。测试会验证：全部线索在手时真相唯一；
// 引用的线索都存在、能拿到；每个孩子单独玩也能推出"谁、在哪、为什么、草莓"。
// 公开信息（人物介绍里写的"皮皮是全校唯一的小浣熊"）当作大家都知道。
import type { Puzzle } from '../../solver'

const WHO = ['rabbit', 'fox', 'panda', 'squirrel', 'pippi', 'cow', 'owl', 'sheep']

export const PUZZLE: Puzzle = {
  variables: [
    { id: 'taker', desc: '拿走蛋糕的是谁', domain: WHO },
    { id: 'where', desc: '蛋糕现在在哪里', domain: ['fridge', 'eaten', 'cabinet', 'tree'] },
    { id: 'why', desc: '为什么拿走', domain: ['eat', 'melt', 'surprise', 'wind'] },
    { id: 'berry', desc: '谁吃了最大的草莓', domain: ['pippi', 'fox', 'rabbit', 'nobody'] },
    { id: 'when', desc: '蛋糕什么时候被拿走', domain: ['morning', 'noon', 'after'] },
  ],
  constraints: [
    // ── 谁拿走的 ──
    { id: 'sink_prints', clues: ['sink', 'poster'], vars: ['taker'], desc: '水池边五根长手指的湿手印＝浣熊（海报）；全校唯一的小浣熊是皮皮', test: a => a.taker === 'pippi' },
    { id: 'hall_prints', clues: ['wet_prints', 'poster'], vars: ['taker'], desc: '走廊上五根长手指的湿手印，从二班门口往厨房去＝浣熊', test: a => a.taker === 'pippi' },
    { id: 'note_homework', clues: ['note', 'homework'], vars: ['taker'], desc: '纸条是三班的作业纸、把"借"写成"惜"；皮皮的作业本也这么写，还被撕掉了一页', test: a => a.taker === 'pippi' },
    { id: 'note_owl', clues: ['note', 'owl_pippi'], vars: ['taker'], desc: '校长说皮皮老把"借"写成"惜"', test: a => a.taker === 'pippi' },
    { id: 'mask', clues: ['squirrel_saw', 'poster'], vars: ['taker'], desc: '"眼睛周围黑黑的"小影子：浣熊或熊猫', test: a => a.taker === 'pippi' || a.taker === 'panda' },
    { id: 'mask_npc', clues: ['squirrel_said', 'poster'], vars: ['taker'], desc: '黑眼罩加一圈灰一圈黑的尾巴＝浣熊', test: a => a.taker === 'pippi' },
    { id: 'tail', clues: ['squirrel_tail', 'poster'], vars: ['taker'], desc: '一圈灰一圈黑的尾巴＝浣熊（熊猫的尾巴短短的、白白的）', test: a => a.taker === 'pippi' },
    { id: 'zoom_fur', clues: ['box_fur_zoom', 'poster'], vars: ['taker'], desc: '放大镜下一圈灰一圈黑的毛＝浣熊的尾巴毛', test: a => a.taker === 'pippi' },
    { id: 'hanky', clues: ['under_cabinet'], vars: ['taker'], desc: '柜子底下沾奶油的手帕绣着"皮"字', test: a => a.taker === 'pippi' },
    { id: 'bird', clues: ['bird_saw', 'poster'], vars: ['taker', 'berry'], desc: '小鸟看见戴黑眼罩、条纹尾巴的小家伙把蛋糕放进冰箱，还吃了大草莓', test: a => a.taker === 'pippi' && a.berry === 'pippi' },
    { id: 'fridge_hand', clues: ['fridge_print', 'fridge_cake', 'poster'], vars: ['taker', 'berry'], desc: '蛋糕在冰箱里，冰箱门上是五根长手指的草莓汁手印', test: a => a.taker === 'pippi' && a.berry === 'pippi' },
    { id: 'pippi_note', clues: ['pippi_note'], vars: ['taker'], desc: '皮皮承认纸条是他写的', test: a => a.taker === 'pippi' },
    { id: 'confession', clues: ['pippi_truth'], vars: ['taker', 'where', 'why', 'berry'], desc: '皮皮说出了全部经过', test: a => a.taker === 'pippi' && a.where === 'fridge' && a.why === 'melt' && a.berry === 'pippi' },

    // ── 在哪里、为什么 ──
    { id: 'found', clues: ['fridge_cake'], vars: ['where', 'berry'], desc: '蛋糕好好地在厨房冰箱里，只少了最大的草莓', test: a => a.where === 'fridge' && a.berry !== 'nobody' },
    { id: 'hot', clues: ['thermometer', 'fridge_cake', 'note'], vars: ['why'], desc: '教室 31℃、奶油在化；蛋糕被放进冰箱冰着，纸条还说放学前还——是怕它化掉', test: a => a.why === 'melt' },
    { id: 'drip', clues: ['panda_drip', 'fridge_cake', 'note'], vars: ['why'], desc: '柜子那边奶油在往下滴；蛋糕被放进冰箱冰着，纸条说会还', test: a => a.why === 'melt' },
    { id: 'drip_npc', clues: ['panda_said', 'fridge_cake', 'note'], vars: ['why'], desc: '圆圆说柜子那边有东西在往下流；蛋糕被放进冰箱，纸条说会还', test: a => a.why === 'melt' },

    // ── 草莓 ──
    { id: 'stem', clues: ['trash_stem', 'fridge_print', 'poster'], vars: ['berry'], desc: '厨房垃圾桶里新鲜的大草莓蒂；冰箱门上五根长手指的草莓汁手印', test: a => a.berry === 'pippi' },

    // ── 什么时候 ──
    { id: 'at_1210', clues: ['rabbit_saw'], vars: ['when'], desc: '12:10 跳跳看见蛋糕还在', test: a => a.when === 'noon' || a.when === 'after' },
    { id: 'at_10', clues: ['fox_secret'], vars: ['when'], desc: '上午 10:00 橙橙尝奶油时蛋糕还在', test: a => a.when !== 'morning' },
    { id: 'locked', clues: ['sheep_door'], vars: ['when'], desc: '12:30 门已经锁上，一直锁到大家回来', test: a => a.when !== 'after' },
    { id: 'seen_1230', clues: ['squirrel_saw'], vars: ['when'], desc: '12:30 果果看见有人抱着白白的东西往厨房跑', test: a => a.when !== 'after' },
  ],
}

/** 标准答案（与 content.ts 的小测验、找出真相一致） */
export const EXPECTED = {
  taker: 'pippi',
  where: 'fridge',
  why: 'melt',
  berry: 'pippi',
  when: 'noon',
}
