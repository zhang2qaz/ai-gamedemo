'use client'

import { ALL_THEMES } from '@/engine/themes'

type Props = {
  onSelect: (themeId: string) => void
}

const ACCENT_STYLES: Record<string, {
  border: string; bg: string; hoverBg: string; ring: string; title: string; icon: string
}> = {
  amber:   { border: 'border-amber-700',   bg: 'bg-amber-950/20',   hoverBg: 'hover:bg-amber-950/40',   ring: 'ring-amber-500/30',   title: 'text-amber-400',   icon: 'bg-amber-900/50' },
  sky:     { border: 'border-sky-700',     bg: 'bg-sky-950/20',     hoverBg: 'hover:bg-sky-950/40',     ring: 'ring-sky-500/30',     title: 'text-sky-400',     icon: 'bg-sky-900/50' },
  emerald: { border: 'border-emerald-700', bg: 'bg-emerald-950/20', hoverBg: 'hover:bg-emerald-950/40', ring: 'ring-emerald-500/30', title: 'text-emerald-400', icon: 'bg-emerald-900/50' },
  purple:  { border: 'border-purple-700',  bg: 'bg-purple-950/20',  hoverBg: 'hover:bg-purple-950/40',  ring: 'ring-purple-500/30',  title: 'text-purple-400',  icon: 'bg-purple-900/50' },
}

export default function ThemeSelect({ onSelect }: Props) {
  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center px-4 py-12">
      {/* 标题 */}
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-amber-400 font-black text-4xl tracking-wider">弈 战</h1>
        <p className="text-stone-500 text-sm">四人决策训练 · 选择你的战场</p>
        <div className="w-16 h-px bg-stone-700 mx-auto" />
      </div>

      {/* 主题卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        {ALL_THEMES.map(theme => {
          const s = ACCENT_STYLES[theme.accentClass] ?? ACCENT_STYLES.amber
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme.id)}
              className={`border-2 rounded-xl p-5 text-left transition-all cursor-pointer
                ${s.border} ${s.bg} ${s.hoverBg}
                hover:ring-2 ${s.ring} hover:scale-[1.02] active:scale-[0.98]`}
            >
              {/* 图标 + 标题 */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl ${s.icon} flex items-center justify-center text-2xl`}>
                  {theme.icon}
                </div>
                <div>
                  <div className={`font-black text-lg ${s.title}`}>{theme.title}</div>
                  <div className="text-stone-500 text-xs">{theme.subtitle}</div>
                </div>
              </div>

              {/* 描述 */}
              <p className="text-stone-400 text-sm leading-relaxed mb-3">
                {theme.description}
              </p>

              {/* 四家公司 */}
              <div className="flex gap-2 flex-wrap">
                {theme.companies.map(c => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 border border-stone-700/50">
                    {c.name}
                  </span>
                ))}
              </div>

              {/* 底部提示 */}
              <div className={`mt-3 text-xs font-bold ${s.title} opacity-60`}>
                点击开始 →
              </div>
            </button>
          )
        })}
      </div>

      {/* 底部说明 */}
      <div className="mt-8 text-center text-stone-700 text-xs space-y-1">
        <p>所有主题共享同一套平衡引擎 · 10000局蒙特卡洛验证</p>
        <p>4位玩家轮流选牌 · 5回合 · 情报真假混杂 · 最高累计利润者胜</p>
      </div>
    </div>
  )
}
