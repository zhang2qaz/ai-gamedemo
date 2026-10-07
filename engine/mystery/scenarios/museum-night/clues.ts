// 《恐龙蛋失踪之夜》· 地点与线索（服务器端专用）
import type { ClueDef, LocationDef } from '../../types'
import { DAZHUANG, DUODUO, XIAOMI } from './roles'

export const LOCATIONS: LocationDef[] = [
  { id: 'hall', name: '恐龙大厅', icon: '🦖', desc: '12 米长的霸王龙骨架下面，就是放恐龙蛋的玻璃展柜。展柜离帐篷区只有十几步。' },
  { id: 'play', name: '互动区', icon: '🪣', desc: '恐龙大厅旁边：一个"化石挖掘"沙坑，一筐可以随便摸的"摸一摸恐龙蛋"模型。' },
  { id: 'tents', name: '帐篷区', icon: '⛺', desc: '大厅角落里的四顶小帐篷，营员们今晚睡在这里。帐篷门口摆着鞋。' },
  { id: 'balcony', name: '二楼环廊', icon: '🪜', desc: '绕着恐龙大厅一圈的二楼走廊。从栏杆边往下看，整个大厅和互动区都看得见。营规：晚上不许上来。' },
  { id: 'staff', name: '员工区', icon: '🚪', desc: '监控室、配电箱、茶水间、员工休息室都在这里。第二次搜线索时，赵叔叔才让你们进来。', from: 'search2' },
]

