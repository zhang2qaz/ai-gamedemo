// 《摇摆州》内容一致性 + 唯一解测试
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { SCENARIO, CASE_FILES, ACCUSE } from '../scenarios/swing-state/content'
import { FINALE_CARDS, WILL, ITEMS } from '../scenarios/swing-state/finale'
import { PUZZLE, EXPECTED } from '../scenarios/swing-state/puzzle'
import { solveAll, necessaryClues } from '../solver'
import type { Cond } from '../types'

const clueIds = new Set(SCENARIO.clues.map(c => c.id))
const stepIds = new Set(SCENARIO.flow.map(s => s.id))
const roleIds = new Set(SCENARIO.roles.map(r => r.id))

function condClues(c: Cond | undefined, out: string[] = []): string[] {
  if (!c) return out
  if ('hasClue' in c) out.push(c.hasClue)
  else if ('owns' in c) out.push(c.owns)
  else if ('all' in c) c.all.forEach(x => condClues(x, out))
  else if ('any' in c) c.any.forEach(x => condClues(x, out))
  else if ('not' in c) condClues(c.not, out)
  return out
}

/** 替必选角色站岗的 NPC 永远不会出场（那个角色一定有玩家扮演） */
function npcCanAppear(n: (typeof SCENARIO.npcs)[number]) {
  return !n.standsInFor || !!SCENARIO.roles.find(r => r.id === n.standsInFor)?.optional
}

/** 可以取得的线索：搜证点、问询所得、流程发放、拍卖所得 */
function obtainable(): Set<string> {
  const s = new Set<string>()
  for (const c of SCENARIO.clues) if (c.location) s.add(c.id)
  for (const n of SCENARIO.npcs) if (npcCanAppear(n)) for (const q of n.questions) for (const g of q.grants ?? []) s.add(g)
  for (const st of SCENARIO.flow) {
    for (const e of st.onEnter ?? []) if ('giveClue' in e) s.add(e.giveClue)
    for (const l of st.lots ?? []) s.add(l.item)
  }
  return s
}

describe('《摇摆州》内容一致性', () => {
  test('线索 id 唯一', () => {
    expect(clueIds.size).toBe(SCENARIO.clues.length)
  })

  test('所有引用都指向存在的线索 / 步骤 / 角色 / 地点', () => {
    const locIds = new Set(SCENARIO.locations.map(l => l.id))
    for (const c of SCENARIO.clues) {
      if (c.location) expect(locIds.has(c.location)).toBe(true)
      if (c.from) expect(stepIds.has(c.from)).toBe(true)
      if (c.onlyRole) expect(roleIds.has(c.onlyRole)).toBe(true)
      for (const id of condClues(c.requires)) expect(clueIds.has(id)).toBe(true)
    }
    for (const n of SCENARIO.npcs) {
      for (const q of n.questions) {
        for (const g of q.grants ?? []) expect(clueIds.has(g)).toBe(true)
        if (q.present) expect(clueIds.has(q.present)).toBe(true)
        if (q.from) expect(stepIds.has(q.from)).toBe(true)
        for (const id of condClues(q.requires)) expect(clueIds.has(id)).toBe(true)
      }
    }
    for (const r of SCENARIO.roles) for (const ch of r.script) expect(stepIds.has(ch.from)).toBe(true)
    for (const st of SCENARIO.flow) {
      for (const e of st.onEnter ?? []) {
        if ('giveClue' in e) {
          expect(clueIds.has(e.giveClue)).toBe(true)
          if (e.role) expect(roleIds.has(e.role)).toBe(true)
        }
      }
      for (const l of st.lots ?? []) expect(clueIds.has(l.item)).toBe(true)
      if (st.kind === 'read') expect(SCENARIO.roles.every(r => r.script.some(c => c.id === st.chapter))).toBe(true)
    }
    for (const cf of CASE_FILES) {
      expect(stepIds.has(cf.opens)).toBe(true)
      expect(stepIds.has(cf.closes)).toBe(true)
    }
  })

  test('案卷与指认的标准答案都在选项里', () => {
    for (const cf of CASE_FILES) for (const q of cf.questions) expect(q.options.some(o => o.id === q.answer)).toBe(true)
    for (const q of ACCUSE) {
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer]
      for (const a of answers) expect(q.options.some(o => o.id === a)).toBe(true)
    }
  })

  test('终局选票与道具都是存在且可取得的线索', () => {
    const ok = obtainable()
    for (const id of Object.keys(FINALE_CARDS)) {
      expect(clueIds.has(id)).toBe(true)
      expect(ok.has(id)).toBe(true)
    }
    expect(ok.has(WILL)).toBe(true)
    for (const it of Object.values(ITEMS)) expect(ok.has(it)).toBe(true)
  })

  test('每位玩家开局都必然握有终局选票（不会出现"没有证据可交"的玩家），而且都有一份只有自己能交的自白', () => {
    for (const r of SCENARIO.roles) {
      const granted = SCENARIO.flow.flatMap(s => s.onEnter ?? []).filter(e => 'giveClue' in e && e.role === r.id).map(e => (e as { giveClue: string }).giveClue)
      const votes = granted.filter(id => id in FINALE_CARDS)
      expect(votes.length).toBeGreaterThanOrEqual(2)
      expect(votes.filter(id => FINALE_CARDS[id].confessor === r.id)).toHaveLength(1)
    }
  })

  test('能交给警长的证据只指向能上名单的人；替身 NPC 只替可选角色', () => {
    const who = new Set([...SCENARIO.roles.map(r => r.id), 'price'])
    for (const m of Object.values(FINALE_CARDS)) {
      for (const w of m.implicates) expect(who.has(w)).toBe(true)
      expect(m.implicates.length > 0 || !!m.confessor).toBe(true)
    }
    for (const n of SCENARIO.npcs) if (n.standsInFor) expect(roleIds.has(n.standsInFor)).toBe(true)
    expect(SCENARIO.roles.filter(r => !r.optional).map(r => r.id)).toEqual(['mandy', 'ethan', 'joan'])
    expect(SCENARIO.minPlayers).toBe(3)
    expect(SCENARIO.maxPlayers).toBe(4)
  })

  test('目击卡与自白卡不直接泄露钟点答案', () => {
    const byId = new Map(SCENARIO.clues.map(c => [c.id, c.text]))
    expect(byId.get('a_saw')).not.toMatch(/02:40|两点四十/)
    expect(byId.get('b_confess')).not.toMatch(/02:3|02:4/)
  })
})

