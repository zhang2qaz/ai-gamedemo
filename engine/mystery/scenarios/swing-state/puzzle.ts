// 《摇摆州》· 逻辑模型（用于唯一解测试）
// 每条约束都写明"由哪些线索支撑"。测试会验证：
//   1) 全部线索在手时，真相是唯一解；
//   2) 每条约束引用的线索都真实存在、且在游戏中可以取得；
//   3) 标准答案（案卷、最终指认）与唯一解一致。
import type { Puzzle } from '../../solver'

const PEOPLE = ['mandy', 'ethan', 'price', 'hector', 'preston', 'victor', 'joan', 'mike', 'luis', 'rose', 'nobody']

export const PUZZLE: Puzzle = {
  variables: [
    { id: 'roseCause', desc: '罗丝的死因', domain: ['digoxin', 'heart', 'alcohol', 'own_meds'] },
    { id: 'vehicle', desc: '毒的载体', domain: ['toast', 'dinner', 'room', 'gideon_pills'] },
    { id: 'source', desc: '毒药来源', domain: ['price_bag', 'gideon_pills', 'rose_meds', 'bar', 'victor'] },
    { id: 'poisoner', desc: '亲手下药的人', domain: PEOPLE },
    { id: 'drankBy', desc: '谁喝下了有毒的那杯', domain: ['rose', 'gideon'] },
    { id: 'how', desc: '毒酒为何到了罗丝手里', domain: ['mirror', 'swap', 'rose_chose', 'gave'] },
    { id: 'knew', desc: '下药者是否知道那是毒药', domain: ['knew', 'deceived'] },
    { id: 'roseBeforeNews', desc: '罗丝是否死在噩耗传开之前', domain: ['yes', 'no'] },
    { id: 'fallTime', desc: '吉迪恩坠落时刻', domain: ['0229', '0233', '0237', '0240', '0248'] },
    { id: 'pusher', desc: '推吉迪恩的人', domain: PEOPLE },
    { id: 'noteAuthor', desc: '匿名信作者', domain: ['price', 'gideon', 'rose', 'preston', 'joan'] },
    { id: 'meiKiller', desc: '2000 年林梅之死', domain: ['price', 'frank', 'gideon', 'accident', 'suicide'] },
    { id: 'mandyFather', desc: '曼迪的生父', domain: ['gideon', 'frank', 'price', 'unknown'] },
    { id: 'ethanMother', desc: '伊森的生母', domain: ['rose', 'mei', 'unknown'] },
    { id: 'roseVisitor', desc: '一点半看着罗丝病倒、却没叫救护车的人', domain: ['joan', 'price', 'mandy', 'hector', 'nobody'] },
    { id: 'safeIntruder', desc: '三点过后偷试保险箱密码的人', domain: ['preston', 'mandy', 'price', 'ethan', 'victor', 'nobody'] },
  ],
  constraints: [
    // ── 罗丝之死 ──
    { id: 'symptoms', clues: ['pills', 'rose_notes'], vars: ['roseCause'], desc: '看东西发黄、灯有光晕＝说明书上的地高辛过量症状', test: a => a.roseCause === 'digoxin' },
    { id: 'symptoms_alt', clues: ['pills', 'joan_rose'], vars: ['roseCause'], desc: '乔安证词中的症状同样吻合', test: a => a.roseCause === 'digoxin' },
    { id: 'residue_is_digoxin', clues: ['flutes', 'clutch', 'med_bag'], vars: ['roseCause'], desc: '杯底残留与空滴瓶同味，滴瓶与普莱斯药箱里的地高辛浓缩液同批号', test: a => a.roseCause === 'digoxin' },
    { id: 'not_own_meds', clues: ['rose_meds'], vars: ['source'], desc: '罗丝药盒只有降压药', test: a => a.source !== 'rose_meds' },
    { id: 'pills_full', clues: ['pills'], vars: ['source', 'vehicle'], desc: '吉迪恩的药片数量完整', test: a => a.source !== 'gideon_pills' && a.vehicle !== 'gideon_pills' },
    { id: 'flute_residue', clues: ['flutes'], vars: ['vehicle', 'drankBy'], desc: '只有罗丝喝干的那只祝酒杯有药水残留', test: a => a.vehicle === 'toast' && a.drankBy === 'rose' },
    { id: 'batch', clues: ['med_bag', 'clutch'], vars: ['source'], desc: '空滴瓶与普莱斯药箱同批号，药箱少一瓶', test: a => a.source === 'price_bag' },
    { id: 'handed_over', clues: ['hector_corridor', 'clutch'], vars: ['source'], desc: '赫克托看见普莱斯把这只棕色小瓶交给曼迪', test: a => a.source === 'price_bag' },
    { id: 'toast_drink', clues: ['joan_rose', 'photo', 'flutes'], vars: ['vehicle'], desc: '罗丝自己说"我为我们干了杯"；照片里她一饮而尽；只有她那杯有残留', test: a => a.vehicle === 'toast' },
    { id: 'tray_alone', clues: ['hector_tray'], vars: ['poisoner'], desc: '托盘只经过赫克托和曼迪的手', test: a => a.poisoner === 'mandy' || a.poisoner === 'hector' },
    { id: 'eyewitness_pour', clues: ['b_saw'], vars: ['poisoner'], desc: '伊森透过舷窗看见曼迪往杯里倒药', test: a => a.poisoner === 'mandy' },
    { id: 'bottle_in_bag', clues: ['clutch', 'hector_corridor'], vars: ['poisoner'], desc: '普莱斯把小瓶交给曼迪（赫克托目击），空瓶在曼迪手包里', test: a => a.poisoner === 'mandy' },
    { id: 'told_sleep_aid', clues: ['hector_corridor'], vars: ['knew'], desc: '普莱斯当着赫克托的面说那是"睡个好觉的东西"', test: a => a.knew === 'deceived' },
    { id: 'label_sedative', clues: ['clutch', 'rx_pad'], vars: ['knew'], desc: '瓶上是普莱斯亲笔写的"镇静剂"；而她把空瓶留在了自己手包里——知情的投毒者会处理掉它', test: a => a.knew === 'deceived' },
    { id: 'no_swap', clues: ['photo'], vars: ['how'], desc: '照片：两人各自直接从托盘上取杯，没有交换或递杯', test: a => a.how !== 'swap' && a.how !== 'gave' },
    { id: 'right_glass', clues: ['hector_right', 'photo'], vars: ['how'], desc: '吉迪恩只拿自己右边那杯，罗丝拿剩下那杯——罗丝没有"拿错"', test: a => a.how !== 'rose_chose' },
    { id: 'mirror', clues: ['a_confess', 'hector_right', 'photo'], vars: ['how', 'drankBy'], desc: '"你右手边"＋面对面递托盘＝吉迪恩的左手边＝罗丝那杯', test: a => a.how === 'mirror' && a.drankBy === 'rose' },
    { id: 'mirror_alt', clues: ['a_confess', 'med_record'], vars: ['how'], desc: '普莱斯自己的病历写明吉迪恩"固定取右侧一杯"，却让面对面递盘的曼迪放进"她的右手边"', test: a => a.how === 'mirror' },
    { id: 'time_of_death', clues: ['pbx', 'body_r'], vars: ['roseBeforeNews'], desc: '02:06 起听筒摘机、无人能打进来；03:12 已有成片尸斑与下颌僵硬', test: a => a.roseBeforeNews === 'yes' },

    // ── 吉迪恩之死 ──
    { id: 'struggle', clues: ['cufflink', 'body_g'], vars: ['pusher'], desc: '袖扣被扯落、指甲缝有皮屑：塔上有人与他扭打', test: a => a.pusher !== 'nobody' },
    { id: 'saw_push', clues: ['a_saw'], vars: ['pusher'], desc: '曼迪亲眼看见有人把他推出栏杆', test: a => a.pusher !== 'nobody' },
    { id: 'torn_tube', clues: ['earpiece'], vars: ['pusher'], desc: '阳台栏杆缝里有扯断的安保耳麦管：塔上发生过扭打', test: a => a.pusher !== 'nobody' },
    { id: 'door', clues: ['door_log', 'mike_codes', 'cctv_log'], vars: ['pusher'], desc: '17:58 后只有 #1（吉迪恩）与 #3（安保通用码）进过塔，#3 只有麦克、路易斯、伊森知道', test: a => ['ethan', 'mike', 'luis', 'nobody'].includes(a.pusher) },
    { id: 'door_told', clues: ['mike_door', 'mike_codes'], vars: ['pusher'], desc: '麦克口述的门禁记录：同上', test: a => ['ethan', 'mike', 'luis', 'nobody'].includes(a.pusher) },
    { id: 'security_alibi', clues: ['radio_log'], vars: ['pusher'], desc: '麦克、路易斯全程在岗（基站记录、安保室与门岗录像）', test: a => a.pusher !== 'mike' && a.pusher !== 'luis' },
    { id: 'security_alibi_told', clues: ['mike_alibi'], vars: ['pusher'], desc: '麦克的证词：他和路易斯都在摄像头下', test: a => a.pusher !== 'mike' && a.pusher !== 'luis' },
    { id: 'appearance', clues: ['a_saw', 'mike_alibi'], vars: ['pusher'], desc: '目击：高个子、深色短发——排除光头的麦克与维克多、金发的普雷斯顿、灰发的普莱斯、白发的赫克托、花白卷发的路易斯，以及女性', test: a => a.pusher === 'ethan' || a.pusher === 'nobody' },
    { id: 'scratch', clues: ['body_g', 'price_scratch'], vars: ['pusher'], desc: '吉迪恩指甲缝有皮屑血迹；伊森手腕有三道新鲜抓痕', test: a => a.pusher === 'ethan' || a.pusher === 'nobody' },
    { id: 'earpiece', clues: ['earpiece', 'joan_ethan'], vars: ['pusher'], desc: '阳台上的安保耳麦管断段；伊森 02:47 进门时耳麦不见了', test: a => a.pusher === 'ethan' || a.pusher === 'nobody' },
    { id: 'fox_moment', clues: ['a_saw', 'joan_notes'], vars: ['fallTime'], desc: '书房电视（Fox）宣布的那一刻＝02:40', test: a => a.fallTime === '0240' },
    { id: 'fox_moment_alt', clues: ['preston_thud', 'joan_notes'], vars: ['fallTime'], desc: '露台户外屏（Fox）宣布的同时听到闷响＝02:40', test: a => a.fallTime === '0240' },
    { id: 'fox_moment_dvr', clues: ['a_saw', 'dvr'], vars: ['fallTime'], desc: '曼迪看见推人时，书房电视（Fox）正在宣布；书房录像盒录下 Fox 宣布在 02:40', test: a => a.fallTime === '0240' },
    { id: 'fox_moment_dvr_terrace', clues: ['preston_thud', 'dvr'], vars: ['fallTime'], desc: '露台户外屏（Fox）宣布的同时听到闷响；录像盒：Fox 02:40 宣布', test: a => a.fallTime === '0240' },
    { id: 'fox_moment_dvr_victor', clues: ['victor_thud', 'dvr'], vars: ['fallTime'], desc: '维克多：露台户外屏（Fox）刚宣布就听见"砰"的一声；录像盒：Fox 02:40 宣布', test: a => a.fallTime === '0240' },
    { id: 'fox_moment_victor', clues: ['victor_thud', 'joan_notes'], vars: ['fallTime'], desc: '维克多：露台户外屏（Fox）刚宣布就听见"砰"的一声＝02:40', test: a => a.fallTime === '0240' },
    { id: 'preston_watch', clues: ['preston_thud'], vars: ['fallTime'], desc: '普雷斯顿记得闷响是在两点四十', test: a => a.fallTime === '0240' },
    { id: 'after_entry', clues: ['door_log'], vars: ['fallTime'], desc: '第二个人 02:37 才进塔', test: a => a.fallTime >= '0237' },
    { id: 'note_printer', clues: ['note', 'printer_log', 'pc_bin'], vars: ['noteAuthor'], desc: '匿名信由 5 号客房电脑打印并删除', test: a => a.noteAuthor === 'price' || a.noteAuthor === 'preston' || a.noteAuthor === 'joan' },
    { id: 'note_knowledge', clues: ['golf_card'], vars: ['noteAuthor'], desc: '普莱斯 11/06 就记下"E＝弗兰克之子"——写信人必须知道这一点', test: a => a.noteAuthor === 'price' },

    // ── 2000 年 ──
    { id: 'gideon_on_phone', clues: ['hector_night'], vars: ['meiKiller'], desc: '2000 年那晚吉迪恩被电话缠在书房，没有上塔', test: a => a.meiKiller !== 'gideon' },
    { id: 'frank_log', clues: ['frank_log', 'joan_2000'], vars: ['meiKiller'], desc: '值班日志：出塔的人个子不高、拎黑色小皮包、手背被抓伤；乔安：林梅说"有个医生给姑娘们下药"', test: a => a.meiKiller === 'price' },
    { id: 'frank_saw', clues: ['frank_letter'], vars: ['meiKiller'], desc: '弗兰克看见另一个男人（医生皮包、手背抓痕）出塔', test: a => a.meiKiller !== 'frank' && a.meiKiller !== 'accident' && a.meiKiller !== 'suicide' },
    { id: 'diary', clues: ['mei_diary'], vars: ['meiKiller'], desc: '林梅日记：普莱斯约她两点在灯塔谈', test: a => a.meiKiller === 'price' || a.meiKiller === 'gideon' || a.meiKiller === 'frank' },
    { id: 'rose_saw', clues: ['rose_letter'], vars: ['meiKiller'], desc: '罗丝看见普莱斯在备餐间洗袖口上的血', test: a => a.meiKiller === 'price' },
    { id: 'confession', clues: ['confession'], vars: ['meiKiller'], desc: '吉迪恩的忏悔信', test: a => a.meiKiller === 'price' },

    // ── 身世 ──
    { id: 'dna', clues: ['dna'], vars: ['mandyFather'], desc: '亲子鉴定 99.99%', test: a => a.mandyFather === 'gideon' },
    { id: 'rose_says_father', clues: ['rose_letter'], vars: ['mandyFather'], desc: '罗丝的信："吉迪恩是你的父亲"', test: a => a.mandyFather === 'gideon' },
    { id: 'will_daughter', clues: ['will', 'license'], vars: ['mandyFather'], desc: '遗嘱写着"我的女儿林曼（1990-04-12）"', test: a => a.mandyFather === 'gideon' },
    { id: 'rose_box', clues: ['rose_box', 'dogtags'], vars: ['ethanMother'], desc: '罗丝首饰盒里的婴儿照"伊森 1986.3.14"与弗兰克照片；兵籍牌姓科尔', test: a => a.ethanMother === 'rose' },
    { id: 'mijo', clues: ['voicemail'], vars: ['ethanMother'], desc: '罗丝留言叫他"我的儿子"', test: a => a.ethanMother === 'rose' },

    // ── 另外两个人的秘密 ──
    { id: 'visit_told', clues: ['joan_rose'], vars: ['roseVisitor'], desc: '乔安亲口说：一点半罗丝叫她去房间，她没有叫救护车', test: a => a.roseVisitor === 'joan' },
    { id: 'visit_clip', clues: ['press_clip', 'guestbook'], vars: ['roseVisitor'], desc: '罗丝床脚有一枚记者证卡扣，刻着"J.M."——今晚的宾客里只有乔安·默瑟是记者', test: a => a.roseVisitor === 'joan' },
    { id: 'visit_stairs', clues: ['hector_joan'], vars: ['roseVisitor'], desc: '一点四十赫克托碰见乔安从罗丝那层下来，她说罗丝"喝多了，睡了"——她见过罗丝', test: a => a.roseVisitor === 'joan' },
    { id: 'safe_late', clues: ['safe_log'], vars: ['safeIntruder'], desc: '保险箱面板 03:14 还有一次密码错误——曼迪两点半之后，又有人来试过', test: a => a.safeIntruder !== 'nobody' },
    { id: 'safe_window', clues: ['v_preston', 'safe_log'], vars: ['safeIntruder'], desc: '03:10—03:20 普雷斯顿一个人去了只有书房和化妆间的北翼，回来满头大汗；03:14 正是那次试密码', test: a => a.safeIntruder === 'preston' },
    { id: 'safe_told', clues: ['preston_safe'], vars: ['safeIntruder'], desc: '普雷斯顿自己承认 03:14 试了老密码 1107', test: a => a.safeIntruder === 'preston' },
  ],
}

/** 标准答案（与 content.ts 的案卷、指认一致） */
export const EXPECTED = {
  roseCause: 'digoxin',
  vehicle: 'toast',
  source: 'price_bag',
  poisoner: 'mandy',
  drankBy: 'rose',
  how: 'mirror',
  knew: 'deceived',
  roseBeforeNews: 'yes',
  fallTime: '0240',
  pusher: 'ethan',
  noteAuthor: 'price',
  meiKiller: 'price',
  mandyFather: 'gideon',
  ethanMother: 'rose',
  roseVisitor: 'joan',
  safeIntruder: 'preston',
}