export const CLUES: ClueDef[] = [
  // ───────── 开场就有（大家都看得见）─────────
  {
    id: 'case', title: '空展柜', icon: '🫙', kind: 'physical', autoPublic: true,
    text: '玻璃展柜完好，没有被砸坏。盖子盖得好好的，四位数的密码挂锁也是锁上的。\n里面的软垫上，只剩一个圆圆的凹坑。\n展牌：「镇馆之宝 · 恐龙蛋化石 · 约 6800 万岁 · 编号 XH-0071。重约 2 千克，像一个小西瓜那么沉。蛋的底部用隐形墨水写着编号，紫外线灯下才看得见。」',
  },
  {
    id: 'bracelets', title: '营员手环登记表', icon: '📋', kind: 'document', autoPublic: true,
    text: '小小讲解员过夜营 · 夜光手环登记（20:00 发放）\n一鸣：绿色　小米：蓝色　大壮：橙色　朵朵：粉色\n夜光手环一关灯就会发光，每个营员一个。大人没有。',
  },

  // ───────── 恐龙大厅 ─────────
  { id: 'lock', title: '展柜的密码锁', icon: '🔒', kind: 'physical', location: 'hall', spot: '展柜上的密码锁', cost: 1,
    text: '锁的背面贴着一张小说明：「上锁不需要密码：把锁扣直接按进去即可。」\n也就是说，拿蛋的人不一定知道密码——只要锁本来就没按好，打开以后再按上，看起来就跟没动过一样。' },
  { id: 'lid', title: '展柜的玻璃盖子', icon: '🪟', kind: 'physical', location: 'hall', spot: '展柜的玻璃盖子', cost: 1,
    text: '盖子很重，要用两只手才掀得起来——不可能是被风吹开或者不小心碰开的。拿蛋的人还特意把盖子盖了回去。\n盖子边上有几个新鲜的手指印，太模糊了，肉眼看不清大小。' },
  { id: 'lid_zoom', title: '放大镜下的手指印', icon: '🔍', kind: 'physical', location: 'hall', spot: '用放大镜看盖子上的手指印', cost: 1, requires: { owns: 'item_magnifier' },
    text: '放大镜一看：手指印又小又细，比大人的手指小了一大圈——是小孩的手。\n赵叔叔、许姐姐、刘阿姨都是大人。' },

  // ───────── 互动区 ─────────
  { id: 'basket', title: '"摸一摸"蛋筐', icon: '🧺', kind: 'physical', location: 'play', spot: '"摸一摸恐龙蛋"的筐', cost: 1,
    text: '筐上的牌子：「仿真恐龙蛋（石膏做的），共 20 个，可以摸，请勿带走。」\n一个一个数——**21 个**！多了一个。' },
  { id: 'sandbox', title: '沙坑上的鞋印', icon: '👣', kind: 'physical', location: 'play', spot: '"化石挖掘"沙坑', cost: 1,
    text: '沙子湿湿的、平平的——晚上刚洒过水、耙平过。\n可是沙坑上有一串新鲜的鞋印：从展柜那边过来，穿过沙坑，一直走到"摸一摸"蛋筐旁边。\n鞋印比大人的小，鞋底的花纹是**一道道闪电**。' },
  { id: 'clean_log', title: '刘阿姨的清洁记录', icon: '🧹', kind: 'document', location: 'play', spot: '墙上的清洁记录表', cost: 1,
    text: '「22:00 恐龙大厅：展柜玻璃擦干净 ✓。」\n「22:00 互动区：沙坑洒水、耙平 ✓；"摸一摸"蛋数过了，20 个 ✓。」\n「22:15 下班。——刘」' },
  { id: 'heavy_egg', title: '最沉的那个蛋', icon: '🥚', kind: 'physical', location: 'play', spot: '把筐里的蛋一个个拿起来掂一掂', cost: 1, from: 'search2',
    text: '21 个蛋里，20 个轻飘飘的，是石膏做的。\n只有一个沉甸甸、凉冰冰，像一块石头——这才是真的恐龙蛋化石！它就藏在"摸一摸"的筐里。' },
  { id: 'uv_egg', title: '紫外线灯下的编号', icon: '🟣', kind: 'physical', location: 'play', spot: '用紫外线灯照蛋筐', cost: 1, requires: { owns: 'item_uv' },
    text: '紫外线灯一照，筐里有一个蛋的底部亮出一行紫色的字：**XH-0071**——和展牌上的编号一模一样！\n真的恐龙蛋，就藏在"摸一摸"的筐里。' },

  // ───────── 帐篷区 ─────────
  { id: 'shoes', title: '帐篷门口的鞋', icon: '👟', kind: 'physical', location: 'tents', spot: '帐篷门口的一排鞋', cost: 1,
    text: '四双鞋，翻过来看鞋底：\n一鸣：运动鞋，鞋底是**闪电花纹**，鞋缝里塞着湿湿的沙子。\n小米：小白鞋，鞋底是圆点花纹，干干净净。\n大壮：大号篮球鞋，鞋底是波浪花纹，干干净净。\n朵朵：粉色帆布鞋，鞋底是格子花纹，干干净净。' },
  { id: 'floor', title: '地上的湿沙鞋印', icon: '🔦', kind: 'physical', location: 'tents', spot: '帐篷区门口的地板（要手电筒）', cost: 1, requires: { owns: 'item_flashlight' },
    text: '手电筒贴着地面一照：从"摸一摸"蛋筐那边，一直到帐篷区门口，有一串淡淡的湿沙鞋印，鞋底是**一道道闪电**。\n有人晚上去过蛋筐旁边，又走回了帐篷。' },
  { id: 'backpack', title: '小米的背包', icon: '🎒', kind: 'physical', location: 'tents', spot: '小米帐篷里的背包', cost: 1,
    text: '背包鼓鼓的——里面有一个恐龙蛋！\n拿出来一掂：轻飘飘的，是石膏做的。底下贴着价签：「星河自然博物馆礼品店 · 仿真恐龙蛋 · 39 元」。' },
  { id: 'notebook', title: '一鸣的笔记本', icon: '📓', kind: 'document', location: 'tents', spot: '一鸣枕头下面的笔记本', cost: 1,
    text: '一鸣的科学笔记本。最新一页的字写得又急又乱：\n「21:30 员工休息室，许姐姐打电话：明天一早把真的换下来，换成复制品，观众谁也看不出来，真的要送走！！！」\n「不能让他们得逞。明早 8 点，告诉电视台的记者。」' },
  { id: 'noodle', title: '大壮的睡袋', icon: '🍜', kind: 'physical', location: 'tents', spot: '大壮的睡袋', cost: 1,
    text: '睡袋旁边有一个撕开的泡面袋子，空的。睡袋里一股浓浓的红烧牛肉面味。' },

  // ───────── 二楼环廊 ─────────
  { id: 'eraser', title: '栏杆边的橡皮屑', icon: '✏️', kind: 'physical', location: 'balcony', spot: '栏杆边的地上', cost: 1,
    text: '地上有一小堆橡皮屑，还有一截削过的铅笔头。有人晚上在这里画过画。\n从这儿往下看，正好能看到霸王龙、展柜和互动区。' },

  // ───────── 员工区（第二次搜线索才能进）─────────
  { id: 'camera', title: '监控录像', icon: '📹', kind: 'media', location: 'staff', spot: '监控室的录像', cost: 1, from: 'search2',
    text: '对着展柜的监控：\n22:29 展柜里的蛋还在。\n22:30 画面一黑——停电了。\n22:40 画面亮了：**展柜空了！**\n停电那十分钟，什么都没拍到。' },
  { id: 'breaker', title: '配电箱的记录', icon: '⚡', kind: 'document', location: 'staff', spot: '配电箱', cost: 1, from: 'search2',
    text: '配电箱上贴着记录：\n「22:30 茶水间插座用电太多，电闸跳了，全馆停电。」\n「22:40 合上电闸，来电。——赵」' },
  { id: 'pantry', title: '茶水间的小电锅', icon: '🍲', kind: 'physical', location: 'staff', spot: '茶水间的桌子', cost: 1, from: 'search2',
    text: '桌上有一个小电锅，锅里是煮了一半的泡面。旁边的电水壶也插着电。\n电锅把手上贴着名字贴：**王大壮**。' },
  { id: 'guide_plan', title: '许姐姐桌上的拍摄计划', icon: '🗒️', kind: 'document', location: 'staff', spot: '员工休息室里许姐姐的桌子', cost: 1, from: 'search2',
    text: '「明早 8:00 电视台拍摄。"小朋友摸一摸恐龙蛋"环节：用复制品代替真蛋（真蛋太珍贵，不能让人摸）！」\n「7:30 把真蛋送进恒温库房保管。」\n（恒温库房：温度一直不变、专门保护文物的房间。）' },
  { id: 'door_log', title: '大门出入记录', icon: '🚪', kind: 'document', location: 'staff', spot: '大门的打卡机', cost: 1, from: 'search2',
    text: '「22:15 刘阿姨 下班离开。」\n22:15 以后，博物馆的大门再也没有开过——谁也没出去，谁也没进来。' },

  // ───────── 自己剧本里带的线索卡 ─────────
  { id: 'xiaomi_swap', title: '小米：换手环', icon: '🔁', kind: 'testimony',
    text: '20:40 我和一鸣换了手环（许姐姐同意的）：现在我戴绿色，一鸣戴蓝色。登记表上还没改。' },
  { id: 'xiaomi_secret', title: '小米的秘密', icon: '🤫', kind: 'testimony',
    text: '20:30 拍完合影，许姐姐转身接电话，盖子还开着，小米偷偷用手指摸了一下恐龙蛋。背包里那个蛋是下午在礼品店买的模型。停电的时候，小米在帐篷里迷迷糊糊地睡着。' },
  { id: 'xiaomi_rustle', title: '小米：脚步声和蓝光', icon: '💤', kind: 'testimony',
    text: '停电的时候我迷迷糊糊醒了一下：帐篷外面有人走过去，脚步"咚、咚"的，很重，像抱着很沉的东西——从展柜那边来，往互动区去了。帐篷布上闪过一点蓝蓝的光，是夜光手环的光。' },
  { id: 'dazhuang_2130', title: '大壮：21:30 的一鸣', icon: '👂', kind: 'testimony',
    text: '21:30 我起来上厕所，看见一鸣把耳朵贴在员工休息室的门上，好像在偷听。我叫了他一声，他吓了一跳，跑回了帐篷。' },
  { id: 'dazhuang_secret', title: '大壮的秘密', icon: '🤫', kind: 'testimony',
    text: '22:20 大壮偷偷带着小电锅去茶水间煮泡面。22:30 他又插上电水壶，电闸跳了——停电是大壮弄的！赵叔叔马上抓到了他，让他一直站在旁边，直到 22:40 来电。' },
  { id: 'dazhuang_back', title: '大壮：没脱鞋的一鸣', icon: '⛺', kind: 'testimony',
    text: '22:40 来电后，我回帐篷的路上经过一鸣的帐篷。拉链开着：一鸣坐在里面，眼睛睁得大大的，鞋都没脱，裤脚上还沾着沙子。' },
  { id: 'duoduo_sketch', title: '朵朵的速写', icon: '🖼️', kind: 'document',
    text: '一张从二楼往下画的霸王龙，画得真好。角上写着时间：22:28。画里，展柜中的恐龙蛋还在。' },
  { id: 'duoduo_secret', title: '朵朵的秘密', icon: '🤫', kind: 'testimony',
    text: '22:10 朵朵偷偷溜上二楼环廊画画（她把自己的粉色手环塞进了袖子里）。停电时，她只看见黑暗里一个**蓝色**的夜光手环在发光：先在展柜那里，"咔哒"一声；然后移到互动区，在"摸一摸"蛋筐旁边"咕咚"一声，像放下了很沉的东西；最后回到帐篷那边，不见了。' },
  { id: 'duoduo_sand', title: '朵朵：踩沙子的声音', icon: '👂', kind: 'testimony',
    text: '那个蓝光从展柜往互动区走的时候，脚下传来"沙沙、噗嗤"的声音，像是一脚踩进了湿沙坑。' },

  // ───────── 隐藏者在"秘密时刻"可以公开的假秘密卡（别人看起来和真的一样）─────────
  { id: 'yiming_fake', title: '一鸣的秘密', icon: '🤫', kind: 'testimony',
    text: '一鸣其实很怕黑。21:30 他去上厕所，路上听见一点动静，就吓得跑回了帐篷。停电的时候，他吓得缩在睡袋里，一直没敢出来，直到来电。' },

  // ───────── 问人问到的 ─────────
  { id: 'guard_round', title: '赵叔叔：巡逻', icon: '👮', kind: 'testimony',
    text: '22:00 我巡逻的时候，蛋还好好地在展柜里，锁也挂在上面。22:40 来电后，我把那个煮泡面的男孩送到帐篷区门口，就赶回去写跳闸记录了。22:45 我出来巡逻——展柜空了！我赶紧把你们都叫醒了。' },
  { id: 'guard_dark', title: '赵叔叔：停电的时候', icon: '👮', kind: 'testimony',
    text: '一停电，我就拿着手电筒跑去员工区的配电箱。在茶水间门口抓到一个戴橙色手环的大个子男孩在煮泡面——他的小电锅和电水壶一起插着电，电闸就是这么跳的！我让他一直站在我旁边，直到 22:40 我把电闸合上。' },
  { id: 'guard_2130', title: '赵叔叔：门口偷听的男孩', icon: '👮', kind: 'testimony',
    text: '21:30 左右，我看见一个戴眼镜的男孩，耳朵贴在员工休息室的门上，好像在偷听。我喊了一声"干什么呢"，他就跑回帐篷去了。' },
  { id: 'guide_lock', title: '许姐姐：忘了锁', icon: '👩‍🏫', kind: 'testimony',
    text: '20:30 拍完合影，我的电话响了。我转身去接，打着电话把盖子盖上……好像忘了把锁按上。是我的错。' },
  { id: 'guide_swap', title: '许姐姐：换手环', icon: '👩‍🏫', kind: 'testimony',
    text: '20:40 小米跑来问能不能和一鸣换手环，她想要绿色。我说可以。所以今晚小米戴绿色，一鸣戴蓝色——登记表我还没来得及改。' },
  { id: 'guide_call', title: '许姐姐：那个电话', icon: '👩‍🏫', kind: 'testimony',
    text: '21:30 是馆长打来的电话。明早电视台要拍小朋友摸恐龙蛋，可真蛋太珍贵了，不能让人摸，所以要把真蛋换下来，换成一模一样的复制品给大家摸；真蛋送进恒温库房（温度一直不变、专门保护文物的房间）保管。我在电话里说"换成复制品，观众谁也看不出来"……难道有人听见了，以为我们要偷蛋？' },
  { id: 'guide_alibi', title: '许姐姐：视频电话', icon: '👩‍🏫', kind: 'testimony',
    text: '停电的时候，我在员工宿舍和馆长打视频电话，从 22:20 一直打到 22:50，手机上有通话记录。馆长让我待着别乱跑。' },

  // ───────── 拍卖得到的工具 ─────────
  { id: 'item_flashlight', title: '强光手电筒', icon: '🔦', kind: 'item', text: '照亮黑乎乎的地方：搜线索时，帐篷区多一个地方可以搜。' },
  { id: 'item_magnifier', title: '放大镜', icon: '🔍', kind: 'item', text: '看清小东西：搜线索时，恐龙大厅多一个地方可以搜。' },
  { id: 'item_uv', title: '紫外线灯', icon: '🟣', kind: 'item', text: '能照出隐形墨水写的字：搜线索时，互动区多一个地方可以搜。' },
  { id: 'item_badge', title: '小小讲解员徽章', icon: '🏅', kind: 'item', text: '最后算分时，直接加 2 分。' },
]

/** 每个角色开局就拿到的线索卡（隐藏者没有：他的剧本里就是真相） */
export const ROLE_START: Record<string, string[]> = {
  [XIAOMI]: ['xiaomi_swap', 'xiaomi_secret'],
  [DAZHUANG]: ['dazhuang_2130', 'dazhuang_secret'],
  [DUODUO]: ['duoduo_sketch', 'duoduo_secret'],
}

/** 每个角色「我又想起来了」时拿到的线索卡 */
export const ROLE_MEMORY: Record<string, string> = {
  [XIAOMI]: 'xiaomi_rustle',
  [DAZHUANG]: 'dazhuang_back',
  [DUODUO]: 'duoduo_sand',
}

/** 侦探的秘密卡（「秘密时刻」选择公开，所有人就都能看到） */
export const SECRET_OF: Record<string, string> = {
  [XIAOMI]: 'xiaomi_secret',
  [DAZHUANG]: 'dazhuang_secret',
  [DUODUO]: 'duoduo_secret',
}
