'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'
import type { BaseAction, PlayerId } from '@/engine/types'

const ACTION_LABEL: Record<BaseAction, { emoji: string; label: string }> = {
  ATK:  { emoji: '⚔', label: '降价' },
  QUA:  { emoji: '🔬', label: '研发' },
  MKT:  { emoji: '📣', label: '推广' },
  HOLD: { emoji: '🛡', label: '稳守' },
}

/**
 * 双人契约面板 —— 在情报/出牌阶段展示
 * 提议契约 / 接受拒绝待定 / 已接受 / 已拒绝
 */
export default function PactPanel() {
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const players = useMultiplayerStore(s => s.players)
  const lobbyPlayers = useMultiplayerStore(s => s.lobbyPlayers)
  const pacts = useMultiplayerStore(s => s.pacts)
  const proposePact = useMultiplayerStore(s => s.proposePact)
  const respondPact = useMultiplayerStore(s => s.respondPact)
  const [showPropose, setShowPropose] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<PlayerId | null>(null)
  const [selectedAction, setSelectedAction] = useState<BaseAction | null>(null)

  if (!myPlayerId) return null

  // 我发起的 pending（最多 1 个）
  const myProposed = pacts.find(p => p.proposerId === myPlayerId && p.status === 'pending')
  // 别人发给我的 pending
  const incoming = pacts.filter(p => p.targetId === myPlayerId && p.status === 'pending')
  // 已接受/拒绝的（与我相关）
  const decided = pacts.filter(p =>
    (p.proposerId === myPlayerId || p.targetId === myPlayerId) &&
    (p.status === 'accepted' || p.status === 'declined')
  )

  // 可选目标：除我之外的所有真人玩家（联机）
  const available = (players.length > 0 ? players : lobbyPlayers).filter(p => p.id !== myPlayerId)
  const isCpuId = (id: string) => id.includes('🤖') || (lobbyPlayers.find(p => p.id === id)?.connected === false)

  function handlePropose() {
    if (!selectedTarget || !selectedAction) return
    proposePact(selectedTarget, selectedAction)
    setShowPropose(false)
    setSelectedTarget(null)
    setSelectedAction(null)
  }

  return (
    <div className="glass-card border-amber-700/30 rounded-xl p-2.5 space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-amber-300">🤝 双人契约</span>
        <span className="text-[10px] text-stone-600">守约 +¥8万 · 背约 -¥12万</span>
      </div>

      {/* 别人发来的契约（最优先显示，需要决定） */}
      {incoming.map(p => {
        const proposer = players.find(pp => pp.id === p.proposerId) ?? lobbyPlayers.find(pp => pp.id === p.proposerId)
        const c = PLAYER_COLORS[p.proposerId]
        const ac = ACTION_LABEL[p.action]
        return (
          <div key={p.id} className="rounded-lg p-2 bg-amber-950/30 border border-amber-700/50 space-y-1.5">
            <div className="text-xs">
              <span className={`font-bold ${c?.text}`}>{proposer?.name ?? p.proposerId}</span>
              <span className="text-stone-400"> 提议本回合一起选 </span>
              <span className="font-bold text-amber-300">{ac.emoji} {ac.label}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respondPact(p.id, true)}
                className="flex-1 py-1.5 bg-green-700/60 hover:bg-green-600 text-white text-xs font-bold rounded transition-all"
              >
                ✓ 接受
              </button>
              <button
                onClick={() => respondPact(p.id, false)}
                className="flex-1 py-1.5 bg-stone-700/60 hover:bg-red-800/60 text-stone-300 text-xs rounded transition-all"
              >
                ✗ 拒绝
              </button>
            </div>
          </div>
        )
      })}

      {/* 我发起的契约状态 */}
      {myProposed && (
        <div className="rounded-lg p-2 bg-stone-800/40 border border-stone-700/50">
          <div className="text-xs text-stone-400">
            已向{' '}
            <span className={PLAYER_COLORS[myProposed.targetId]?.text}>
              {players.find(p => p.id === myProposed.targetId)?.name ?? myProposed.targetId}
            </span>{' '}
            提议 <span className="font-bold text-amber-300">{ACTION_LABEL[myProposed.action].label}</span>
            <span className="text-stone-600 ml-1">· 等待对方响应…</span>
          </div>
        </div>
      )}

      {/* 已成立 / 已拒绝 */}
      {decided.map(p => {
        const otherId = p.proposerId === myPlayerId ? p.targetId : p.proposerId
        const c = PLAYER_COLORS[otherId]
        const otherName = players.find(pp => pp.id === otherId)?.name ?? otherId
        const accepted = p.status === 'accepted'
        return (
          <div key={p.id} className={`text-[11px] px-2 py-1 rounded ${
            accepted ? 'bg-green-950/30 text-green-400' : 'bg-stone-900/40 text-stone-500'
          }`}>
            {accepted ? '🤝' : '✗'} 与 <span className={c?.text}>{otherName}</span> 的{' '}
            <span className="font-bold">{ACTION_LABEL[p.action].label}</span> 契约
            {accepted ? '已成立' : '被拒绝'}
          </div>
        )
      })}

      {/* 提议契约按钮 */}
      {!myProposed && !showPropose && (
        <button
          onClick={() => setShowPropose(true)}
          className="w-full py-1.5 bg-stone-800/60 hover:bg-amber-900/40 border border-stone-700/40 hover:border-amber-700/50 text-xs text-stone-400 hover:text-amber-300 rounded transition-all"
        >
          + 提议契约
        </button>
      )}

      {/* 提议契约面板 */}
      {showPropose && (
        <div className="rounded-lg p-2 bg-stone-900/50 border border-amber-700/30 space-y-2">
          <div className="text-[11px] text-stone-400">选择对手 + 共同动作：</div>
          {/* 目标 */}
          <div className="flex gap-1 flex-wrap">
            {available.filter(p => !isCpuId(p.id)).map(p => {
              const c = PLAYER_COLORS[p.id]
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedTarget(p.id)}
                  className={`text-[11px] px-2 py-1 rounded border transition-all ${
                    selectedTarget === p.id
                      ? 'bg-amber-900/60 border-amber-500 text-amber-200'
                      : 'bg-stone-800/40 border-stone-700/40 hover:border-stone-500'
                  }`}
                >
                  <span className={c?.text}>{p.name}</span>
                </button>
              )
            })}
          </div>
          {/* 动作 */}
          <div className="grid grid-cols-4 gap-1">
            {(['ATK', 'QUA', 'MKT', 'HOLD'] as const).map(a => {
              const ac = ACTION_LABEL[a]
              const sel = selectedAction === a
              return (
                <button
                  key={a}
                  onClick={() => setSelectedAction(a)}
                  className={`text-[10px] py-1 rounded border transition-all ${
                    sel
                      ? 'bg-amber-900/60 border-amber-500 text-amber-200'
                      : 'bg-stone-800/40 border-stone-700/40 hover:border-stone-500 text-stone-400'
                  }`}
                >
                  {ac.emoji} {ac.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handlePropose}
              disabled={!selectedTarget || !selectedAction}
              className="flex-1 py-1 bg-amber-700/60 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-white text-xs font-bold rounded transition-all"
            >
              发起契约
            </button>
            <button
              onClick={() => { setShowPropose(false); setSelectedTarget(null); setSelectedAction(null) }}
              className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs rounded transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
