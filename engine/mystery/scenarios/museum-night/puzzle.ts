// 《恐龙蛋失踪之夜》· 逻辑模型（用于唯一解测试）
// 每条约束都写明"由哪些线索支撑"。测试会验证：全部线索在手时真相唯一；引用的线索都存在、能拿到；
// 每个侦探单干也能推出"谁、在哪、为什么、停电"；朵朵没人演的局里，隐藏者就算把能搜的线索全藏起来，侦探光靠问人也能破案；
// 朵朵有人演时，她握着最关键的目击（要不要说，是她的博弈），小米靠自己的回忆也能认出隐藏者。
// 公开信息（人物介绍里"一鸣戴眼镜"、开场的空展柜和手环登记表）当作大家都知道。
import type { Puzzle } from '../../solver'

const KIDS = ['yiming', 'xiaomi', 'dazhuang', 'duoduo']
const ALL = [...KIDS, 'guard', 'guide', 'cleaner']
const PROTECT_IF_YIMING = (a: Record<string, string>) => a.taker !== 'yiming' || a.why === 'protect'

export const PUZZLE: Puzzle = {
  variables: [
    { id: 'taker', desc: '拿走恐龙蛋的是谁', domain: ALL },
    { id: 'blue', desc: '停电时戴蓝色手环的是谁', domain: KIDS },
    { id: 'where', desc: '恐龙蛋现在在哪儿', domain: ['basket', 'backpack', 'trex', 'out'] },
    { id: 'why', desc: '为什么拿', domain: ['home', 'protect', 'accident', 'show'] },
    { id: 'blackout', desc: '停电是怎么回事', domain: ['cooker', 'thief', 'storm', 'guard'] },
    { id: 'when', desc: '蛋是什么时候被拿走的', domain: ['early', 'dark', 'late'] },
  ],
  constraints: [
    // ── 谁拿的：手环链 ──
    { id: 'glow', clues: ['duoduo_secret'], vars: ['taker', 'blue', 'where', 'when'], desc: '黑暗里只有夜光手环会发光：蓝色光点从展柜（咔哒）到蛋筐（咕咚）——戴蓝手环的人拿了蛋，放进了蛋筐', test: a => a.taker === a.blue && a.where === 'basket' && a.when === 'dark' },
    { id: 'rustle', clues: ['xiaomi_rustle'], vars: ['taker', 'blue', 'when'], desc: '停电时，戴蓝手环的人抱着很沉的东西从展柜走向互动区（小米在帐篷里听见、看见的）', test: a => a.taker === a.blue && a.when === 'dark' },
    { id: 'swap_card', clues: ['xiaomi_swap'], vars: ['blue'], desc: '小米和一鸣换了手环：那晚一鸣戴蓝色', test: a => a.blue === 'yiming' },
    { id: 'swap_guide', clues: ['guide_swap'], vars: ['blue'], desc: '许姐姐证实：小米和一鸣换了手环，一鸣戴蓝色', test: a => a.blue === 'yiming' },
    // ── 谁拿的：鞋印链 ──
    { id: 'sand_shoes', clues: ['sandbox', 'shoes'], vars: ['taker'], desc: '沙坑 22:00 刚耙平，闪电花纹的小鞋印从展柜走到蛋筐；只有一鸣的鞋是闪电花纹、鞋缝有湿沙', test: a => a.taker === 'yiming' },
    { id: 'floor_shoes', clues: ['floor', 'shoes'], vars: ['taker', 'where'], desc: '闪电花纹的湿沙鞋印从蛋筐走回帐篷区＝一鸣晚上去过蛋筐；蛋在筐里，就是他放的', test: a => a.where !== 'basket' || a.taker === 'yiming' },
    { id: 'back_sand', clues: ['dazhuang_back', 'sandbox'], vars: ['taker'], desc: '来电后一鸣穿着鞋、裤脚沾沙；沙坑上那串小鞋印是从展柜走到蛋筐的', test: a => a.taker === 'yiming' },
    { id: 'kid_hand', clues: ['lid_zoom', 'clean_log'], vars: ['taker'], desc: '展柜玻璃 22:00 刚擦过，盖子上新留下的是小孩的手指印', test: a => KIDS.includes(a.taker) },
    { id: 'sand_blue', clues: ['duoduo_sand', 'shoes'], vars: ['blue'], desc: '那个蓝光一脚踩进了湿沙坑；只有一鸣的鞋缝里有湿沙子', test: a => a.blue === 'yiming' },
    { id: 'sand_back', clues: ['duoduo_sand', 'dazhuang_back'], vars: ['blue'], desc: '那个蓝光一脚踩进了湿沙坑；来电后一鸣穿着鞋、裤脚沾着沙子', test: a => a.blue === 'yiming' },
    // ── 时间与不在场 ──
    { id: 'camera', clues: ['camera'], vars: ['when'], desc: '监控：22:29 还在，22:40 已经没了', test: a => a.when === 'dark' },
    { id: 'sketch', clues: ['duoduo_sketch'], vars: ['when'], desc: '朵朵 22:28 的速写里蛋还在', test: a => a.when !== 'early' },
    { id: 'guard_dark', clues: ['guard_dark'], vars: ['taker', 'when', 'blackout'], desc: '停电那十分钟赵叔叔和大壮一直在一起；电闸是小电锅弄跳的', test: a => a.blackout === 'cooker' && (a.when !== 'dark' || (a.taker !== 'guard' && a.taker !== 'dazhuang')) },
    { id: 'dz_secret', clues: ['dazhuang_secret'], vars: ['taker', 'when', 'blackout'], desc: '大壮：停电是我煮泡面弄的，赵叔叔一直看着我', test: a => a.blackout === 'cooker' && (a.when !== 'dark' || (a.taker !== 'guard' && a.taker !== 'dazhuang')) },
    { id: 'door', clues: ['door_log'], vars: ['taker', 'where', 'when'], desc: '刘阿姨 22:15 下班，之后大门没开过：她不可能在停电时拿蛋，蛋也没被带出去', test: a => a.where !== 'out' && (a.when === 'early' || a.taker !== 'cleaner') },
    { id: 'guide_alibi', clues: ['guide_alibi'], vars: ['taker', 'when'], desc: '许姐姐 22:20–22:50 一直在打视频电话', test: a => a.when === 'early' || a.taker !== 'guide' },
    // ── 在哪儿 ──
    { id: 'count', clues: ['basket', 'clean_log'], vars: ['where'], desc: '22:00 蛋筐里 20 个，现在 21 个——多出来的那个就是真蛋', test: a => a.where === 'basket' },
    { id: 'heavy', clues: ['heavy_egg'], vars: ['where'], desc: '筐里有一个沉甸甸的石头蛋', test: a => a.where === 'basket' },
    { id: 'uv', clues: ['uv_egg'], vars: ['where'], desc: '紫外线灯照出 XH-0071', test: a => a.where === 'basket' },
    { id: 'backpack', clues: ['backpack'], vars: ['where'], desc: '小米背包里的是 39 元的石膏模型', test: a => a.where !== 'backpack' },
    // ── 为什么 ──
    { id: 'notebook', clues: ['notebook'], vars: ['taker', 'why'], desc: '一鸣的笔记本：以为有人要把真蛋换掉送走，要保护它', test: PROTECT_IF_YIMING },
    { id: 'call_guard', clues: ['guide_call', 'guard_2130'], vars: ['taker', 'why'], desc: '戴眼镜的男孩（一鸣）偷听到"把真的换下来"的电话', test: PROTECT_IF_YIMING },
    { id: 'call_dz', clues: ['guide_call', 'dazhuang_2130'], vars: ['taker', 'why'], desc: '大壮看见一鸣偷听；电话里说"把真的换下来"', test: PROTECT_IF_YIMING },
    { id: 'lid', clues: ['lid'], vars: ['why'], desc: '盖子很重，还被特意盖了回去：不是不小心碰掉的', test: a => a.why !== 'accident' },
    // ── 停电 ──
    { id: 'breaker_only', clues: ['breaker'], vars: ['blackout'], desc: '是茶水间插座用电太多跳的闸：不是打雷，也不是有人去关电闸', test: a => a.blackout !== 'storm' && a.blackout !== 'guard' },
    { id: 'breaker', clues: ['breaker', 'pantry'], vars: ['blackout'], desc: '茶水间插座用电太多跳闸；茶水间里是大壮的小电锅', test: a => a.blackout === 'cooker' },
    { id: 'breaker_noodle', clues: ['breaker', 'noodle'], vars: ['blackout'], desc: '茶水间插座用电太多跳闸；大壮的睡袋旁有空泡面袋', test: a => a.blackout === 'cooker' },
  ],
}

/** 标准答案（与 content.ts 的推理题、投票一致） */
export const EXPECTED = {
  taker: 'yiming',
  blue: 'yiming',
  where: 'basket',
  why: 'protect',
  blackout: 'cooker',
  when: 'dark',
}
