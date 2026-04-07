'use client'

import { useState, useEffect } from 'react'

const TUTORIAL_KEY = 'yizhan_tutorial_seen'

const STEPS = [
  {
    emoji: '🎯',
    title: '游戏目标',
    desc: '5回合内赚取最高累计利润的玩家获胜。每回合同时选择动作，亮牌结算。',
  },
  {
    emoji: '⚔',
    title: '四种动作',
    desc: '促销(ATK)抢份额但利润低，独家促销获客+20% · 研发(QUA)投入品质终盘爆发 · 推广(MKT)建立品牌动量 · 守势(HOLD)利润率逐回合增加，份额损失缓冲',
  },
  {
    emoji: '📡',
    title: '情报交易',
    desc: '每回合开始有60秒社交时间。你的情报有真有假——可以分享、交换、或故意误导对手。',
  },
  {
    emoji: '🃏',
    title: '暗牌',
    desc: '每人开局获得一张特殊能力暗牌，整局只能用一次。在选牌时可以选择是否激活。',
  },
  {
    emoji: '💡',
    title: '关键策略',
    desc: '同一动作选的人越多效果越差（促销内卷）。连续使用同一动作有冷却惩罚。后期回合赌注略高。观察对手模式，适时切换策略。',
  },
]

export default function TutorialOverlay({ forceShow, onClose }: { forceShow?: boolean; onClose?: () => void } = {}) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (forceShow) {
      setVisible(true)
      setStep(0)
      return
    }
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem(TUTORIAL_KEY)
    if (!seen) {
      setVisible(true)
    }
  }, [forceShow])

  function handleDismiss() {
    setVisible(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(TUTORIAL_KEY, '1')
    }
    onClose?.()
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-stone-950 border border-amber-700/50 rounded-2xl overflow-hidden animate-slide-in-scale">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-amber-400 scale-125' : i < step ? 'bg-amber-700' : 'bg-stone-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-4">
          <div className="text-5xl">{current.emoji}</div>
          <div className="text-amber-400 font-black text-xl">{current.title}</div>
          <p className="text-stone-300 text-sm leading-relaxed">
            {current.desc}
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 text-stone-600 hover:text-stone-400 text-sm transition-all cursor-pointer"
          >
            跳过教程
          </button>
          {isLast ? (
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-sm transition-all cursor-pointer"
            >
              开始游戏!
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-sm border border-stone-700 transition-all cursor-pointer"
            >
              下一步 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
