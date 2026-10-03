// =====================
// 剧本杀 - 客户端状态
// =====================

import { create } from 'zustand'
import type { MysteryAction, Seat, SeatView } from '@/engine/mystery/types'
import { MysteryClient, loadSession, saveSession } from '@/lib/mystery/client'
import type { SavedSession } from '@/lib/mystery/client'
import type { ServerMsg } from '@/lib/mystery/protocol'

type Toast = { id: number; text: string; tone: 'error' | 'info' }

type MysteryStore = {
  online: boolean
  joined: boolean
  resuming: boolean
  code: string | null
  seat: Seat | null
  view: SeatView | null
  /** 主动离开、尚未结束的一局（入口页提供"回到房间"） */
  paused: SavedSession | null
  /** 本地时钟与服务器时钟的差（server - local），用于倒计时 */
  clockSkew: number
  toasts: Toast[]
  init: () => void
  create: (name: string) => void
  join: (code: string, name: string) => void
  /** 回到主动离开的那一局 */
  resume: () => void
  /** 放弃主动离开的那一局 */
  forget: () => void
  act: (action: MysteryAction) => void
  leave: () => void
  dismissToast: (id: number) => void
}

let client: MysteryClient | null = null
let toastSeq = 0
/** 正在等待的进房请求：只接受与之对应的 WELCOME（离开后迟到的 WELCOME 要丢掉） */
let pending: 'CREATE' | 'JOIN' | 'RESUME' | null = null

