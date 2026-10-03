// =====================
// 剧本杀 · 双机器人端到端对局
// 用法：先启动服务器（npm run start:mp 或 tsx server.ts），再运行
//   npx tsx scripts/mystery-bots.ts [ws://127.0.0.1:3000/ws-mystery]
// 两个机器人会建房、加入、选角，并按通用策略把整局打完，最后打印结局。
// =====================

import WebSocket from 'ws'
import type { SeatView } from '../engine/mystery/types'
import type { ClientMsg, ServerMsg } from '../lib/mystery/protocol'

const URL = process.argv.slice(2).find(a => a.startsWith('ws')) ?? 'ws://127.0.0.1:3000/ws-mystery'
const VERBOSE = process.argv.includes('--verbose')
const TIMEOUT_MS = 120_000

type FinaleHint = { actions?: { id: string; label: string; payload: unknown }[] }

class Bot {
  ws!: WebSocket
  view: SeatView | null = null
  errors: string[] = []
  private inFlight = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private acted = new Set<string>()

  constructor(public name: string) {}

  open() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(URL)
      this.ws.on('open', () => resolve())
      this.ws.on('error', reject)
      this.ws.on('message', d => this.onMsg(JSON.parse(d.toString()) as ServerMsg))
    })
  }

  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m))
  }

  act(action: Extract<ClientMsg, { type: 'ACT' }>['action']) {
    if (VERBOSE) console.log(`[${this.name}] act ${JSON.stringify(action).slice(0, 80)}`)
    this.inFlight = true
    this.send({ type: 'ACT', action })
  }

  private onMsg(m: ServerMsg) {
    if (m.type === 'ERROR') {
      this.errors.push(m.message)
      if (VERBOSE) console.log(`[${this.name}] ERROR ${m.message}`)
      this.inFlight = false
      this.schedule()
      return
    }
    if (m.type !== 'VIEW') return
    if (VERBOSE && this.view?.step.id !== m.view.step.id) console.log(`[${this.name}] → ${m.view.step.id} (${m.view.step.kind})`)
    if (process.argv.includes('--trace')) console.log(`[${this.name}] VIEW ${m.view.step.id} ready=${m.view.players.P1.ready}/${m.view.players.P2.ready} ap=${m.view.me.ap}`)
    this.view = m.view
    this.inFlight = false
    this.schedule()
  }

  /** 一次只发一个动作：发出后等服务器回应（VIEW 或 ERROR）再决定下一步 */
  private schedule() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.inFlight) this.decide()
    }, 60)
  }

  private once(id: string, f: () => void) {
    if (this.acted.has(id)) return
    this.acted.add(id)
    f()
  }

  private decide() {
    const v = this.view
    if (!v) return
    const me = v.players[v.seat]
    const k = v.step.kind
    const stepKey = `${v.step.index}`

    if (k === 'lobby') {
      if (!me.roleId) {
        const other = v.players[v.seat === 'P1' ? 'P2' : 'P1']
        const free = v.roles.find(r => r.id !== other.roleId)
        if (free) this.act({ type: 'pickRole', roleId: free.id })
        return
      }
      const other = v.players[v.seat === 'P1' ? 'P2' : 'P1']
      if (other.name && !me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'search') {
      // 两个机器人从相反的方向挑搜查点，减少"同时抢同一处"
      const open = v.spots.filter(s => s.status === 'open' && s.cost <= v.me.ap)
      if (v.seat === 'P2') open.reverse()
      if (open.length) {
        this.act({ type: 'search', clueId: open[0].clueId })
        return
      }
      for (const n of v.npcs) {
        const q = n.questions.find(q => !q.asked && q.cost <= v.me.ap)
        if (q) {
          this.act({ type: 'ask', npcId: n.id, questionId: q.id })
          return
        }
      }
      // 公开一半手牌，制造互动
      const mine = v.clues.filter(c => c.holder === 'me' && !c.public)
      if (mine.length > 1) {
        this.once(`pub:${mine[0].id}`, () => this.act({ type: 'publish', clueId: mine[0].id }))
      }
      if (!me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'auction') {
      const a = v.auction
      if (a && !a.myBids && !a.results) {
        // 甲出价律师与游艇，乙出价头版与重新计票
        const mine = v.seat === 'P1' ? ['lot_lawyer', 'lot_yacht'] : ['lot_headline', 'lot_recount']
        const bids = Object.fromEntries(a.lots.map(l => [l.id, mine.includes(l.id) ? l.min + 300 : 0]))
        this.once(`bid:${stepKey}`, () => this.act({ type: 'bid', bids }))
        return
      }
      if (a?.results && !me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'choice') {
      const c = v.me.choice
      if (c && !c.chosen) {
        const opt = c.options.find(o => !o.disabled)
        if (opt) this.act({ type: 'choose', optionId: opt.id })
        return
      }
      if (!me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'finale') {
      const f = v.finale as FinaleHint | null
      const a = f?.actions?.[0]
      if (a) this.once(`fin:${stepKey}:${JSON.stringify(v.finale)}`, () => this.act({ type: 'finale', payload: a.payload }))
      return
    }

    if (k === 'accuse') {
      if (!v.me.accuse) {
        const answers: Record<string, string | string[]> = {}
        for (const q of v.accuse) answers[q.id] = q.multi ? [q.options[0].id] : q.options[0].id
        this.once(`acc:${stepKey}`, () => this.act({ type: 'accuse', answers }))
      }
      return
    }

    if (k === 'ending') return

    if (!me.ready) this.act({ type: 'ready', value: true })
  }
}

async function main() {
  const a = new Bot('机器人甲')
  const b = new Bot('机器人乙')
  await a.open()
  await b.open()
  a.send({ type: 'CREATE', name: a.name })
  const code = await waitFor(() => a.view?.code ?? null)
  b.send({ type: 'JOIN', code, name: b.name })
  const t0 = Date.now()
  const ending = await waitFor(() => (a.view?.step.kind === 'ending' && b.view?.step.kind === 'ending' ? a.view : null), TIMEOUT_MS)
  const r = ending.result!
  console.log(`✅ 房间 ${code} 打完整局，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`   结局：${r.headline}`)
  for (const s of r.scores) console.log(`   ${s.roleName}：${s.total} 分`)
  console.log(`   甲获得线索 ${a.view!.clues.length} 条，乙获得线索 ${b.view!.clues.length} 条`)
  console.log(`   ${r.endings.map(e => `${e.roleName}：「${e.title}」`).join('；')}`)
  const errs = [...a.errors, ...b.errors].filter(e => !/已经|不能|还不能|行动点/.test(e))
  if (errs.length) console.log('   非预期错误：', errs)
  a.ws.close()
  b.ws.close()
  process.exit(errs.length ? 1 : 0)
}

function waitFor<T>(f: () => T | null, ms = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const timer = setInterval(() => {
      const v = f()
      if (v) {
        clearInterval(timer)
        resolve(v)
      } else if (Date.now() - t0 > ms) {
        clearInterval(timer)
        reject(new Error('等待超时'))
      }
    }, 20)
  })
}

main().catch(e => {
  console.error('❌', e.message)
  process.exit(1)
})