describe('《摇摆州》唯一解', () => {
  test('全部线索在手时，真相是唯一解且等于标准答案', () => {
    const sols = solveAll(PUZZLE, { limit: 5 })
    expect(sols).toHaveLength(1)
    expect(sols[0]).toEqual(EXPECTED)
  })

  test('逻辑模型引用的每条线索都存在且可以取得', () => {
    const ok = obtainable()
    for (const c of PUZZLE.constraints) {
      for (const id of c.clues) {
        expect(clueIds.has(id)).toBe(true)
        expect(ok.has(id)).toBe(true)
      }
    }
  })

  test('没有任何单条线索能单独锁定全部真相（防塌局）', () => {
    const all = [...new Set(PUZZLE.constraints.flatMap(c => c.clues))]
    for (const only of all) {
      const sols = solveAll(PUZZLE, { limit: 2, clueFilter: id => id === only })
      expect(sols.length).toBeGreaterThan(1)
    }
  })

  test('关键结论都有冗余证据：去掉任何一条线索，"谁推的""谁下的毒"仍然唯一', () => {
    const all = [...new Set(PUZZLE.constraints.flatMap(c => c.clues))]
    const fragile = necessaryClues(PUZZLE, all)
    // 允许某些细节（如镜像诡计）依赖特定钥匙线索，但凶手身份不能只靠一条线索
    for (const id of fragile) {
      const sols = solveAll(PUZZLE, { limit: 50, clueFilter: c => c !== id })
      const pushers = new Set(sols.map(s => s.pusher))
      const poisoners = new Set(sols.map(s => s.poisoner))
      expect(pushers.size).toBe(1)
      expect(poisoners.size).toBe(1)
    }
  })

  /** 某个角色"单干"（不与别人交换任何东西）能拿到的线索集合；withOptional = 可选角色也有人扮演（替身 NPC 不出场） */
  function soloClues(roleId: string, opts: { withOptional?: boolean } = {}): Set<string> {
    const have = new Set<string>()
    for (const st of SCENARIO.flow) for (const e of st.onEnter ?? []) if ('giveClue' in e && (!e.role || e.role === roleId)) have.add(e.giveClue)
    for (const st of SCENARIO.flow) for (const l of st.lots ?? []) have.add(l.item)
    const ok = (c: Cond | undefined): boolean => {
      if (!c) return true
      if ('hasClue' in c) return have.has(c.hasClue)
      if ('owns' in c) return have.has(c.owns)
      if ('role' in c) return c.role === roleId
      if ('all' in c) return c.all.every(ok)
      if ('any' in c) return c.any.some(ok)
      if ('not' in c) return !ok(c.not)
      return true
    }
    for (let changed = true; changed;) {
      changed = false
      for (const c of SCENARIO.clues) {
        if (!c.location || have.has(c.id)) continue
        if (c.onlyRole && c.onlyRole !== roleId) continue
        if (!ok(c.requires)) continue
        have.add(c.id); changed = true
      }
      for (const n of SCENARIO.npcs) {
        if (!npcCanAppear(n) || (n.standsInFor && opts.withOptional)) continue
        for (const q of n.questions) {
        if (q.onlyRole && q.onlyRole !== roleId) continue
        if (!ok(q.requires) || (q.present && !have.has(q.present))) continue
        for (const g of q.grants ?? []) if (!have.has(g)) { have.add(g); changed = true }
        }
      }
    }
    return have
  }

  const KEY = ['poisoner', 'pusher', 'meiKiller', 'noteAuthor', 'fallTime', 'roseCause'] as const

  test.each(['mandy', 'ethan', 'joan', 'preston'])('单干的 %s 也能唯一推出凶手与时间；曼迪、伊森还能推出 2000 年真凶（三人局、四人局都行）', (roleId) => {
    for (const withOptional of [false, true]) {
      if (roleId === 'preston' && !withOptional) continue
      const have = soloClues(roleId, { withOptional })
      const sols = solveAll(PUZZLE, { limit: 200, clueFilter: id => have.has(id) })
      // 乔安、普雷斯顿单干推不出 2000 年的真凶：那要靠曼迪和伊森手里的东西
      const keys = roleId === 'mandy' || roleId === 'ethan' ? KEY : KEY.filter(k => k !== 'meiKiller')
      for (const k of keys) expect(new Set(sols.map(s => s[k]))).toEqual(new Set([EXPECTED[k]]))
    }
  })

  test('另外两个人的秘密也推得出来：谁在罗丝房里、谁试了保险箱', () => {
    for (const roleId of ['mandy', 'ethan']) {
      for (const withOptional of [false, true]) {
        const have = soloClues(roleId, { withOptional })
        const sols = solveAll(PUZZLE, { limit: 200, clueFilter: id => have.has(id) })
        expect(new Set(sols.map(s => s.roseVisitor))).toEqual(new Set(['joan']))
        expect(new Set(sols.map(s => s.safeIntruder))).toEqual(new Set(['preston']))
      }
    }
  })

  test('非对称钥匙：保险箱需要两人合作；伊森单干推不出曼迪的生父；曼迪单干读不到安保系统日志', () => {
    const e = soloClues('ethan')
    const m = soloClues('mandy')
    for (const id of ['will', 'confession', 'dna', 'mei_diary']) {
      expect(e.has(id)).toBe(false)
      expect(m.has(id)).toBe(false)
    }
    const sols = solveAll(PUZZLE, { limit: 200, clueFilter: id => e.has(id) })
    expect(new Set(sols.map(s => s.mandyFather)).size).toBeGreaterThan(1)
    for (const id of ['door_log', 'cctv_log', 'radio_log', 'printer_log', 'pc_bin', 'frank_log']) expect(m.has(id)).toBe(false)
  })

  test('曼迪和伊森合作（互相出示罗丝的信与钥匙）就能打开保险箱', () => {
    const both = new Set([...soloClues('mandy'), ...soloClues('ethan')])
    const safe = SCENARIO.clues.find(c => c.id === 'will')!
    const ok = (c: Cond): boolean => 'hasClue' in c ? both.has(c.hasClue) : 'role' in c ? c.role === 'mandy' : 'all' in c ? c.all.every(ok) : 'any' in c ? c.any.some(ok) : true
    expect(ok(safe.requires!)).toBe(true)
  })
})

