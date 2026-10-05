// =====================
// 剧本杀 - 朗读（读给我听）
// 用浏览器自带的语音合成（Web Speech API）：不联网、不花钱、声音只在自己的设备上播放，对方听不到。
// 长文本按句子切开一句一句念：既能显示"正在读哪一句"，也避开了部分浏览器念长句会中途停下的问题。
// =====================

export type ReadItem = { id: string; label: string; text: string }

export type SpeechSnapshot = {
  supported: boolean
  /** 正在读的那一段（null = 没在读） */
  current: { id: string; label: string } | null
  sentences: string[]
  index: number
  paused: boolean
  /** 排队等着自动朗读的段数 */
  queued: number
  rate: number
  auto: boolean
  voiceName: string | null
}

export const RATES = [
  { value: 0.75, label: '慢' },
  { value: 0.95, label: '正常' },
  { value: 1.2, label: '快' },
] as const

const SETTINGS_KEY = 'mystery:speech'

// ───────── 文本处理（纯函数，可单测）─────────

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu

/** 把界面文字整理成适合念出来的样子 */
export function toSpeechText(raw: string): string {
  let t = raw
    .replace(/\*\*/g, '')
    .replace(/^##\s+/gm, '')
    .replace(EMOJI, '')
    // 美式日期：11/7/00、04/12/1990 → 年月日
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g, (_, m, d, y) => `${y}年${+m}月${+d}日`)
    // 两位数的月/日：11/07 → 11月7日（"2/3" 这类分数不动）
    .replace(/\b(\d{2})\/(\d{2})\b/g, (_, m, d) => (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31 ? `${+m}月${+d}日` : `${m}/${d}`))
    // 时长：0:41 → 41秒
    .replace(/\b0:(\d{2})\b/g, (_, s) => `${+s}秒`)
    // 钟点：02:40、23:30:12 → 2点40分、23点30分12秒
    .replace(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g, (_, h, m, s) => {
      const min = +m === 0 ? '整' : `${+m < 10 ? '零' : ''}${+m}分`
      const sec = s ? `${+s}秒` : ''
      return `${+h}点${min}${sec}`
    })
    // $3,000 → 3000美元
    .replace(/\$\s?([\d,]+)/g, (_, n) => `${n.replace(/,/g, '')}美元`)
    .replace(/[【】]/g, ' ')
    .replace(/→/g, '，')
    // 人名中间的点（吉迪恩·万斯）不停顿；两边有空格的点是分隔符，停一下
    .replace(/\s+[·•]\s+/g, '，')
    .replace(/•/g, '，')
    .replace(/·/g, '')
    .replace(/[ \t]+/g, ' ')
  t = t.split('\n').map(l => l.trim()).filter(Boolean).join('\n')
  return t.trim()
}

/** 按句切开：句号、问号、叹号、分号、换行；太长的句子再按逗号切，太短的并到下一句 */
export function splitSentences(text: string, max = 40): string[] {
  const parts: string[] = []
  for (const line of text.split('\n')) {
    // 直引号分不清前后，不当作句尾；只有纯标点的碎片才并到前一句
    const pieces = line.match(/[^。！？!?；;]+[。！？!?；;]*[”』」）)]*|[。！？!?；;]+/g) ?? []
    for (let p of pieces) {
      p = p.trim()
      if (!p) continue
      if (p.length <= max) { parts.push(p); continue }
      let buf = ''
      // 不用后行断言（旧版 Safari 不支持，会让整个页面打不开）
      for (const c of p.match(/[^，,、：:]+[，,、：:]*|[，,、：:]+/g) ?? [p]) {
        if (buf && (buf + c).length > max) { parts.push(buf); buf = '' }
        buf += c
      }
      if (buf) parts.push(buf)
    }
  }
  // 只剩标点的碎片（比如句末的引号），并到前一句
  const out: string[] = []
  for (const p of parts) {
    if (out.length && p.replace(/[\s\p{P}]/gu, '').length === 0) out[out.length - 1] += p
    else out.push(p)
  }
  return out.filter(s => s.replace(/[\s\p{P}]/gu, '').length > 0)
}

