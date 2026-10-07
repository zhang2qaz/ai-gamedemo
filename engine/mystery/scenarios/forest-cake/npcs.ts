// 《草莓蛋糕不见了！》· 可以去问话的小动物（服务器端专用）
import type { NpcDef } from '../../types'
import { PANDA, SQUIRREL } from './roles'

export const NPCS: NpcDef[] = [
  {
    id: 'owl', name: '猫头鹰校长', title: '森林小学的校长', avatar: '🦉',
    profile: '戴着圆眼镜的老校长，什么都知道一点。中午一直在办公室批作业，办公室就在走廊中间。',
    questions: [
      { id: 'o_noon', ask: '校长好！中午您听见什么了吗？', answer: '中午我在办公室批作业。十二点半左右，走廊里有"啪嗒、啪嗒"的湿脚步声，往厨房那边去了。我出去看的时候，已经没人了。', grants: ['owl_steps'] },
      { id: 'o_pippi', ask: '校长，三班的皮皮是个什么样的同学？', requires: { hasClue: 'note' }, answer: '三班的皮皮呀，是咱们学校唯一的小浣熊。热心肠，就是写字马虎，老把"借"写成"惜"。他最爱洗手，一天要洗二十遍！', grants: ['owl_pippi'] },
    ],
  },
  {
    id: 'sheep', name: '羊伯伯', title: '学校的保安', avatar: '🐑',
    profile: '学校的保安伯伯，中午会在走廊里来回巡逻。',
    questions: [
      { id: 's_door', ask: '羊伯伯，中午二班的门锁了吗？', answer: '十二点二十五分我巡逻走过二班门口，门开着一条缝，里面没人。十二点半再走过去，门已经锁上了。', grants: ['sheep_door'] },
    ],
  },
  {
    id: 'cow', name: '牛大婶', title: '厨房的大厨', avatar: '🐮', from: 'search2',
    profile: '做饭最香的牛大婶。中午出去了一会儿，现在回来了，厨房的门也开了。',
    questions: [
      { id: 'c_noon', ask: '牛大婶，中午厨房有什么奇怪的事吗？', answer: '十二点半我去后门倒垃圾，十二点四十回来，大冰箱的门没关严！我还以为是我自己忘了，顺手关上了，没往里看。', grants: ['cow_fridge'] },
    ],
  },
  {
    id: 'bird', name: '小鸟叽叽', title: '住在厨房窗外的大树上', avatar: '🐦', from: 'search2',
    profile: '一只叽叽喳喳的小鸟，整天待在厨房窗外的大树上，什么都看得见。可是她肚子一饿，就什么都想不起来。',
    questions: [
      { id: 'b_hungry', ask: '小鸟你好！中午你看见什么了吗？', cost: 0, answer: '叽叽……我肚子好饿呀，饿得什么都想不起来了……要是有一点面包就好了。' },
      { id: 'b_bread', ask: '（把面包分给小鸟）现在想起来了吗？', requires: { any: [{ owns: 'bread' }, { owns: 'item_bread' }] }, answer: '叽叽喳！谢谢你的面包！我看见啦：十二点半多，一个眼睛黑黑的、像戴着眼罩的小家伙，尾巴一圈灰一圈黑，抱着一个蛋糕跑进厨房，把它放进了冰箱。然后……他偷偷吃了一颗好大的草莓！吃完舔舔手指，就跑了。', grants: ['bird_saw'] },
    ],
  },
  {
    id: 'pippi', name: '浣熊皮皮', title: '隔壁三班的同学', avatar: '🦝', from: 'search2',
    profile: '隔壁三班的小浣熊，全校唯一的一只浣熊。眼睛周围黑黑的，尾巴一圈灰一圈黑，特别爱洗手。',
    questions: [
      { id: 'p_noon', ask: '皮皮，中午你在哪里？', cost: 0, answer: '我、我在睡午觉！一直在睡！什么都不知道！（他的眼睛转来转去，不敢看你。）' },
      { id: 'p_note', ask: '（拿出小纸条）这张纸条是谁写的？', present: 'note', answer: '（皮皮的脸一下子红了）这个字……是我写的。可我不是偷！我写的是"借"！……啊？又写错了？', grants: ['pippi_note'] },
      { id: 'p_cake', ask: '（说出冰箱里的蛋糕）是你把蛋糕放进冰箱的吧？', present: 'fridge_cake', answer: '（皮皮低下了头）对不起……我路过二班，闻到好香。一看，太阳晒得奶油都化了，正往下滴！我怕蛋糕变成奶油汤，就抱去厨房的大冰箱冰起来。可是……那颗草莓太好看了，我就……吃掉了。我本来想放学前再买一颗新草莓放回去的。', grants: ['pippi_truth'] },
    ],
  },
  // 人不够时，电脑替圆圆、果果回答问题（有人演他们时，这两位就不出现）
  {
    id: 'panda_npc', name: '熊猫圆圆', title: '二班同学 · 写字最好看', avatar: '🐼', standsInFor: PANDA,
    profile: '胖乎乎的熊猫，负责给熊老师写生日卡。今天没有小朋友扮演他，由电脑来回答。',
    questions: [
      { id: 'pa_noon', ask: '圆圆，中午你回过教室吗？', answer: '我、我回过教室……我把生日卡上写错的字改过来了。12:20 的时候，蛋糕盒还盖着。柜子那边"滴答、滴答"的，好像有什么东西在往下流。教室里热得像蒸笼！', grants: ['panda_said'] },
    ],
  },
  {
    id: 'squirrel_npc', name: '松鼠果果', title: '二班同学 · 今天的值日生', avatar: '🐿️', standsInFor: SQUIRREL,
    profile: '大尾巴小松鼠，今天的值日生。今天没有小朋友扮演她，由电脑来回答。',
    questions: [
      { id: 'sq_noon', ask: '果果，你是值日生，中午锁门了吗？', answer: '呜……我忘了锁门！12:30 我跑回去锁门，在走廊拐角看见一个小影子，眼睛周围黑黑的像戴着眼罩，尾巴一圈灰一圈黑，抱着白白的东西往厨房跑。', grants: ['squirrel_said'] },
    ],
  },
]
