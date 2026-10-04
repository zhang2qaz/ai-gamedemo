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
import { clientIp, trustProxyFromEnv } from './lib/mystery/clientIp'

const dev = process.env.DEV_MODE === '1'  // 默认 production；DEV_MODE=1 启用 HMR + 详细错误
const listenHost = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)
// 只接受站内路径（以单个 / 开头），避免被配成跳到别的网站
const homePath = /^\/(?!\/)[\w\-/]*$/.test(process.env.HOME_PATH ?? '') ? process.env.HOME_PATH! : ''

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

    // 健康检查（云托管平台用来确认服务已启动）
    if (parsedUrl.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    // 部署到网上时可以让首页直接进入某个游戏（如 HOME_PATH=/mystery），网址更短、更好分享
    if (homePath && parsedUrl.pathname === '/') {
      res.writeHead(302, { Location: homePath + (parsedUrl.search ?? ''), 'Cache-Control': 'no-store' })
      res.end()
      return
    }

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
  // 来源 IP（建房 / 加入失败按 IP 限流）：只有在受信反向代理后面才读转发头（见 lib/mystery/clientIp.ts）
  const trustProxy = trustProxyFromEnv()
  mysteryWss.on('connection', (ws, req) => {
    mysteryHub.attach(ws, clientIp(req, trustProxy))
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
