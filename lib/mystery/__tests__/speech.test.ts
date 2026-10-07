// 朗读：文本整理、分句、选声音，以及播放器（用假的 speechSynthesis 驱动）
import { pickVoice, splitSentences, toSpeechText } from '../speech'

describe('朗读文本整理', () => {
  test('去掉粗体标记、表情和小标题符号', () => {
    expect(toSpeechText('## 第一幕\n🗂️ **曼迪** 交出了证据 →')).toBe('第一幕\n曼迪 交出了证据 ，')
  })

  test('钟点、日期、美元读成中文习惯', () => {
    expect(toSpeechText('02:40 Fox 宣布')).toBe('2点40分 Fox 宣布')
    expect(toSpeechText('02:06 起')).toBe('2点零6分 起')
    expect(toSpeechText('23:30:12')).toBe('23点30分12秒')
    expect(toSpeechText('06:00')).toBe('6点整')
    expect(toSpeechText('11/07 22:14')).toBe('11月7日 22点14分')
    expect(toSpeechText('出生日期：04/12/1990')).toBe('出生日期：1990年4月12日')
    expect(toSpeechText('酬金 $3,000')).toBe('酬金 3000美元')
    expect(toSpeechText('01:58 打给伊森，通话 0:41')).toBe('1点58分 打给伊森，通话 41秒')
    expect(toSpeechText('第 2/3 轮')).toBe('第 2/3 轮')
    expect(toSpeechText('吉迪恩·万斯')).toBe('吉迪恩万斯')
    expect(toSpeechText('第 1 轮 · 05:00')).toBe('第 1 轮，5点整')
    // 小学生剧本：星星、橡果是当字用的
    expect(toSpeechText('一共 12颗⭐，剩下 🌰5')).toBe('一共 12颗星，剩下 橡果5')
  })

  test('不使用旧版 Safari 不支持的正则写法（后行断言会让整个页面打不开）', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'speech.ts'), 'utf8') as string
    expect(src).not.toMatch(/\(\?<[=!]/)
  })

  test('按句切开，长句再按逗号切，标点碎片并入前一句', () => {
    const s = splitSentences('第一句。第二句！"第三句？"\n第四句')
    expect(s).toEqual(['第一句。', '第二句！', '"第三句？"', '第四句'])
    const long = '一二三四五六七八九十，'.repeat(10) + '完。'
    const parts = splitSentences(long, 30)
    expect(parts.length).toBeGreaterThan(2)
    expect(parts.join('')).toBe(long)
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(31)
    expect(splitSentences('。。。')).toEqual([])
  })
})

describe('选声音', () => {
  test('优先中国大陆普通话的自然音色；粤语排最后；没有中文就返回 null', () => {
    const v = pickVoice([
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Sin-ji', lang: 'zh-HK' },
      { name: 'Mei-Jia', lang: 'zh-TW' },
      { name: 'Tingting', lang: 'zh-CN' },
      { name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', lang: 'zh-CN' },
    ])
    expect(v?.name).toMatch(/Xiaoxiao/)
    expect(pickVoice([{ name: 'Sin-ji', lang: 'zh-HK' }, { name: 'Mei-Jia', lang: 'zh-TW' }])?.name).toBe('Mei-Jia')
    expect(pickVoice([{ name: 'Samantha', lang: 'en-US' }])).toBeNull()
  })
})

// ───────── 播放器 ─────────

type Utter = { text: string; lang?: string; rate?: number; onend?: () => void; onerror?: (e: { error: string }) => void }
const spoken: Utter[] = []
const mem = new Map<string, string>()
const synth = {
  speak(u: Utter) { spoken.push(u) },
  cancel() {},
  getVoices: () => [{ name: 'Tingting', lang: 'zh-CN' }],
  addEventListener() {},
}
const g = globalThis as Record<string, unknown>
g.window = {
  speechSynthesis: synth,
  SpeechSynthesisUtterance: function (this: Utter, t: string) { this.text = t },
  localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) } },
}

const made: { stop(): void }[] = []
function freshSpeaker() {
  let sp!: NonNullable<ReturnType<typeof import('../speech')['getSpeaker']>>
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sp = (require('../speech') as typeof import('../speech')).getSpeaker()!
  })
  made.push(sp)
  return sp
}
/** 当前这句念完 */
const finish = () => spoken[spoken.length - 1].onend?.()