/** 挑一个普通话声音：优先中国大陆的、自然/神经网络音色 */
export function pickVoice(voices: { name: string; lang: string; localService?: boolean }[]) {
  let best: (typeof voices)[number] | null = null
  let bestScore = -1
  for (const v of voices) {
    const lang = v.lang.replace('_', '-').toLowerCase()
    const name = v.name
    let score = -1
    if (lang === 'zh-cn' || lang === 'cmn-cn' || lang === 'zh-hans-cn' || lang === 'cmn-hans-cn') score = 10
    else if (lang === 'zh' || lang.startsWith('zh-hans') || lang === 'cmn') score = 8
    else if (lang === 'zh-tw' || lang.startsWith('zh-hant')) score = 5
    else if (lang === 'zh-hk' || lang.startsWith('yue')) score = 1
    else if (/普通话|中文|Chinese|Mandarin/i.test(name)) score = 6
    if (score < 0) continue
    if (/Natural|Neural|Premium|Enhanced|增强|高品质/i.test(name)) score += 5
    if (/Xiaoxiao|Xiaoyi|Yunxi|Yunjian|Tingting|Lili|Yu-shu|Huihui|Kangkang|Yaoyao/i.test(name)) score += 2
    // 本机声音更稳；Chrome 的 Google 在线声音念到十几秒会自己停住
    if (v.localService) score += 2
    if (/Google/i.test(name)) score -= 3
    if (score > bestScore) { best = v; bestScore = score }
  }
  return best
}

// ───────── 播放器（只在浏览器里工作）─────────

type Synth = {
  speak(u: unknown): void
  cancel(): void
  getVoices(): { name: string; lang: string; localService?: boolean }[]
  addEventListener?(type: string, fn: () => void): void
  speaking?: boolean
}

class Speaker {
  private listeners = new Set<() => void>()
  private snap: SpeechSnapshot
  private queue: ReadItem[] = []
  /** 每次开始 / 停止都换一个令牌：旧句子的 onend 迟到时不会接着往下念 */
  private token = 0
  /** 当前这句的保险计时器 */
  private guard: ReturnType<typeof setTimeout> | null = null
  private voice: unknown = null

