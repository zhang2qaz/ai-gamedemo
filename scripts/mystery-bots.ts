// =====================
// 剧本杀 · 多机器人端到端对局
// 用法：先启动服务器（npm run start:mp 或 tsx server.ts），再运行
//   npx tsx scripts/mystery-bots.ts [ws://127.0.0.1:3000/ws-mystery] [--players 2|3|4] [--story museum-night]
// 几个机器人会建房、加入、选角，并按通用策略把整局打完，最后打印结局。
// =====================

import WebSocket from 'ws'
import type { SeatView } from '../engine/mystery/types'
import type { FinaleView } from '../engine/mystery/scenarios/swing-state/finaleTypes'
import type { ClientMsg, ServerMsg } from '../lib/mystery/protocol'

const URL = process.argv.slice(2).find(a => a.startsWith('ws')) ?? 'ws://127.0.0.1:3000/ws-mystery'
const VERBOSE = process.argv.includes('--verbose')
const TIMEOUT_MS = 120_000
const argPlayers = process.argv.indexOf('--players')
const PLAYERS = argPlayers > 0 ? Number(process.argv[argPlayers + 1]) : 3
const argStory = process.argv.indexOf('--story')
const STORY = argStory > 0 ? process.argv[argStory + 1] : undefined
if (![2, 3, 4].includes(PLAYERS)) {
  console.error('❌ --players 只能是 2、3 或 4')
  process.exit(1)
}

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
    this.send({ type: 'ACT', action, at: this.view?.step.index })
  }

  private onMsg(m: ServerMsg) {
    if (m.type === 'ERROR' && m.reason === 'stale') {
      // 阶段已推进、操作作废：等新的 VIEW 再决定
      this.inFlight = false
      this.schedule()
      return
    }
    if (m.type === 'ERROR') {
      this.errors.push(m.message)
      if (VERBOSE) console.log(`[${this.name}] ERROR ${m.message}`)
      this.inFlight = false
      this.schedule()
      return
    }
    if (m.type !== 'VIEW') return
    if (VERBOSE && this.view?.step.id !== m.view.step.id) console.log(`[${this.name}] → ${m.view.step.id} (${m.view.step.kind})`)
    if (process.argv.includes('--trace')) console.log(`[${this.name}] VIEW ${m.view.step.id} ready=${m.view.seats.map(s => (m.view.players[s]?.ready ? 1 : 0)).join('/')} ap=${m.view.me.ap}`)
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
    if (!me) return
    const k = v.step.kind
    const stepKey = `${v.step.index}`

    if (k === 'lobby') {
      if (!me.roleId) {
        // 按座位顺序挑：先挑必须有人演的角色
        const taken = new Set(Object.values(v.players).map(p => p?.roleId))
        const order = [...v.roles.filter(r => !r.optional), ...v.roles.filter(r => r.optional)]
        const free = order.find(r => !taken.has(r.id))
        if (free) this.act({ type: 'pickRole', roleId: free.id })
        return
      }
      // 人到齐了再准备（所有人都准备就会马上开局，之后就进不来了）
      const allPicked = v.seats.every(s => v.players[s]?.roleId)
      if (v.seats.length >= PLAYERS && allPicked && !me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'search') {
      // 机器人从不同的位置开始挑搜查点，减少"同时抢同一处"
      const open = v.spots.filter(s => s.status === 'open' && s.cost <= v.me.ap)
      const shift = v.seats.indexOf(v.seat) * Math.ceil(open.length / Math.max(1, v.seats.length))
      open.push(...open.splice(0, shift))
      if (open.length) {
        this.act({ type: 'search', spotId: open[0].spotId })
        return
      }
      for (const n of v.npcs) {
        const q = n.questions.find(q => !q.asked && q.cost <= v.me.ap)
        if (q) {
          this.act({ type: 'ask', npcId: n.id, questionId: q.id })
          return
        }
      }
      // 公开一份手牌、把一份交给下一个人，制造互动
      const mine = v.clues.filter(c => c.holder === 'me' && !c.public && c.kind !== 'item')
      if (mine.length > 1) {
        this.once(`pub:${mine[0].id}`, () => this.act({ type: 'publish', clueId: mine[0].id }))
      }
      if (mine.length > 2 && !this.acted.has(`give:${stepKey}`)) {
        const next = v.seats[(v.seats.indexOf(v.seat) + 1) % v.seats.length]
        const gift = mine[mine.length - 1]
        this.once(`give:${stepKey}`, () => this.act({ type: 'give', clueId: gift.id, to: next }))
        return
      }
      if (!me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'auction') {
      const a = v.auction
      if (a && !a.myBids && !a.results) {
        // 每个机器人各盯两件拍品（单数座位要第 1、3 件，双数座位要第 2、4 件）；第三、四个机器人跟前面的人抢（会出现平局被收走）
        const parity = v.seats.indexOf(v.seat) % 2
        const step = v.scenario.currency?.step ?? 100
        const bids = Object.fromEntries(a.lots.map((l, i) => [l.id, i % 2 === parity ? l.min + 3 * step : 0]))
        this.once(`bid:${stepKey}`, () => this.act({ type: 'bid', bids }))
        return
      }
      if (a?.results && !me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'choice') {
      const c = v.me.choice
      if (c && !c.chosen) {
        // 第一个座位选最后一项（例如"说出来"），其他人选第一项
        const usable = c.options.filter(o => !o.disabled)
        const opt = v.seats.indexOf(v.seat) === 0 ? usable[usable.length - 1] : usable[0]
        if (opt) this.act({ type: 'choose', optionId: opt.id })
        return
      }
      if (!me.ready) this.act({ type: 'ready', value: true })
      return
    }

    if (k === 'finale') {
      const f = v.finale as FinaleView | null
      if (!f) return
      const key = `fin:${f.phase}:${f.round}`
      if (f.phase === 'orders' && !f.mySubmitted) {
        // 交手里第一份不是认罪的证据（指向普莱斯的排在最前面）
        const card = f.hand.find(c => !c.confessor)
        const order = { card: card?.id ?? null, headline: false, recount: false, flee: false }
        this.once(key, () => this.act({ type: 'finale', payload: { type: 'order', round: f.round, order } }))
        return
      }
      if (f.phase === 'deal' && !f.deal?.myChoice) {
        // 第二个座位接受交易并点名第一个人，其余拒绝
        const accept = v.seats.indexOf(v.seat) === 1 && f.deal && f.deal.targets.length > 0
        const payload = accept ? { type: 'deal', choice: 'accept', target: f.deal!.targets[0].who } : { type: 'deal', choice: 'refuse' }
        this.once(key, () => this.act({ type: 'finale', payload }))
        return
      }
      const a = f.actions[0]
      if (a) this.once(`${key}:${JSON.stringify(a.payload)}`, () => this.act({ type: 'finale', payload: a.payload }))
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
  const NAMES = ['机器人甲', '机器人乙', '机器人丙', '机器人丁']
  const bots = NAMES.slice(0, PLAYERS).map(n => new Bot(n))
  for (const b of bots) await b.open()
  const [host, ...rest] = bots
  host.send({ type: 'CREATE', name: host.name, ...(STORY ? { scenario: STORY } : {}) })
  const code = await waitFor(() => host.view?.code ?? null)
  const hv = host.view!
  if (PLAYERS < hv.minPlayers || PLAYERS > hv.maxPlayers) {
    console.error(`❌ 《${hv.scenario.title}》要 ${hv.minPlayers}–${hv.maxPlayers} 个人，--players ${PLAYERS} 开不了局${STORY && hv.scenario.id !== STORY ? `（没有叫 ${STORY} 的剧本）` : ''}`)
    process.exit(1)
  }
  for (const b of rest) {
    b.send({ type: 'JOIN', code, name: b.name })
    await waitFor(() => b.view?.code ?? null)
  }
  const t0 = Date.now()
  const ending = await waitFor(() => (bots.every(b => b.view?.step.kind === 'ending') ? host.view : null), TIMEOUT_MS)
  const r = ending.result!
  console.log(`✅ 房间 ${code}（《${ending.scenario.title}》${PLAYERS} 人）打完整局，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`   结局：${r.headline}`)
  for (const s of r.scores) console.log(`   ${s.roleName}：${s.total} ${ending.scenario.scoreUnit}`)
  console.log(`   ${bots.map(b => `${b.name}获得线索 ${b.view!.clues.length} 条`).join('，')}`)
  console.log(`   ${r.endings.map(e => `${e.roleName}：「${e.title}」`).join('；')}`)
  const f = ending.finale as FinaleView | null
  if (f) {
    console.log(`   终局名单：${f.people.map(p => `${p.name} ${p.count}/${p.line}${p.taken ? '（带走）' : ''}`).join('，')}`)
    console.log(`   交易：${JSON.stringify(f.deal?.result)}`)
  }
  const errs = bots.flatMap(b => b.errors).filter(e => !/已经|不能|还不能|行动点/.test(e))
  if (errs.length) console.log('   非预期错误：', errs)
  const bad = r.endings.length !== PLAYERS || r.scores.length !== PLAYERS
  if (bad) console.log('   ❌ 结局 / 计分人数不对')
  for (const b of bots) b.ws.close()
  process.exit(errs.length || bad ? 1 : 0)
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