beforeEach(() => { spoken.length = 0; mem.clear() })
afterEach(() => { for (const sp of made.splice(0)) sp.stop() })

describe('朗读播放器', () => {
  test('一句一句念完整段，念完就停', () => {
    const sp = freshSpeaker()
    expect(sp.state.supported).toBe(true)
    expect(sp.state.voiceName).toBe('Tingting')
    sp.play({ id: 'a', label: '甲', text: '第一句。第二句。' })
    expect(sp.state.current?.id).toBe('a')
    expect(spoken.map(u => u.text)).toEqual(['第一句。'])
    expect(spoken[0].lang).toBe('zh-CN')
    finish()
    expect(sp.state.index).toBe(1)
    expect(spoken.map(u => u.text)).toEqual(['第一句。', '第二句。'])
    finish()
    expect(sp.state.current).toBeNull()
  })

  test('点按钮会打断正在读的；自动朗读排队，读完再念', () => {
    const sp = freshSpeaker()
    sp.play({ id: 'a', label: '甲', text: '甲一。甲二。' })
    sp.enqueue({ id: 'b', label: '乙', text: '乙。' })
    sp.enqueue({ id: 'b', label: '乙', text: '乙。' }) // 同一段不会排两次
    expect(sp.state.queued).toBe(1)
    finish(); finish()
    expect(sp.state.current?.id).toBe('b')
    sp.play({ id: 'c', label: '丙', text: '丙。' })
    expect(sp.state.current?.id).toBe('c')
    expect(sp.state.queued).toBe(0)
  })

  test('被打断的旧句子迟到的"念完"不会让新段落跳句', () => {
    const sp = freshSpeaker()
    sp.play({ id: 'a', label: '甲', text: '甲一。甲二。' })
    const old = spoken[0]
    sp.play({ id: 'b', label: '乙', text: '乙一。乙二。' })
    old.onend?.()
    expect(sp.state.current?.id).toBe('b')
    expect(sp.state.index).toBe(0)
  })

  test('暂停后从当前句继续；上一句 / 下一句', () => {
    const sp = freshSpeaker()
    sp.play({ id: 'a', label: '甲', text: '一。二。三。' })
    finish()
    sp.pause()
    expect(sp.state.paused).toBe(true)
    finish() // 暂停时被取消的那句"念完"了，也不会往下走
    expect(sp.state.index).toBe(1)
    sp.resume()
    expect(spoken[spoken.length - 1].text).toBe('二。')
    sp.jump(1)
    expect(spoken[spoken.length - 1].text).toBe('三。')
    sp.jump(-5)
    expect(sp.state.index).toBe(0)
  })

  test('语速和自动朗读开关会记住；打开自动朗读时先念一句（手机上用来"解锁"声音）', () => {
    const sp = freshSpeaker()
    sp.setRate(0.75)
    sp.setAuto(true)
    expect(spoken[spoken.length - 1].rate).toBe(0.75)
    expect(sp.state.current?.id).toBe('speech:hello')
    const again = freshSpeaker()
    expect(again.state.rate).toBe(0.75)
    expect(again.state.auto).toBe(true)
    again.setAuto(false)
    expect(again.state.current).toBeNull()
  })

  test('念出错（不是被打断）时接着往下念，不会卡住；被别的程序打断就停在这一句，等"继续"', () => {
    const sp = freshSpeaker()
    sp.play({ id: 'a', label: '甲', text: '一。二。' })
    spoken[0].onerror?.({ error: 'synthesis-failed' })
    expect(sp.state.index).toBe(1)
    spoken[1].onerror?.({ error: 'interrupted' })
    expect(sp.state.current?.id).toBe('a')
    expect(sp.state.paused).toBe(true)
    sp.resume()
    expect(spoken[spoken.length - 1].text).toBe('二。')
  })

  test('浏览器一直不报"念完了"：到点自动接着念下一句，不会卡住', () => {
    jest.useFakeTimers()
    try {
      const sp = freshSpeaker()
      sp.play({ id: 'a', label: '甲', text: '一。二。' })
      jest.advanceTimersByTime(8_000)
      expect(sp.state.index).toBe(1)
      expect(spoken.map(u => u.text)).toEqual(['一。', '二。'])
      jest.advanceTimersByTime(30_000)
      expect(sp.state.current).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})
