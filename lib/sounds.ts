// =====================
// 弈战 - 音效系统（Web Audio API）
// =====================
// 零依赖，纯合成音效，无需加载音频文件

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// 是否静音（持久化到 localStorage）
let muted = typeof window !== 'undefined' && localStorage.getItem('yizhan_muted') === '1'
export function toggleMute() {
  muted = !muted
  try { localStorage.setItem('yizhan_muted', muted ? '1' : '0') } catch {}
  return muted
}
export function isMuted() { return muted }

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (muted) return
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Silently fail if audio not supported
  }
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', volume = 0.08) {
  freqs.forEach(f => playTone(f, duration, type, volume))
}

// ── 游戏音效 ──

/** 选择动作时 */
export function sfxSelect() {
  playTone(880, 0.1, 'sine', 0.12)
}

/** 锁定动作 */
export function sfxLock() {
  playTone(523, 0.08, 'square', 0.08)
  setTimeout(() => playTone(659, 0.08, 'square', 0.08), 60)
  setTimeout(() => playTone(784, 0.12, 'square', 0.08), 120)
}

/** 亮牌（提交回合）- 鼓点 */
export function sfxReveal() {
  playTone(200, 0.15, 'sawtooth', 0.15)
  setTimeout(() => playTone(150, 0.2, 'sawtooth', 0.2), 100)
  setTimeout(() => playTone(300, 0.3, 'triangle', 0.1), 250)
}

/** 翻开单张卡片 */
export function sfxFlipCard() {
  playTone(600 + Math.random() * 200, 0.08, 'sine', 0.1)
}

/** 冲突（多人同选ATK/MKT） */
export function sfxClash() {
  playTone(220, 0.3, 'sawtooth', 0.12)
  setTimeout(() => playTone(185, 0.3, 'sawtooth', 0.12), 150)
}

/** 回合结算完成 */
export function sfxRoundEnd() {
  playChord([523, 659, 784], 0.4, 'sine', 0.08)
}

/** 倒计时警告（最后5秒） */
export function sfxTick() {
  playTone(1000, 0.05, 'square', 0.08)
}

/** 倒计时结束 */
export function sfxTimeout() {
  playTone(440, 0.15, 'sawtooth', 0.1)
  setTimeout(() => playTone(330, 0.2, 'sawtooth', 0.1), 120)
}

/** 使用暗牌 */
export function sfxWildCard() {
  playTone(392, 0.1, 'triangle', 0.12)
  setTimeout(() => playTone(523, 0.1, 'triangle', 0.12), 100)
  setTimeout(() => playTone(784, 0.15, 'triangle', 0.12), 200)
  setTimeout(() => playTone(1047, 0.2, 'triangle', 0.1), 320)
}

/** 游戏胜利 */
export function sfxVictory() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sine', 0.1), i * 150)
  })
  setTimeout(() => playChord([523, 659, 784, 1047], 0.8, 'sine', 0.06), 600)
}

/** 情报交易阶段开始 */
export function sfxIntelPhase() {
  playTone(440, 0.2, 'triangle', 0.08)
  setTimeout(() => playTone(554, 0.2, 'triangle', 0.08), 200)
}

/** 份额上升 */
export function sfxShareUp() {
  playTone(523, 0.1, 'sine', 0.06)
  setTimeout(() => playTone(659, 0.12, 'sine', 0.06), 80)
}

/** 份额下降 */
export function sfxShareDown() {
  playTone(440, 0.1, 'sine', 0.06)
  setTimeout(() => playTone(349, 0.12, 'sine', 0.06), 80)
}
