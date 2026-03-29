// =====================
// 语音合成 — 沉稳女声风格
// =====================
// 偏低音调、偏慢语速，优先选自然感强的女声

// 优先列表：自然感强、音色较低的中文女声
const PREFERRED_FEMALE_VOICES = [
  'Microsoft Xiaoxiao',  // Windows/Edge 晓晓：情感最丰富
  '微软 晓晓',
  'Microsoft Yunxi',     // 云希：稍低沉
  '微软 云希',
  'Tingting',            // macOS 普通话
  'Google 普通话（中国大陆）',
  'Meijia',
  'Sinji',
]

let cachedVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  for (const name of PREFERRED_FEMALE_VOICES) {
    const v = voices.find(v => v.name.includes(name))
    if (v) return v
  }

  const zhVoice = voices.find(v => v.lang.startsWith('zh'))
  if (zhVoice) return zhVoice

  return null
}

function getVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  cachedVoice = pickVoice()
  return cachedVoice
}

export function speak(text: string, rate = 0.88) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const doSpeak = () => {
      try {
        window.speechSynthesis.cancel()
        const utt = new SpeechSynthesisUtterance(text)
        utt.lang = 'zh-CN'
        utt.rate = rate    // 0.88 — 偏慢，从容不迫
        utt.pitch = 0.82   // 偏低，沉稳有力
        utt.volume = 1.0
        const voice = getVoice()
        if (voice) utt.voice = voice
        utt.onerror = () => {} // 静默处理语音错误
        window.speechSynthesis.speak(utt)
      } catch { /* 语音合成失败不阻塞游戏 */ }
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoice = null
        doSpeak()
      }
    } else {
      doSpeak()
    }
  } catch { /* 静默处理 */ }
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return
  window.speechSynthesis.cancel()
}

export function isSpeakingNow(): boolean {
  if (typeof window === 'undefined') return false
  return window.speechSynthesis.speaking
}