  constructor() {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance === 'function'
    let rate: number = RATES[1].value
    let auto = false
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null') as { rate?: number; auto?: boolean } | null
        if (saved && typeof saved.rate === 'number' && saved.rate >= 0.5 && saved.rate <= 2) rate = saved.rate
        if (saved && typeof saved.auto === 'boolean') auto = saved.auto
      } catch { /* 隐私模式等拿不到存储：用默认值 */ }
    }
    this.snap = { supported, current: null, sentences: [], index: 0, paused: false, queued: 0, rate, auto: supported && auto, voiceName: null }
    if (supported) {
      const synth = this.synth()!
      const load = () => {
        const v = pickVoice(synth.getVoices())
        this.voice = v
        this.set({ voiceName: v ? v.name : null })
      }
      load()
      synth.addEventListener?.('voiceschanged', load)
    }
  }

  private synth(): Synth | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? (window.speechSynthesis as unknown as Synth) : null
  }

  get state() { return this.snap }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private set(patch: Partial<SpeechSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const fn of this.listeners) fn()
  }

  private save() {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rate: this.snap.rate, auto: this.snap.auto })) } catch { /* 忽略 */ }
  }

  /** 点按钮朗读：打断正在读的，清空排队 */
  play(item: ReadItem) {
    this.queue = []
    this.start(item)
  }

  /** 自动朗读：正在读别的就排队，读完再念 */
  enqueue(item: ReadItem) {
    if (!this.snap.supported) return
    if (this.snap.current?.id === item.id || this.queue.some(q => q.id === item.id)) return
    if (!this.snap.current) this.start(item)
    else {
      this.queue.push(item)
      this.set({ queued: this.queue.length })
    }
  }

  private start(item: ReadItem) {
    if (!this.snap.supported) return
    const sentences = splitSentences(toSpeechText(item.text))
    this.synth()?.cancel()
    if (sentences.length === 0) { this.next(); return }
    this.set({ current: { id: item.id, label: item.label }, sentences, index: 0, paused: false, queued: this.queue.length })
    this.say(0)
  }

  private say(index: number) {
    const synth = this.synth()
    if (!synth) return
    const token = ++this.token
    const Utter = (window as unknown as { SpeechSynthesisUtterance: new (t: string) => Record<string, unknown> }).SpeechSynthesisUtterance
    const u = new Utter(this.snap.sentences[index])
    u.lang = 'zh-CN'
    u.rate = this.snap.rate
    // 个别浏览器给的声音对象不合规：设不上就用默认的中文声音，不能因此卡住
    try { if (this.voice) u.voice = this.voice } catch { this.voice = null }
    // 保险：有的浏览器念完一句不报"念完了"（比如 Chrome 的在线声音念到十几秒会卡住），到点就接着念下一句
    const text = this.snap.sentences[index]
    this.clearGuard()
    const guard = this.guard = setTimeout(() => {
      if (token !== this.token || this.snap.paused) return
      this.synth()?.cancel()
      done()
    }, 6000 + (text.length * 400) / this.snap.rate)
    const done = () => {
      clearTimeout(guard)
      if (token !== this.token || this.snap.paused) return
      this.token++
      if (index + 1 < this.snap.sentences.length) {
        this.set({ index: index + 1 })
        this.say(index + 1)
      } else {
        this.next()
      }
    }
    u.onend = done
    u.onerror = (e: unknown) => {
      const err = (e as { error?: string })?.error
      if (err === 'interrupted' || err === 'canceled') {
        clearTimeout(guard)
        // 我们自己打断时都会先换令牌；令牌没变说明是别的程序抢走了声音：停在这一句，点"继续"接着念
        if (token === this.token && !this.snap.paused) {
          this.token++
          this.set({ paused: true })
        }
        return
      }
      // 其他错误也接着往下念，不要卡住
      done()
    }
    this.set({ index })
    try {
      synth.speak(u)
    } catch {
      // 浏览器拒绝发声（例如还没点过页面）：停下来，别让朗读条一直挂着
      this.stop()
    }
  }

  private next() {
    const nxt = this.queue.shift()
    if (nxt) { this.start(nxt); return }
    this.token++
    this.clearGuard()
    this.set({ current: null, sentences: [], index: 0, paused: false, queued: 0 })
  }

  private clearGuard() {
    if (this.guard) clearTimeout(this.guard)
    this.guard = null
  }

  stop() {
    this.queue = []
    this.token++
    this.clearGuard()
    this.synth()?.cancel()
    this.set({ current: null, sentences: [], index: 0, paused: false, queued: 0 })
  }

  /** 暂停：有些手机浏览器的 pause() 不可靠，这里直接停在当前句，继续时从这一句重新念 */
  pause() {
    if (!this.snap.current) return
    this.token++
    this.clearGuard()
    this.synth()?.cancel()
    this.set({ paused: true })
  }

  resume() {
    if (!this.snap.current) return
    this.set({ paused: false })
    this.say(this.snap.index)
  }

  /** 上一句 / 下一句 */
  jump(delta: number) {
    if (!this.snap.current) return
    const i = Math.max(0, Math.min(this.snap.sentences.length - 1, this.snap.index + delta))
    this.synth()?.cancel()
    this.set({ paused: false, index: i })
    this.say(i)
  }

  setRate(rate: number) {
    this.set({ rate })
    this.save()
    // 正在读：从当前句用新语速重念
    if (this.snap.current && !this.snap.paused) {
      this.synth()?.cancel()
      this.say(this.snap.index)
    }
  }

  setAuto(auto: boolean) {
    this.set({ auto: auto && this.snap.supported })
    this.save()
    // 打开时念一句：手机浏览器要求第一次发声必须来自点击，这句同时"解锁"后面的自动朗读
    if (auto) this.play({ id: 'speech:hello', label: '自动朗读', text: '好的，新的内容出现时，我会自动读给你听。' })
    else this.stop()
  }
}

let speaker: Speaker | null = null

/** 全局唯一的播放器（服务器端渲染时返回 null） */
export function getSpeaker(): Speaker | null {
  if (typeof window === 'undefined') return null
  if (!speaker) speaker = new Speaker()
  return speaker
}

export type { Speaker }
