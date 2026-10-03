#!/usr/bin/env node
// =====================
// 卡死检测（watchdog）：盯住一个后台任务的"进展信号"，连续 N 秒没有任何进展就报警（可选直接停掉进程）。
//
// 进展信号 = 被盯的文件 / 目录（递归）的总大小与最新修改时间，以及（给了 --pid 时）该进程的 CPU 时间。
// 任何一项变化都算"有进展"，计时清零。
//
// 用法：
//   node scripts/stall-watch.mjs [--idle 300] [--interval 30] [--pid 1234] [--kill] [--done-file 路径] <文件或目录>...
//
// "任务结束"的信号（二选一，必须给，否则任务正常结束后看门狗会误报 STALL）：
//   --pid        进程退出即结束（后台 Bash 命令用这个）
//   --done-file  这个文件出现且非空即结束（Workflow / 子代理：用它的结果输出文件 tasks/<任务ID>.output）
//
// 输出（每行一个事件，适合交给 Claude Code 的 Monitor 当事件流）：
//   STALL ...  连续 --idle 秒无进展（加了 --kill 会先结束 --pid 进程）。退出码 2
//   DONE ...   任务已经结束。退出码 0
// 正常进展时不输出任何东西。
// =====================

import { statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
let idle = 300
let interval = 30
let pid = null
let kill = false
let doneFile = null
const paths = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--idle') idle = Number(args[++i])
  else if (a === '--interval') interval = Number(args[++i])
  else if (a === '--pid') pid = Number(args[++i])
  else if (a === '--kill') kill = true
  else if (a === '--done-file') doneFile = args[++i]
  else if (a === '-h' || a === '--help') {
    console.log('用法：node scripts/stall-watch.mjs [--idle 300] [--interval 30] [--pid PID] [--kill] [--done-file 路径] <文件或目录>...')
    process.exit(0)
  } else paths.push(a)
}
if (!paths.length && !pid) {
  console.error('至少要给一个文件/目录，或者 --pid')
  process.exit(1)
}
if (!(idle > 0) || !(interval > 0)) {
  console.error('--idle / --interval 必须是正数（秒）')
  process.exit(1)
}

/** 目录递归统计（最多 5000 个文件，防止扫太大的目录） */
function measure(p, acc, budget) {
  let st
  try { st = statSync(p) } catch { return }
  if (st.isDirectory()) {
    let entries = []
    try { entries = readdirSync(p) } catch { return }
    for (const e of entries) {
      if (budget.left-- <= 0) return
      measure(join(p, e), acc, budget)
    }
  } else {
    acc.size += st.size
    acc.mtime = Math.max(acc.mtime, st.mtimeMs)
    acc.files++
  }
}

function alive(p) {
  try { process.kill(p, 0); return true } catch (e) { return e.code === 'EPERM' }
}

/** 进程 CPU 时间（ps 在 macOS / Linux 上都有） */
function cpuTime(p) {
  try { return execFileSync('ps', ['-o', 'time=', '-p', String(p)], { encoding: 'utf8' }).trim() } catch { return '' }
}

function signature() {
  const acc = { size: 0, mtime: 0, files: 0 }
  const budget = { left: 5000 }
  for (const p of paths) measure(p, acc, budget)
  return { key: `${acc.size}|${acc.mtime}|${acc.files}|${pid ? cpuTime(pid) : ''}`, ...acc }
}

const stamp = () => new Date().toTimeString().slice(0, 8)
let last = signature()
let lastChange = Date.now()

function doneFileReady() {
  if (!doneFile) return false
  try { return statSync(doneFile).size > 0 } catch { return false }
}

const timer = setInterval(() => {
  if (doneFileReady()) {
    console.log(`${stamp()} DONE 结果文件已生成：${doneFile}`)
    clearInterval(timer)
    process.exit(0)
  }
  if (pid && !alive(pid)) {
    console.log(`${stamp()} DONE 进程 ${pid} 已结束`)
    clearInterval(timer)
    process.exit(0)
  }
  const now = signature()
  if (now.key !== last.key) {
    last = now
    lastChange = Date.now()
    return
  }
  const quiet = Math.round((Date.now() - lastChange) / 1000)
  if (quiet >= idle) {
    const what = [paths.length ? `${paths.join(', ')}（${now.files} 个文件，${now.size} 字节）` : '', pid ? `进程 ${pid}` : ''].filter(Boolean).join('；')
    if (kill && pid) {
      try { process.kill(pid, 'SIGTERM') } catch { /* 已经不在了 */ }
    }
    console.log(`${stamp()} STALL 连续 ${quiet} 秒没有任何进展：${what}${kill && pid ? '；已发送 SIGTERM' : ''}`)
    clearInterval(timer)
    process.exit(2)
  }
}, interval * 1000)
