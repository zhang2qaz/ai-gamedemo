'use client'

import { useState } from 'react'
import { useMultiplayerStore } from '@/store/multiplayerStore'
import { PLAYER_COLORS } from '@/lib/playerColors'
import { formatMoney } from '@/lib/format'
import { INTEL_PRICE_PRESETS } from '@/engine/intelMarket'

const ACTION_LABEL: Record<string, string> = {
  ATK: '降价', QUA: '研发', MKT: '推广', HOLD: '稳守',
}

const RELIABILITY_COLOR: Record<string, string> = {
  '高': 'text-green-400',
  '中': 'text-amber-400',
  '低': 'text-stone-400',
}

/**
 * 情报交易市场：展示所有挂牌情报 + 我的挂牌操作 + 已购买情报。
 */
export default function IntelMarket() {
  const myPlayerId = useMultiplayerStore(s => s.myPlayerId)
  const players = useMultiplayerStore(s => s.players)
  const myIntel = useMultiplayerStore(s => s.myPrivateIntel)
  const listings = useMultiplayerStore(s => s.intelListings)
  const purchased = useMultiplayerStore(s => s.purchasedIntel)
  const lastSold = useMultiplayerStore(s => s.lastSoldNotice)
  const listIntel = useMultiplayerStore(s => s.listIntel)
  const unlistIntel = useMultiplayerStore(s => s.unlistIntel)
  const buyIntel = useMultiplayerStore(s => s.buyIntel)
  const dismissSoldNotice = useMultiplayerStore(s => s.dismissSoldNotice)

  const [showListUi, setShowListUi] = useState(false)
  const [selectedPrice, setSelectedPrice] = useState<number>(INTEL_PRICE_PRESETS[1])

  const me = players.find(p => p.id === myPlayerId)
  const myCash = me?.cumulativeProfit ?? 0

  const myActiveListing = listings.find(l => l.sellerId === myPlayerId && !l.soldTo)
  const otherListings = listings.filter(l => l.sellerId !== myPlayerId && !l.soldTo)

  // 本回合的购买（只显示当前回合）
  const round = players[0] ? undefined : undefined  // 简化：全部显示
  const myPurchased = purchased

  return (
    <div className="glass-card border-cyan-700/40 rounded-xl p-3 space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-cyan-300">📰 情报交易市场</span>
        <span className="text-[10px] text-stone-600">¥10万~¥50万</span>
      </div>

      {/* 卖家被买的提示 */}
      {lastSold && (
        <div className="text-[11px] px-2 py-1 bg-green-950/40 border border-green-700/40 rounded text-green-400 flex items-center justify-between">
          <span>💰 {lastSold.toName} 买走了你的情报，+{formatMoney(lastSold.price)}</span>
          <button onClick={dismissSoldNotice} className="text-stone-500 hover:text-stone-300 text-xs ml-2">✕</button>
        </div>
      )}

      {/* 我的挂牌 / 挂牌按钮 */}
      {myIntel && (
        <div className="border-t border-stone-800/60 pt-2 space-y-1.5">
          {myActiveListing ? (
            <div className="text-[11px] flex items-center justify-between bg-amber-950/30 border border-amber-700/40 rounded px-2 py-1">
              <span className="text-amber-400">📌 你的情报已挂牌 {formatMoney(myActiveListing.price)}</span>
              <button
                onClick={unlistIntel}
                className="text-[10px] text-stone-500 hover:text-red-400"
              >
                撤回
              </button>
            </div>
          ) : showListUi ? (
            <div className="space-y-1.5">
              <div className="text-[11px] text-stone-400">为你的情报定价：</div>
              <div className="flex gap-1.5">
                {INTEL_PRICE_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPrice(p)}
                    className={`flex-1 text-[11px] py-1 rounded border transition-all ${
                      selectedPrice === p
                        ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200'
                        : 'bg-stone-800/40 border-stone-700/40 text-stone-400 hover:border-stone-500'
                    }`}
                  >
                    {formatMoney(p)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { listIntel(selectedPrice); setShowListUi(false) }}
                  className="flex-1 py-1 bg-cyan-700/60 hover:bg-cyan-600 text-white text-xs font-bold rounded transition-all"
                >
                  挂牌出售
                </button>
                <button
                  onClick={() => setShowListUi(false)}
                  className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs rounded transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowListUi(true)}
              className="w-full py-1 bg-stone-800/60 hover:bg-cyan-900/40 border border-stone-700/40 hover:border-cyan-700/50 text-[11px] text-stone-400 hover:text-cyan-300 rounded transition-all"
            >
              + 把我的情报挂牌出售
            </button>
          )}
        </div>
      )}

      {/* 别人挂的牌 */}
      {otherListings.length > 0 && (
        <div className="border-t border-stone-800/60 pt-2 space-y-1.5">
          <div className="text-[10px] text-stone-600">市场上的情报：</div>
          {otherListings.map(l => {
            const c = PLAYER_COLORS[l.sellerId]
            const canAfford = myCash >= l.price
            return (
              <div key={l.id} className="rounded p-1.5 bg-stone-900/40 border border-stone-700/40">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${c?.text ?? 'text-stone-400'}`}>{l.sellerName}</span>
                    <span className="text-stone-600">·</span>
                    <span className="text-stone-500">{l.source}</span>
                    <span className={`font-bold ${RELIABILITY_COLOR[l.reliability]}`}>
                      可信度{l.reliability}
                    </span>
                  </div>
                  <span className="text-amber-400 font-bold">{formatMoney(l.price)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-stone-500">
                    {l.stance === 'recommend' ? '🟢 推荐' : '🟡 警告'} {ACTION_LABEL[l.hintAction]}
                  </span>
                  <button
                    onClick={() => buyIntel(l.id)}
                    disabled={!canAfford}
                    className={`text-[11px] px-2 py-0.5 rounded font-bold transition-all ${
                      canAfford
                        ? 'bg-cyan-700/60 hover:bg-cyan-600 text-white'
                        : 'bg-stone-800 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? '买下' : '余额不足'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 我买到的情报 */}
      {myPurchased.length > 0 && (
        <div className="border-t border-stone-800/60 pt-2 space-y-1">
          <div className="text-[10px] text-stone-600">已购入的情报：</div>
          {myPurchased.map((intel, i) => (
            <div key={i} className="rounded p-1.5 bg-cyan-950/30 border border-cyan-700/40 text-[11px]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-cyan-300 font-bold">{intel.source}</span>
                <span className={`font-bold ${RELIABILITY_COLOR[intel.reliability]}`}>
                  可信度{intel.reliability}
                </span>
                <span className="text-stone-600 ml-auto">R{intel.round}</span>
              </div>
              <div className="text-stone-300 leading-tight">{intel.text}</div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                {intel.stance === 'recommend' ? '🟢 推荐' : '🟡 警告'} {ACTION_LABEL[intel.hintAction]}
              </div>
            </div>
          ))}
        </div>
      )}

      {otherListings.length === 0 && !myActiveListing && myPurchased.length === 0 && !showListUi && (
        <div className="text-[10px] text-stone-700 text-center py-1">
          市场暂无挂牌 · 你可以率先把自己的情报卖出去
        </div>
      )}
    </div>
  )
}