describe('客户端不得引用剧本正文（防止剧透进前端包）', () => {
  function walk(dir: string): string[] {
    const out: string[] = []
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) out.push(...walk(p))
      else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p)
    }
    return out
  }
  const root = join(__dirname, '..', '..', '..')
  const files = [...walk(join(root, 'components', 'mystery')), ...walk(join(root, 'app', 'mystery')), join(root, 'store', 'mysteryStore.ts'), join(root, 'lib', 'mystery', 'client.ts')]

  // 剧本专有名词：人物、线索标题与关键情节词。前端源码里一个都不能出现（终局等界面文字一律由服务器下发）
  const FORBIDDEN = [...new Set([
    ...SCENARIO.roles.flatMap(r => [r.name, r.enName.split(' ')[0]]),
    ...SCENARIO.npcs.flatMap(n => n.name.replace(/医生|大个子/g, '').split(/[·"“”\s]+/)).filter(w => w.length >= 2),
    ...SCENARIO.clues.filter(c => c.kind !== 'item').map(c => c.title).filter(t => t.length >= 3),
    '罗丝', '吉迪恩', '林梅', '遗嘱', '地高辛', '洋地黄', '好外公', '生父', '灯塔', '弗兰克',
  ])]
  const clientFiles = [...files, join(root, 'lib', 'mystery', 'protocol.ts'), join(root, 'components', 'ModeSelect.tsx')]

  test.each(clientFiles)('%s 不含剧本专有名词', (file) => {
    const src = readFileSync(file, 'utf8')
    const hits = FORBIDDEN.filter(w => src.includes(w))
    expect(hits).toEqual([])
  })

  test.each(files)('%s 只引用类型或无剧透模块', (file) => {
    const src = readFileSync(file, 'utf8')
    const imports = [...src.matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm)]
    for (const m of imports) {
      const isType = !!m[1]
      const spec = m[2]
      if (isType) continue
      expect(spec).not.toMatch(/scenarios\/swing-state(?!\/finaleTypes)|scenarios\/index|mystery\/engine$|mystery\/core|testFixture/)
    }
  })
})
