// =====================
// 剧本杀 - 客户端状态
// =====================

import { create } from 'zustand'
import type { MysteryAction, Seat, SeatView } from '@/engine/mystery/types'
import { MysteryClient, loadSession, saveSession } from '@/lib/mystery/client'
import type { ServerMsg } from '@/lib/mystery/protocol'

type Toast = { id: number; text: string; tone: 'error' | 'info' }

type MysteryStore = {
  online: boolean
  joined: boolean
  resuming: boolean
  code: string | null
  seat: Seat | null
  view: SeatView | null
  /** 本地时钟与服务器时钟的差（server - local），用于倒计时 */
  clockSkew: number
  toasts: Toast[]
  init: () => void
  create: (name: string) => void
  join: (code: string, name: string) => void
  act: (action: MysteryAction) => void
  leave: () => void
  dismissToast: (id: number) => void
}

let client: MysteryClient | null = null
let toastSeq = 0

export const useMysteryStore = create<MysteryStore>((set, get) => {
  function pushToast(text: string, tone: Toast['tone']) {
    const id = ++toastSeq
    set(s => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }))
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 4500 : 3000)
  }

  function onMessage(msg: ServerMsg) {
    switch (msg.type) {
      case 'WELCOME':
        saveSession({ code: msg.code, token: msg.token })
        if (client) client.resumeWith = { code: msg.code, token: msg.token }
        set({ joined: true, resuming: false, code: msg.code, seat: msg.seat })
        break
      case 'VIEW':
        set({ view: msg.view, clockSkew: msg.view.step.serverNow - Date.now() })
        break
      case 'ERROR':
        if (msg.fatal) {
          saveSession(null)
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

  return {
    online: false,
    joined: false,
    resuming: false,
    code: null,
    seat: null,
    view: null,
    clockSkew: 0,
    toasts: [],

    init: () => {
      const saved = loadSession()
      if (saved && !get().joined) {
        if (!client) {
          client = new MysteryClient()
          client.onMessage(onMessage)
          client.onStatus(online => set({ online }))
        }
        client.resumeWith = saved
        set({ resuming: true })
        // 已连上时 onopen 不会再触发，需主动发送；否则由 onopen 自动发送
        if (client.isOpen) client.send({ type: 'RESUME', ...saved })
        else client.connect()
        setTimeout(() => { if (!get().joined) set({ resuming: false }) }, 4000)
      } else {
        ensureClient()
      }
    },

    create: (name) => {
      const c = ensureClient()
      c.resumeWith = null
      c.send({ type: 'CREATE', name })
    },

    join: (code, name) => {
      const c = ensureClient()
      c.resumeWith = null
      c.send({ type: 'JOIN', code, name })
    },

    act: (action) => {
      ensureClient().send({ type: 'ACT', action })
    },

    leave: () => {
      client?.send({ type: 'LEAVE' })
      saveSession(null)
      if (client) client.resumeWith = null
      set({ joined: false, view: null, code: null, seat: null })
    },

    dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  }
})