export const useMysteryStore = create<MysteryStore>((set, get) => {
  function pushToast(text: string, tone: Toast['tone']) {
    const id = ++toastSeq
    set(s => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 4500 : 3000)
  }

  function onMessage(msg: ServerMsg) {
    switch (msg.type) {
      case 'WELCOME': {
        const st = get()
        // 已离开房间后迟到的 WELCOME 要丢掉；只要还在房间里（含断线重连的自动 RESUME），
        // 就以服务器为准——服务器只会因为本连接的请求发 WELCOME，连接已经绑到了这个座位
        if (!pending && !st.joined) return
        pending = null
        saveSession({ code: msg.code, token: msg.token })
        if (client) client.resumeWith = { code: msg.code, token: msg.token }
        set({
          joined: true, resuming: false, paused: null, code: msg.code, seat: msg.seat,
          view: st.view && st.view.code === msg.code ? st.view : null,
        })
        break
      }
      case 'VIEW': {
        const st = get()
        if (!st.joined || msg.view.code !== st.code) return
        set({ view: msg.view, clockSkew: msg.view.step.serverNow - Date.now() })
        break
      }
      case 'LEFT': {
        // 以服务器为准：座位让出了就删掉本地令牌；座位还保留（比如离开时恰好开局了）就留着，入口页可以回来
        // 座位还挂着一条连接：服务器已记下这次放弃，等那条连接断开时执行并通知。
        // 现在什么都不动，也不算确认——万一本连接先断了收不到通知，重连后还会重发（服务器端幂等）
        if (msg.busy) {
          if (msg.token) client?.markAbandonBusy(msg.token)
          return
        }
        if (msg.token) client?.ackAbandon(msg.token)
        // 暂缓的放弃已作废（座位正被另一个真实在玩的连接使用）：最终结果是"座位保留"，本地会话不动
        if (msg.kept) return
        // 只处理属于这枚令牌的会话（同一房间号可能先后对应过不同的令牌）
        const same = (s: { code: string; token: string } | null | undefined) =>
          !!s && s.code === msg.code && (!msg.token || s.token === msg.token)
        const saved = loadSession()
        if (!same(saved)) {
          if (msg.vacated && same(get().paused)) set({ paused: null })
          return
        }
        if (!saved) return
        if (msg.vacated) {
          saveSession(null)
          if (get().paused?.code === msg.code) set({ paused: null })
        } else {
          const p = { code: saved.code, token: saved.token, paused: true }
          saveSession(p)
          if (!get().joined) set({ paused: p })
        }
        return
      }
      case 'ERROR':
        // 过期操作（双击、迟到）已被服务器丢弃，界面已经是新阶段："准备"不打扰玩家，其余操作提示一下
        if (msg.reason === 'stale') {
          if (msg.action && msg.action !== 'ready') pushToast(msg.message, 'info')
          return
        }
        if (msg.fatal) {
          pending = null
          // 被别的窗口顶下线：会话仍然有效（属于新窗口），不能删
          if (msg.reason !== 'superseded') saveSession(null)
          if (client) client.resumeWith = null
          set({ joined: false, resuming: false, view: null, code: null, seat: null })
        }
        pushToast(msg.message, 'error')
        break
    }
  }

  function ensureClient() {
    if (!client) {
      client = new MysteryClient()
      client.onMessage(onMessage)
      client.onStatus(online => set({ online }))
    }
    client.connect()
    return client
  }


  function startResume(saved: SavedSession) {
    const c = ensureClient()
    // 改主意回到这个座位：撤回尚未确认的放弃
    c.cancelAbandon(saved.token)
    // 离线时先点过「创建 / 加入」又改成恢复旧局：丢掉那个还没发出的请求
    c.cancelIntent()
    c.resumeWith = { code: saved.code, token: saved.token }
    pending = 'RESUME'
    set({ resuming: true, paused: null })
    // 已连上时 onopen 不会再触发，需主动发送；否则由 onopen 自动发送
    if (c.isOpen) c.send({ type: 'RESUME', code: saved.code, token: saved.token })
    setTimeout(() => { if (!get().joined) set({ resuming: false }) }, 4000)
  }

  return {
    online: false,
    joined: false,
    resuming: false,
    code: null,
    seat: null,
    view: null,
    paused: null,
    clockSkew: 0,
    toasts: [],

    init: () => {
      if (get().joined) return
      const saved = loadSession()
      if (saved && !saved.paused) {
        startResume(saved)
      } else {
        if (saved?.paused) set({ paused: saved })
        ensureClient()
      }
    },

    create: (name) => {
      const c = ensureClient()
      c.resumeWith = null
      pending = 'CREATE'
      c.send({ type: 'CREATE', name })
    },

    join: (code, name) => {
      const c = ensureClient()
      c.resumeWith = null
      pending = 'JOIN'
      c.send({ type: 'JOIN', code, name })
    },

    resume: () => {
      const p = get().paused
      if (!p) return
      saveSession({ code: p.code, token: p.token })
      startResume(p)
    },

    forget: () => {
      const p = get().paused
      set({ paused: null })
      if (!p) return
      const cur = loadSession()
      // 别的标签页已经用这枚令牌回到了这局（共享会话不再是"暂离"）：什么都不做
      if (cur && cur.token === p.token && !cur.paused) return
      // 只删属于这枚令牌的会话；共享会话已经属于别的房间（别的标签页在玩），不能动
      if (cur && cur.token === p.token) saveSession(null)
      // 通知服务器：大厅里让出座位；开局后告诉对方"不会再回来了"
      ensureClient().abandon(p, true)
    },

    act: (action) => {
      const at = get().view?.step.index
      const sent = ensureClient().send({ type: 'ACT', action, at })
      if (!sent) pushToast('网络未连接，这个操作没有发出。请等「已连线」后再试。', 'error')
    },

    leave: () => {
      const { view, code } = get()
      const saved = loadSession()
      // 先把令牌留着（标记为暂离），等服务器的 LEFT 确认：大厅里座位让出了才删。
      // 不能只看本地画面——离开的瞬间对方可能刚好点了开局。结局后离开就没必要保留了
      const ended = !!view?.result
      const inLobby = !view || view.step.kind === 'lobby'
      const sent = !!client?.send({ type: 'LEAVE' })
      if (!ended && saved && saved.code === code) {
        // 先把令牌留着（暂离），等服务器的 LEAVE 确认（LEFT）再决定删不删
        const p = { code: saved.code, token: saved.token, paused: true }
        saveSession(p)
        set({ paused: inLobby ? null : p })
        // 离线没发出去：凭令牌放弃（连上后发送，直到服务器确认）
        if (!sent) ensureClient().abandon(p, false)
      } else {
        saveSession(null)
        set({ paused: null })
      }
      pending = null
      if (client) client.resumeWith = null
      set({ joined: false, resuming: false, view: null, code: null, seat: null })
    },

    dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  }
})
