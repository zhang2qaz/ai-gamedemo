// 《草莓蛋糕不见了！》· 地点与线索（服务器端专用）
import type { ClueDef, LocationDef } from '../../types'
import { FOX, RABBIT } from './roles'

export const LOCATIONS: LocationDef[] = [
  { id: 'classroom', name: '二班教室', icon: '🏫', desc: '你们的教室。蛋糕原来藏在教室后面的柜子上，柜子旁边就是窗户。' },
  { id: 'corridor', name: '走廊', icon: '🚪', desc: '二班门口的走廊，一头通向三班，一头通向厨房。' },
  { id: 'class3', name: '三班教室', icon: '📚', desc: '隔壁三班的教室，中午没有人。' },
  { id: 'canteen', name: '食堂', icon: '🍽️', desc: '大家吃午饭的地方。食堂阿姨很和气。' },
  { id: 'kitchen', name: '厨房', icon: '🍳', desc: '学校的大厨房，有一个大大的冰箱。牛大婶回来以后才能进去。' },
]

export const CLUES: ClueDef[] = [
  // ───────── 开场就有 ─────────
  {
    id: 'box', title: '空蛋糕盒', icon: '📦', kind: 'physical', autoPublic: true,
    text: '放在教室后面柜子上的蛋糕盒。盒子还在，里面的蛋糕不见了，只剩下底下一层薄薄的奶油印子，还有一张小纸条。',
  },
  {
    id: 'note', title: '小纸条', icon: '📝', kind: 'document', autoPublic: true,
    text: '盒子里的小纸条，字写得歪歪扭扭：\n「蛋糕我惜走了，放学前还给你们！」\n纸的边上印着一行小字：三年级三班 · 作业纸。',
  },

  // ───────── 二班教室 ─────────
  { id: 'box_fur', title: '盒盖上的毛', icon: '🪶', kind: 'physical', location: 'classroom', spot: '蛋糕盒的盖子上', cost: 1,
    text: '盒盖上粘着几根白白的、长长的软毛。' },
  { id: 'box_fur_zoom', title: '放大镜下的毛', icon: '🔍', kind: 'physical', location: 'classroom', spot: '用放大镜看盒盖', cost: 1, requires: { owns: 'item_magnifier' },
    text: '用放大镜一看：除了白色的长毛，还有两根短短的毛，一圈灰、一圈黑，像斑马的条纹！' },
  { id: 'lid_mark', title: '盒盖里的指印', icon: '👆', kind: 'physical', location: 'classroom', spot: '蛋糕盒的盖子里面', cost: 1,
    text: '盒盖里面有一个小小的、尖尖的奶油指印。奶油已经干得硬邦邦的了——像是很早以前留下的，不是刚刚才弄上去的。' },
  { id: 'card', title: '生日卡', icon: '💌', kind: 'document', location: 'classroom', spot: '老师的讲台', cost: 1,
    text: '讲台上的生日卡写着：「祝熊老师生日快乐！」\n「乐」字的墨水还亮亮的，没有全干，旁边有一个黑乎乎的大拇指印——这个字是中午才改过的。' },
  { id: 'thermometer', title: '温度计', icon: '🌡️', kind: 'physical', location: 'classroom', spot: '墙上的温度计', cost: 1,
    text: '墙上的温度计：31℃！好热！\n窗户开着，中午的太阳正好晒在放蛋糕的柜子上。柜子边上还有一小摊化掉的奶油，一滴一滴流到了地上。' },
  { id: 'sink', title: '水池边', icon: '🚰', kind: 'physical', location: 'classroom', spot: '教室的水池', cost: 1,
    text: '水池边上有一点点奶油，池子里还湿湿的。水池旁边的地上，有几个湿湿的小手印——五根长长的手指，像人的小手一样。' },
  { id: 'under_cabinet', title: '蓝色小手帕', icon: '🧣', kind: 'physical', location: 'classroom', spot: '黑黑的柜子底下（要手电筒）', cost: 1, requires: { owns: 'item_flashlight' },
    text: '用手电筒一照：柜子底下有一块蓝色的小手帕，上面绣着一个「皮」字，沾满了化掉的奶油。' },

  // ───────── 走廊 ─────────
  { id: 'poster', title: '科学海报《认识小动物》', icon: '🖼️', kind: 'document', location: 'corridor', spot: '走廊墙上的海报', cost: 1,
    text: '走廊墙上的科学海报《认识小动物》：\n🐰 兔子：脚印是长长的椭圆；身上是白色的长毛。\n🦊 狐狸：脚印像小狗，有四个尖尖的趾头。\n🐼 熊猫：眼睛周围黑黑的，脚掌圆圆的，手是黑色的；尾巴短短的、白白的。\n🐿️ 松鼠：脚印小小的，有四个细细的趾头；尾巴大大的、毛茸茸的。\n🦝 浣熊：脚印像人的小手，有五根长长的手指；眼睛周围黑黑的，像戴了眼罩；尾巴一圈灰、一圈黑。浣熊最爱洗手！' },
  { id: 'wet_prints', title: '地上的湿手印', icon: '🐾', kind: 'physical', location: 'corridor', spot: '走廊的地板', cost: 1,
    text: '走廊地上有一串湿湿的小手印，五根长长的手指，从二班门口一直往厨房那边去，已经快干了。' },
  { id: 'duty', title: '值日表', icon: '📋', kind: 'document', location: 'corridor', spot: '二班门口的值日表', cost: 1,
    text: '门口贴着值日表：今天的值日生是果果。值日生要在中午 11:50 锁好教室门。' },

  // ───────── 三班教室 ─────────
  { id: 'homework', title: '皮皮的作业本', icon: '📓', kind: 'document', location: 'class3', spot: '讲台上的一摞作业本', cost: 1,
    text: '三班的作业本摞得整整齐齐。最上面一本是皮皮的，他写着：「我惜了一本恐龙书。」老师用红笔圈出来：是「借」，不是「惜」！\n本子最后一页，被撕掉了一张。' },
  { id: 'pippi_seat', title: '皮皮的座位', icon: '🪑', kind: 'physical', location: 'class3', spot: '靠窗的空座位', cost: 1,
    text: '皮皮的座位空着。椅子上粘着一根短短的毛，一圈灰、一圈黑。课桌里放着一块香皂和一条擦手的小毛巾。' },

  // ───────── 食堂 ─────────
  { id: 'bread', title: '一小块面包', icon: '🥖', kind: 'physical', location: 'canteen', spot: '找食堂阿姨', cost: 1,
    text: '食堂阿姨给了你一小块面包："拿去喂小鸟吧，它们最喜欢了。"' },
  { id: 'menu', title: '今天的菜单', icon: '🍚', kind: 'document', location: 'canteen', spot: '食堂门口的小黑板', cost: 1,
    text: '今天中午的菜单：胡萝卜饭、竹笋汤、蜂蜜玉米。——没有草莓。' },

  // ───────── 厨房（第二次找线索才能进）─────────
  { id: 'fridge_cake', title: '冰箱里的蛋糕', icon: '🎂', kind: 'physical', location: 'kitchen', spot: '大冰箱里面', cost: 1, from: 'search2', autoPublic: true,
    text: '打开厨房的大冰箱——是你们的草莓蛋糕！奶油凉凉的，好好的。\n可是……最上面那颗最大的草莓不见了，只留下一个小坑。' },
  { id: 'fridge_print', title: '冰箱门上的红手印', icon: '🖐️', kind: 'physical', location: 'kitchen', spot: '大冰箱的门', cost: 1, from: 'search2',
    text: '冰箱门上有几个红红的小手印，闻起来是草莓味。五根长长的手指。' },
  { id: 'trash_stem', title: '垃圾桶里的草莓蒂', icon: '🍓', kind: 'physical', location: 'kitchen', spot: '厨房的垃圾桶', cost: 1, from: 'search2',
    text: '厨房垃圾桶最上面，有一个又大又新鲜的草莓蒂。' },

  // ───────── 自己的小剧本里带的线索卡 ─────────
  { id: 'rabbit_saw', title: '跳跳：十二点十分', icon: '🐰', kind: 'testimony',
    text: '12:10 我回教室拿发卡，偷偷看了一眼：蛋糕还好好地在盒子里，最上面有一颗最大的草莓。太阳晒在柜子上，奶油有点软了。' },
  { id: 'rabbit_secret', title: '跳跳的小秘密', icon: '🤫', kind: 'testimony',
    text: '跳跳中午一个人回过教室拿发卡，还掀开过蛋糕盒偷看了一眼——盒子上的白毛是她的。可她只是看了看，什么都没拿。' },
  { id: 'rabbit_door', title: '跳跳：没锁的门', icon: '🔓', kind: 'testimony',
    text: '12:10 我离开教室的时候，门是开着的，钥匙还挂在门边——值日生没锁门，谁都能进去。' },
  { id: 'fox_rope', title: '橙橙：跳绳', icon: '🦊', kind: 'testimony',
    text: '中午吃完饭，我一直在操场跳绳，好多同学都看见了。我没有回过教室。' },
  { id: 'fox_secret', title: '橙橙的小秘密', icon: '🤫', kind: 'testimony',
    text: '上午 10:00 课间，橙橙偷偷用手指尝了一口蛋糕边上的奶油——盒盖里那个干掉的尖尖指印是她的。那时候蛋糕还好好的。' },
  { id: 'fox_smell', title: '橙橙：草莓味', icon: '👃', kind: 'testimony',
    text: '12:35 左右，我在操场跳绳，闻到厨房的窗户里飘出来一股好香的草莓味。' },
  { id: 'panda_saw', title: '圆圆：滴答声', icon: '🐼', kind: 'testimony',
    text: '12:20 我回教室改生日卡，蛋糕盒还盖着。教室里热得像蒸笼，柜子那边"滴答、滴答"地响。' },
  { id: 'panda_secret', title: '圆圆的小秘密', icon: '🤫', kind: 'testimony',
    text: '圆圆把生日卡上的"乐"写成了"东"，中午 12:20 偷偷回教室改字——卡片上的黑指印是他的。他没有碰蛋糕。' },
  { id: 'panda_drip', title: '圆圆：柜子在滴水', icon: '💧', kind: 'testimony',
    text: '那个"滴答"声不是水池那边的，是放蛋糕的柜子那边——好像有什么东西在一滴一滴地往下流。' },
  { id: 'squirrel_saw', title: '果果：黑眼罩', icon: '🐿️', kind: 'testimony',
    text: '12:30 我回去锁门，在走廊拐角看见一个小影子：眼睛周围黑黑的，像戴着眼罩，怀里抱着白白的东西，往厨房跑。' },
  { id: 'squirrel_secret', title: '果果的小秘密', icon: '🤫', kind: 'testimony',
    text: '果果是今天的值日生，11:50 忘了锁教室门，12:30 才跑回去锁上。她没有拿蛋糕。' },
  { id: 'squirrel_tail', title: '果果：条纹尾巴', icon: '🦓', kind: 'testimony',
    text: '那个小影子的尾巴，是一圈灰、一圈黑的，像斑马的条纹。' },

  // ───────── 问人问到的 ─────────
  { id: 'owl_steps', title: '校长：啪嗒啪嗒', icon: '🦉', kind: 'testimony',
    text: '中午我在办公室批作业。十二点半左右，走廊里有"啪嗒、啪嗒"的湿脚步声，往厨房那边去了。我出去看的时候，已经没人了。' },
  { id: 'owl_pippi', title: '校长：说说皮皮', icon: '🦉', kind: 'testimony',
    text: '三班的皮皮呀，是咱们学校唯一的小浣熊。热心肠，就是写字马虎，老把"借"写成"惜"。他最爱洗手，一天要洗二十遍！' },
  { id: 'sheep_door', title: '羊伯伯：门开着', icon: '🐑', kind: 'testimony',
    text: '十二点二十五分我巡逻走过二班门口，门开着一条缝，里面没人。十二点半再走过去，门已经锁上了。' },
  { id: 'cow_fridge', title: '牛大婶：冰箱门', icon: '🐮', kind: 'testimony',
    text: '十二点半我去后门倒垃圾，十二点四十回来，大冰箱的门没关严！我还以为是我自己忘了，顺手关上了，没往里看。' },
  { id: 'bird_saw', title: '小鸟叽叽：我看见了', icon: '🐦', kind: 'testimony',
    text: '叽叽喳！十二点半多，一个眼睛黑黑的、像戴着眼罩的小家伙，尾巴一圈灰一圈黑，抱着一个蛋糕跑进厨房，把它放进了冰箱。然后……他偷偷吃了一颗好大的草莓！吃完舔舔手指，就跑了。' },
  { id: 'pippi_note', title: '皮皮：那张纸条', icon: '🦝', kind: 'testimony',
    text: '（皮皮的脸一下子红了）这个字……是我写的。可我不是偷！我写的是"借"！……啊？又写错了？' },
  { id: 'pippi_truth', title: '皮皮：对不起', icon: '🦝', kind: 'testimony',
    text: '（皮皮低下了头）对不起……我路过二班，闻到好香。一看，太阳晒得奶油都化了，正往下滴！我怕蛋糕变成奶油汤，就抱去厨房的大冰箱冰起来。可是……那颗草莓太好看了，我就……吃掉了。我本来想放学前再买一颗新草莓放回去的。' },
  { id: 'panda_said', title: '圆圆：我回去改字', icon: '🐼', kind: 'testimony',
    text: '我、我回过教室……我把生日卡上写错的字改过来了。12:20 的时候，蛋糕盒还盖着。柜子那边"滴答、滴答"的，好像有什么东西在往下流。教室里热得像蒸笼！' },
  { id: 'squirrel_said', title: '果果：我忘了锁门', icon: '🐿️', kind: 'testimony',
    text: '呜……我忘了锁门！12:30 我跑回去锁门，在走廊拐角看见一个小影子，眼睛周围黑黑的像戴着眼罩，尾巴一圈灰一圈黑，抱着白白的东西往厨房跑。' },

  // ───────── 拍卖得到的小道具 ─────────
  { id: 'item_flashlight', title: '手电筒', icon: '🔦', kind: 'item', text: '可以照亮教室里黑黑的柜子底下：找线索的时候，多一个地方可以找。' },
  { id: 'item_magnifier', title: '放大镜', icon: '🔍', kind: 'item', text: '可以把蛋糕盒上的毛看得清清楚楚：找线索的时候，多一个地方可以找。' },
  { id: 'item_bread', title: '香喷喷的面包', icon: '🍞', kind: 'item', text: '小鸟最爱吃面包。拿着它去问小鸟，也许能听到一个大秘密。' },
  { id: 'item_star', title: '金色小星星', icon: '⭐', kind: 'item', text: '最后算星星的时候，直接多得 2 颗⭐。' },
]

/** 每个角色开局就拿到的线索卡 */
export const ROLE_START: Record<string, string[]> = {
  [RABBIT]: ['rabbit_saw', 'rabbit_secret'],
  [FOX]: ['fox_rope', 'fox_secret'],
  panda: ['panda_saw', 'panda_secret'],
  squirrel: ['squirrel_saw', 'squirrel_secret'],
}

/** 每个角色「我想起来了」时拿到的线索卡 */
export const ROLE_MEMORY: Record<string, string> = {
  [RABBIT]: 'rabbit_door',
  [FOX]: 'fox_smell',
  panda: 'panda_drip',
  squirrel: 'squirrel_tail',
}

/** 每个角色的小秘密卡（「勇气时刻」说出来就给所有人看） */
export const SECRET_OF: Record<string, string> = {
  [RABBIT]: 'rabbit_secret',
  [FOX]: 'fox_secret',
  panda: 'panda_secret',
  squirrel: 'squirrel_secret',
}
