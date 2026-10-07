// 《恐龙蛋失踪之夜》· 可以问话的人（服务器端专用）
// 规则和玩家一样：大人和"电脑替身"都不说谎；不想说的，会说"这是我的秘密"。
// 回答和拿到的证词卡用同一段字（said），免得两边写得不一样。
import type { NpcDef } from '../../types'
import { CLUES } from './clues'
import { DAZHUANG, DUODUO } from './roles'

function said(clueId: string): string {
  const c = CLUES.find(x => x.id === clueId)
  if (!c) throw new Error(`没有这条线索：${clueId}`)
  return c.text
}

const SAW_2130 = { any: [{ hasClue: 'guard_2130' }, { hasClue: 'dazhuang_2130' }, { hasClue: 'notebook' }] }
const DZ_CONFESS = '好吧好吧……我偷偷带了小电锅，跑去茶水间煮泡面。面快好了，我又插上电水壶——"啪"，电闸跳了，停电是我弄的！赵叔叔马上抓到了我，一直让我站在他旁边，我哪儿也没去。'
const DD_CONFESS = '……好吧，我说。我偷偷上了二楼画画，怕被发现，还把自己的手环塞进了袖子里。停电的时候，黑漆漆的大厅里，我只看见一个蓝色的手环在亮：先在展柜那里"咔哒"一声，然后移到互动区，在"摸一摸"蛋筐旁边"咕咚"一声，最后回到帐篷那边，不见了。'

export const NPCS: NpcDef[] = [
  {
    id: 'guard', name: '保安赵叔叔', title: '博物馆的夜班保安', avatar: '👮',
    profile: '博物馆的夜班保安，手电筒从不离手。今晚是他第一个发现恐龙蛋不见了。',
    questions: [
      { id: 'g_round', ask: '赵叔叔，您是怎么发现蛋不见的？', answer: said('guard_round'), grants: ['guard_round'] },
      { id: 'g_dark', ask: '停电的时候，您在哪儿？', answer: said('guard_dark'), grants: ['guard_dark'] },
      { id: 'g_2130', ask: '晚上您还看见谁在外面走动吗？', answer: said('guard_2130'), grants: ['guard_2130'] },
    ],
  },
  {
    id: 'guide', name: '讲解员许姐姐', title: '带你们参观的讲解员', avatar: '👩‍🏫',
    profile: '带你们参观的讲解员，一讲起恐龙眼睛就发光。今晚睡在员工宿舍。',
    questions: [
      { id: 'x_lock', ask: '许姐姐，拍完合影以后，展柜的锁是您锁的吗？', answer: `（许姐姐愣了一下，脸红了）${said('guide_lock')}`, grants: ['guide_lock'] },
      { id: 'x_swap', ask: '（拿出手环登记表）晚上有人换过手环吗？', present: 'bracelets', answer: said('guide_swap'), grants: ['guide_swap'] },
      { id: 'x_call', ask: '21:30 您在员工休息室里打电话吗？说了什么？', requires: SAW_2130, answer: said('guide_call'), grants: ['guide_call'] },
      { id: 'x_alibi', ask: '停电的时候，您在哪儿？', answer: said('guide_alibi'), grants: ['guide_alibi'] },
    ],
  },
  // 人不够时，电脑替大壮、朵朵回答问题（有人演他们时，这两位就不出现）。替身也不说谎：不想说的会说"这是我的秘密"。
  {
    id: 'dazhuang_npc', name: '大壮', title: '营员 · 篮球队主力', avatar: '🏀', standsInFor: DAZHUANG,
    profile: '个子全营最高，饭量全营第一。今天没有人扮演大壮，由电脑来回答。',
    questions: [
      { id: 'dz_where', ask: '大壮，停电的时候你在哪儿？', answer: '（大壮挠挠头）这个嘛……是我的秘密，不想说。' },
      { id: 'dz_noodle', ask: '（说出睡袋里的泡面味）你半夜是不是去煮泡面了？', present: 'noodle', answer: DZ_CONFESS, grants: ['dazhuang_secret'] },
      { id: 'dz_guard', ask: '（说出赵叔叔的话）赵叔叔抓到的那个煮泡面的男孩，是你吧？', present: 'guard_dark', answer: DZ_CONFESS, grants: ['dazhuang_secret'] },
      { id: 'dz_2130', ask: '晚上你还看见什么奇怪的事了吗？', answer: said('dazhuang_2130'), grants: ['dazhuang_2130'] },
      { id: 'dz_back', ask: '来电以后，你回帐篷的路上看见了什么？', from: 'search2', answer: said('dazhuang_back'), grants: ['dazhuang_back'] },
    ],
  },
  {
    id: 'duoduo_npc', name: '朵朵', title: '营员 · 小画家', avatar: '🎨', standsInFor: DUODUO,
    profile: '画画拿过全市一等奖，走到哪儿都带着速写本。今天没有人扮演朵朵，由电脑来回答。',
    questions: [
      { id: 'dd_where', ask: '朵朵，停电的时候你在帐篷里吗？', answer: '（朵朵把速写本抱得紧紧的）这是我的秘密，不想说。' },
      { id: 'dd_sketch', ask: '能给我看看你今晚画的画吗？', answer: '（她翻开速写本）这张霸王龙是从高处画的，角上写着 22:28。你看，那时候展柜里的蛋还在。', grants: ['duoduo_sketch'] },
      { id: 'dd_eraser', ask: '（说出二楼栏杆边的橡皮屑）晚上在二楼画画的，是你吧？停电的时候你看见了什么？', present: 'eraser', answer: DD_CONFESS, grants: ['duoduo_secret'] },
      { id: 'dd_glow', ask: '（拿出手环登记表）停电的时候，你看见谁的手环在亮了吗？', present: 'bracelets', from: 'search2', answer: DD_CONFESS, grants: ['duoduo_secret'] },
      { id: 'dd_sand', ask: '那个蓝光走过去的时候，你还听见别的声音了吗？', requires: { hasClue: 'duoduo_secret' }, answer: said('duoduo_sand'), grants: ['duoduo_sand'] },
    ],
  },
]
