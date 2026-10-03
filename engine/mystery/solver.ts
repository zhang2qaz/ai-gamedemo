// =====================
// 剧本杀 - 唯一解验证器
// 把“线索 → 约束”编码成有限域约束满足问题，回溯穷举全部解。
// 用于测试：在玩家可获得的线索下，真相必须是唯一解；
// 去掉任一关键线索后，解应当不唯一（证明该线索确实必要）。
// =====================

export type Assignment = Record<string, string>

export type Variable = {
  id: string
  /** 中文说明，如“谁在 23:41 进入书房” */
  desc: string
  domain: string[]
}

export type Constraint = {
  id: string
  /** 支撑该约束的线索 id（全部可见时该约束才成立） */
  clues: string[]
  /** 推理说明（复盘用） */
  desc: string
  /** 涉及的变量（全部赋值后才检查） */
  vars: string[]
  test: (a: Assignment) => boolean
}

export type Puzzle = {
  variables: Variable[]
  constraints: Constraint[]
}

/** 求所有满足约束的赋值；limit 防止爆炸 */
export function solveAll(p: Puzzle, opts: { limit?: number; clueFilter?: (id: string) => boolean } = {}): Assignment[] {
  const limit = opts.limit ?? 1000
  const active = p.constraints.filter(c => !opts.clueFilter || c.clues.every(opts.clueFilter))
  const order = p.variables.map(v => v.id)
  const pos = new Map(order.map((id, i) => [id, i]))
  // 每个约束在其最后一个变量赋值时检查
  const byLast = new Map<number, Constraint[]>()
  for (const c of active) {
    for (const v of c.vars) if (!pos.has(v)) throw new Error(`约束 ${c.id} 引用了未知变量 ${v}`)
    const last = c.vars.length === 0 ? -1 : Math.max(...c.vars.map(v => pos.get(v)!))
    const arr = byLast.get(last) ?? []
    arr.push(c)
    byLast.set(last, arr)
  }
  const out: Assignment[] = []
  const a: Assignment = {}
  for (const c of byLast.get(-1) ?? []) if (!c.test(a)) return out

  function rec(i: number) {
    if (out.length >= limit) return
    if (i === order.length) {
      out.push({ ...a })
      return
    }
    const v = p.variables[i]
    for (const val of v.domain) {
      a[v.id] = val
      let okAll = true
      for (const c of byLast.get(i) ?? []) {
        if (!c.test(a)) { okAll = false; break }
      }
      if (okAll) rec(i + 1)
    }
    delete a[v.id]
  }
  rec(0)
  return out
}

/** 找出“必要线索”：去掉后解不再唯一的线索 */
export function necessaryClues(p: Puzzle, candidateClues: string[]): string[] {
  return candidateClues.filter(id => solveAll(p, { limit: 2, clueFilter: c => c !== id }).length > 1)
}
