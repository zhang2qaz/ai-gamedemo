// =====================
// 弈战 - 自定义服务器（WebSocket + Next.js）
// =====================

// 注册 tsconfig paths 以支持 @/ 别名
import { register } from 'tsconfig-paths'
import { resolve } from 'path'

register({
  baseUrl: resolve(__dirname),
  paths: { '@/*': ['./*'] },
})

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer } from 'ws'
import { networkInterfaces } from 'os'
import { RoomManager } from './lib/multiplayer/roomManager'
import { MysteryHub } from './lib/mystery/hub'
import { MYSTERY_WS_PATH } from './lib/mystery/protocol'

const dev = process.env.DEV_MODE === '1'  // 默认 production；DEV_MODE=1 启用 HMR + 详细错误
const listenHost = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname: listenHost, port })
const handle = app.getRequestHandler()

// 获取本机局域网 IP
function getLocalIp(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)

    // API: 获取网络信息
    if (parsedUrl.pathname === '/api/network-info') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ip: getLocalIp(),
        port,
        roomCode: room.roomCode,
      }))
      return
    }

    // HTML 页面不缓存，确保每次拿到最新版本
    if (!parsedUrl.pathname || parsedUrl.pathname === '/' || !parsedUrl.pathname.includes('.')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
    }

    handle(req, res, parsedUrl)
  })

  // WebSocket 服务器
  const wss = new WebSocketServer({ noServer: true })
  const room = new RoomManager()

  // 剧本杀（2 人，多房间，服务器即 DM）
  const mysteryWss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  const mysteryHub = new MysteryHub()
  // 心跳：30 秒没回 pong 的连接视为已断（手机休眠、切网后的"半开"连接），及时让对方看到离线
  const mysteryAlive = new WeakMap<object, boolean>()
  mysteryWss.on('connection', (ws, req) => {
    // 来源 IP（建房 / 加入失败按 IP 限流）。部署在反向代理（如 Railway）后面时取 X-Forwarded-For 的第一跳
    const fwd = req.headers['x-forwarded-for']
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
    mysteryHub.attach(ws, ip)
    mysteryAlive.set(ws, true)
    ws.on('pong', () => mysteryAlive.set(ws, true))
    ws.on('message', (data) => {
      mysteryAlive.set(ws, true)
      mysteryHub.handleMessage(ws, data.toString())
    })
    ws.on('close', () => mysteryHub.handleClose(ws))
    ws.on('error', () => mysteryHub.handleClose(ws))
  })
  const mysteryHeartbeat = setInterval(() => {
    for (const ws of mysteryWss.clients) {
      if (!mysteryAlive.get(ws)) {
        ws.terminate()
        continue
      }
      mysteryAlive.set(ws, false)
      try { ws.ping() } catch { /* 忽略 */ }
    }
  }, 30_000)
  mysteryHeartbeat.unref()

  const localIp = getLocalIp()
  console.log(`\n🎮 弈战 多人联机服务器`)
  console.log(`   房间号: ${room.roomCode}`)
  console.log(`   本机访问: http://localhost:${port}`)
  console.log(`   局域网访问: http://${localIp}:${port}`)
  console.log(`   其他玩家打开上方链接，输入房间号 ${room.roomCode} 加入`)
  console.log(`   🕵️ 双人剧本杀: http://${localIp}:${port}/mystery\n`)

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url ?? '/', true)
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else if (pathname === MYSTERY_WS_PATH) {
      mysteryWss.handleUpgrade(req, socket, head, (ws) => {
        mysteryWss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      room.handleMessage(ws, data.toString())
    })

    ws.on('close', () => {
      room.handleDisconnect(ws)
    })

    ws.on('error', () => {
      room.handleDisconnect(ws)
    })
  })

  server.listen(port, listenHost, () => {
    console.log(`✓ 服务器已启动 http://${localIp}:${port}\n`)
  })
})
