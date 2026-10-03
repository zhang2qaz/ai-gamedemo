'use client'

import { useMemo, useState } from 'react'
import { useMysteryStore } from '@/store/mysteryStore'
import type { ClueView, SeatView } from '@/engine/mystery/types'
import { Money, RichText } from './ui'

const KIND_LABEL: Record<ClueView['kind'], string> = {
  document: '文件',
  digital: '电子数据',
  physical: '物证',
  testimony: '证词',
  media: '新闻/社媒',
  item: '道具',
}

// ───────────── 剧本 ─────────────

export function ScriptPanel({ view }: { view: SeatView }) {
  const chapters = view.me.chapters
  const latest = chapters[chapters.length - 1]?.id
  const [open, setOpen] = useState<string | null>(null)
  const current = open ?? latest
  const role = view.roles.find(r => r.id === view.me.roleId)

  if (chapters.length === 0) {
    return <div className="text-center text-[var(--mx-muted)] py-10 text-sm">剧本将在开场后发放。</div>
  }
  return (
    <div className="space-y-3">
      {role && (
        <div className="flex items-center gap-3 mx-panel-2 p-3">
          <div className="text-4xl">{role.avatar}</div>
          <div>
            <div className="font-black text-white text-lg" style={{ color: role.color }}>{role.name}</div>
            <div className="text-[11px] text-[var(--mx-muted)]">{role.enName} · {role.title}</div>
          </div>
        </div>
      )}
      {view.me.goals.length > 0 && (
        <div className="mx-panel-2 p-3">
          <div className="text-xs font-black text-[var(--mx-gold)] mb-1.5">你的私人目标</div>
          <ul className="space-y-1">
            {view.me.goals.map(g => (
              <li key={g.id} className="text-[13px] text-white/85 flex gap-2">
                <span className="text-[var(--mx-gold)] font-mono shrink-0">+{g.points}</span>
                <span>{g.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {chapters.map(ch => (
        <div key={ch.id} className="mx-paper overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setOpen(current === ch.id ? '' : ch.id)}
          >
            <span className="mx-serif font-black text-[15px]">{ch.title}</span>
            <span className="flex items-center gap-2">
              {ch.isNew && <span className="mx-stamp text-[10px] text-red-700">NEW</span>}
              <span className="text-xs opacity-60">{current === ch.id ? '收起' : '展开'}</span>
            </span>
          </button>
          {current === ch.id && (
            <div className="px-4 pb-5 mx-serif text-[15px]">
              <RichText text={ch.text} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ───────────── 线索卡 ─────────────

export function ClueCard({ clue, actions = true }: { clue: ClueView; actions?: boolean }) {
  const act = useMysteryStore(s => s.act)
  const [confirm, setConfirm] = useState<'publish' | 'give' | null>(null)
  return (
    <div className="mx-paper p-4 mx-in">
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{clue.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mx-serif font-black text-[15px]">{clue.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10">{KIND_LABEL[clue.kind]}</span>
            {clue.public && <span className="mx-stamp text-[10px] text-blue-800">已公开</span>}
            {!clue.public && clue.holder === 'me' && <span className="mx-stamp text-[10px] text-red-700">仅你可见</span>}
            {clue.holder === 'other' && <span className="text-[10px] opacity-70">在对方手中</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 mx-serif text-[14px] leading-7 whitespace-pre-wrap">{clue.text}</div>
      {actions && clue.holder === 'me' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!clue.public && (
            confirm === 'publish'
              ? <>
                  <button className="mx-btn mx-btn-blue !py-1.5 text-xs" onClick={() => { act({ type: 'publish', clueId: clue.id }); setConfirm(null) }}>确认公开给对方</button>
                  <button className="mx-btn mx-btn-ghost !py-1.5 text-xs !text-[var(--mx-paper-ink)] !bg-black/5" onClick={() => setConfirm(null)}>取消</button>
                </>
              : <button className="mx-btn mx-btn-blue !py-1.5 text-xs" onClick={() => setConfirm('publish')}>公开</button>
          )}
          {confirm === 'give'
            ? <>
                <button className="mx-btn mx-btn-red !py-1.5 text-xs" onClick={() => { act({ type: 'give', clueId: clue.id }); setConfirm(null) }}>确认交给对方</button>
                <button className="mx-btn mx-btn-ghost !py-1.5 text-xs !text-[var(--mx-paper-ink)] !bg-black/5" onClick={() => setConfirm(null)}>取消</button>
              </>
            : confirm === null && <button className="mx-btn mx-btn-ghost !py-1.5 text-xs !text-[var(--mx-paper-ink)] !bg-black/5" onClick={() => setConfirm('give')}>交给对方</button>}
        </div>
      )}
    </div>
  )
}

export function CluePanel({ view }: { view: SeatView }) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'public' | 'other'>('all')
  const list = useMemo(() => view.clues.filter(c =>
    filter === 'all' ? true
      : filter === 'mine' ? c.holder === 'me' && !c.public
        : filter === 'public' ? c.public
          : c.holder === 'other' && !c.public,
  ), [view.clues, filter])

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {([['all', '全部'], ['mine', '仅我可见'], ['public', '已公开'], ['other', '已交给对方']] as const).map(([k, l]) => (
          <button key={k} className="mx-tab" data-active={filter === k} onClick={() => setFilter(k)}>
            {l} {k === 'all' ? `(${view.clues.length})` : ''}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="text-center text-[var(--mx-muted)] py-10 text-sm">这里还没有线索。</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {list.map(c => <ClueCard key={c.id} clue={c} />)}
      </div>
    </div>
  )
}

// ───────────── 搜证 / 问询 ─────────────

export function SearchPanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const [tab, setTab] = useState<'places' | 'people'>('places')
  const [npcOpen, setNpcOpen] = useState<string | null>(null)
  const inSearch = view.step.kind === 'search'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="mx-tab" data-active={tab === 'places'} onClick={() => setTab('places')}>🔎 搜查地点</button>
        <button className="mx-tab" data-active={tab === 'people'} onClick={() => setTab('people')}>🗣️ 问询人物</button>
        <span className="ml-auto text-sm">
          行动点 <b className="text-[var(--mx-gold)] text-lg font-mono">{view.me.ap}</b>
        </span>
      </div>
      {!inSearch && <div className="text-xs text-[var(--mx-muted)]">当前不是搜证阶段，只能查看已获得的信息。</div>}

      {tab === 'places' && (
        <div className="grid md:grid-cols-2 gap-3">
          {view.locations.map(loc => {
            const spots = view.spots.filter(s => s.location === loc.id)
            return (
              <div key={loc.id} className="mx-panel-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{loc.icon}</span>
                  <div>
                    <div className="font-black text-white">{loc.name}</div>
                    <div className="text-[11px] text-[var(--mx-muted)] leading-4">{loc.desc}</div>
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  {spots.length === 0 && <div className="text-[11px] text-[var(--mx-muted)]">暂时没有可搜查之处</div>}
                  {spots.map(s => (
                    <div key={s.clueId} className="flex items-center gap-2 text-[13px]">
                      <span className={`flex-1 ${s.status === 'open' ? 'text-white/90' : 'text-white/40 line-through'}`}>
                        {s.exclusive && <span className="text-[var(--mx-gold)] mr-1" title="只有你的角色能查到">★</span>}
                        {s.spot}
                      </span>
                      {s.status === 'open' ? (
                        <button
                          className="mx-btn mx-btn-gold !py-1 !px-2.5 text-xs"
                          disabled={!inSearch || view.me.ap < s.cost}
                          onClick={() => act({ type: 'search', clueId: s.clueId })}
                        >
                          搜 · {s.cost}AP
                        </button>
                      ) : (
                        <span className="text-[11px] text-[var(--mx-muted)]">{s.status === 'mine' ? '已获得' : '已被搜走'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {view.locations.length === 0 && <div className="text-sm text-[var(--mx-muted)]">现在没有可以搜查的地点。</div>}
        </div>
      )}

      {tab === 'people' && (
        <div className="space-y-2">
          {view.npcs.map(n => {
            const open = npcOpen === n.id
            const pending = n.questions.filter(q => !q.asked).length
            return (
              <div key={n.id} className="mx-panel-2 overflow-hidden">
                <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setNpcOpen(open ? null : n.id)}>
                  <span className="text-3xl">{n.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-white">{n.name}</div>
                    <div className="text-[11px] text-[var(--mx-muted)] truncate">{n.title}</div>
                  </div>
                  {pending > 0 && inSearch && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--mx-red-soft)] text-red-200">{pending} 个可问</span>}
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-[12px] text-white/60 leading-5">{n.profile}</p>
                    {n.questions.length === 0 && <div className="text-[12px] text-[var(--mx-muted)]">暂时没有可以问的。找到相关证据后再来。</div>}
                    {n.questions.map(q => (
                      <div key={q.id} className="rounded-lg bg-black/25 p-2.5">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 text-[13px] text-white/90">
                            {q.present && <span className="text-[11px] text-[var(--mx-gold)] mr-1">[出示：{q.present.title}]</span>}
                            {q.ask}
                          </div>
                          {!q.asked && (
                            <button
                              className="mx-btn mx-btn-blue !py-1 !px-2.5 text-xs shrink-0"
                              disabled={!inSearch || view.me.ap < q.cost}
                              onClick={() => act({ type: 'ask', npcId: n.id, questionId: q.id })}
                            >
                              问 · {q.cost}AP
                            </button>
                          )}
                        </div>
                        {q.answer && <div className="mt-2 text-[13px] text-sky-100 mx-serif leading-6 border-l-2 border-sky-400/50 pl-2 whitespace-pre-wrap">{q.answer}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ───────────── 案卷（酬金）─────────────

export function CasePanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({})

  if (view.caseFiles.length === 0) return <div className="text-center text-[var(--mx-muted)] py-10 text-sm">暂无可递交的案卷。</div>
  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--mx-muted)] leading-5">
        私下向 DM 递交推理：全部答对即可领取酬金（对方只会知道你拿到了钱，不知道你答了什么）。答错会被扣钱，且提交次数有限。
      </div>
      {view.caseFiles.map(cf => {
        const a = answers[cf.id] ?? {}
        const complete = cf.questions.every(q => a[q.id])
        return (
          <div key={cf.id} className="mx-panel-2 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="font-black text-white flex-1">{cf.title}</div>
              <span className="text-xs">酬金 <Money value={cf.reward} /></span>
            </div>
            <div className="text-[12px] text-white/60">{cf.desc}</div>
            {cf.solved ? (
              <div className="text-emerald-300 text-sm font-bold">✅ 已破解，酬金已领取</div>
            ) : (
              <>
                {cf.questions.map(q => (
                  <label key={q.id} className="block">
                    <span className="text-[12px] text-white/80">{q.prompt}</span>
                    <select
                      className="mx-input !py-2 mt-1 text-sm"
                      value={a[q.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [cf.id]: { ...a, [q.id]: e.target.value } }))}
                    >
                      <option value="">— 请选择 —</option>
                      {q.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-[var(--mx-muted)] flex-1">
                    剩余 {cf.attemptsLeft} 次 · 答错扣 <Money value={cf.penalty} />
                    {cf.lastWrong !== null && <span className="text-red-300 ml-1">（上次：{cf.lastWrong === 1 ? '只差一处' : '不止一处有误'}）</span>}
                  </span>
                  <button
                    className="mx-btn mx-btn-gold !py-1.5 text-xs"
                    disabled={!cf.open || !complete || cf.attemptsLeft <= 0}
                    onClick={() => act({ type: 'caseFile', caseId: cf.id, answers: a })}
                  >
                    {cf.open ? '递交给 DM' : '未开放'}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ───────────── 秘密抉择 ─────────────

export function ChoicePanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const [pick, setPick] = useState<string | null>(null)
  const c = view.me.choice
  if (!c) return <div className="text-center text-[var(--mx-muted)] py-10 text-sm">此阶段你无需抉择，等待对方……</div>
  return (
    <div className="space-y-3">
      <div className="mx-paper p-4 mx-serif text-[15px] leading-7 whitespace-pre-wrap">{c.prompt}</div>
      <div className="grid gap-2">
        {c.options.map(o => {
          const chosen = c.chosen === o.id
          return (
            <button
              key={o.id}
              disabled={!!c.chosen || o.disabled}
              onClick={() => setPick(o.id)}
              className={`mx-panel-2 p-3 text-left transition-all ${chosen || pick === o.id ? 'ring-2 ring-[var(--mx-gold)]' : ''} ${o.disabled ? 'opacity-40' : 'hover:bg-white/5'}`}
            >
              <div className="font-bold text-white">{o.label}</div>
              {o.desc && <div className="text-[12px] text-white/60 mt-0.5">{o.desc}</div>}
            </button>
          )
        })}
      </div>
      {c.chosen ? (
        <div className="text-center text-emerald-300 text-sm">已锁定选择，等待对方……</div>
      ) : (
        <button className="mx-btn mx-btn-red w-full" disabled={!pick} onClick={() => pick && act({ type: 'choose', optionId: pick })}>
          锁定选择（不可更改）
        </button>
      )}
    </div>
  )
}

// ───────────── 最终指认 ─────────────

export function AccusePanel({ view }: { view: SeatView }) {
  const act = useMysteryStore(s => s.act)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [confirm, setConfirm] = useState(false)
  const submitted = view.me.accuse

  if (submitted) {
    return <div className="text-center text-emerald-300 py-10 text-sm">你的指认已提交，等待对方……</div>
  }
  const complete = view.accuse.every(q => {
    const v = answers[q.id]
    return q.multi ? Array.isArray(v) && v.length > 0 : !!v
  })
  return (
    <div className="space-y-3">
      <div className="text-xs text-[var(--mx-muted)] leading-5">
        各自独立作答，提交后不可修改。结局与得分由你们的答案共同决定。
      </div>
      {view.accuse.map((q, i) => (
        <div key={q.id} className="mx-panel-2 p-3">
          <div className="text-[13px] font-bold text-white mb-2">{i + 1}. {q.prompt}{q.multi && <span className="text-[11px] text-[var(--mx-gold)] ml-1">（可多选）</span>}</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {q.options.map(o => {
              const v = answers[q.id]
              const on = q.multi ? Array.isArray(v) && v.includes(o.id) : v === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => setAnswers(prev => {
                    if (!q.multi) return { ...prev, [q.id]: o.id }
                    const cur = Array.isArray(prev[q.id]) ? prev[q.id] as string[] : []
                    return { ...prev, [q.id]: cur.includes(o.id) ? cur.filter(x => x !== o.id) : [...cur, o.id] }
                  })}
                  className={`text-left text-[13px] rounded-lg px-3 py-2 border transition-all ${on ? 'bg-[var(--mx-red-soft)] border-[var(--mx-red)] text-white' : 'bg-black/20 border-white/10 text-white/80 hover:bg-white/5'}`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="mx-btn mx-btn-ghost" onClick={() => setConfirm(false)}>再想想</button>
          <button className="mx-btn mx-btn-red" onClick={() => act({ type: 'accuse', answers })}>确认提交</button>
        </div>
      ) : (
        <button className="mx-btn mx-btn-red w-full" disabled={!complete} onClick={() => setConfirm(true)}>提交最终指认</button>
      )}
    </div>
  )
}

// ───────────── 结局与复盘 ─────────────

export function ResultPanel({ view }: { view: SeatView }) {
  const r = view.result
  const [tab, setTab] = useState<'ending' | 'truth' | 'score'>('ending')
  if (!r) return null
  return (
    <div className="space-y-3">
      <div className="mx-chyron">
        <span className="mx-chyron-tag">FINAL</span>
        <span className="px-3 py-1.5 text-sm font-bold text-white">{r.headline}</span>
      </div>
      <div className="flex gap-1.5">
        <button className="mx-tab" data-active={tab === 'ending'} onClick={() => setTab('ending')}>结局</button>
        <button className="mx-tab" data-active={tab === 'truth'} onClick={() => setTab('truth')}>真相复盘</button>
        <button className="mx-tab" data-active={tab === 'score'} onClick={() => setTab('score')}>得分</button>
      </div>
      {tab === 'ending' && (
        <div className="space-y-3">
          {r.endings.map(e => (
            <div key={e.seat} className="mx-paper p-4">
              <div className="text-[11px] opacity-60">{e.roleName}{e.seat === view.seat ? '（你）' : ''}</div>
              <div className="mx-serif font-black text-lg mb-2">{e.title}</div>
              <div className="mx-serif text-[15px]"><RichText text={e.text} /></div>
            </div>
          ))}
          {r.secrets.length > 0 && (
            <div className="mx-panel-2 p-3">
              <div className="text-xs font-black text-[var(--mx-gold)] mb-1">对局中的暗手</div>
              <ul className="text-[13px] text-white/80 space-y-1 list-disc pl-5">
                {r.secrets.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {tab === 'truth' && (
        <div className="space-y-3">
          {r.truth.map((t, i) => (
            <div key={i} className="mx-paper p-4">
              <div className="mx-serif font-black text-[16px] mb-2">{t.title}</div>
              <div className="mx-serif text-[15px]"><RichText text={t.text} /></div>
            </div>
          ))}
        </div>
      )}
      {tab === 'score' && (
        <div className="space-y-3">
          {r.scores.map(s => (
            <div key={s.seat} className="mx-panel-2 p-3">
              <div className="flex items-center mb-2">
                <div className="font-black text-white flex-1">{s.roleName}{s.seat === view.seat ? '（你）' : ''}</div>
                <div className="font-mono text-2xl font-black text-[var(--mx-gold)]">{s.total}</div>
              </div>
              <ul className="space-y-1">
                {s.items.map((it, i) => (
                  <li key={i} className="flex text-[13px]">
                    <span className={`flex-1 ${it.got ? 'text-white/90' : 'text-white/35 line-through'}`}>{it.label}</span>
                    <span className={`font-mono ${it.got ? 'text-emerald-300' : 'text-white/30'}`}>{it.got ? `+${it.points}` : 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {r.accuseReview.length > 0 && (
            <div className="mx-panel-2 p-3 space-y-2">
              <div className="text-xs font-black text-[var(--mx-gold)]">指认对照</div>
              {r.accuseReview.map((q, i) => (
                <div key={i} className="text-[13px]">
                  <div className="text-white/80">{q.prompt}</div>
                  <div className="text-emerald-300">正确：{q.answer}</div>
                  <div className="text-white/50 text-[12px]">
                    {Object.entries(q.picks).map(([seat, pick]) => {
                      const p = view.players[seat as keyof typeof view.players]
                      const role = view.roles.find(x => x.id === p.roleId)
                      return <span key={seat} className="mr-3">{role?.name ?? seat}：{pick}</span>
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
