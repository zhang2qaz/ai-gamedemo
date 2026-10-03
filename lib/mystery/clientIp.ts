// =====================
// 剧本杀 - 取连接的来源 IP（用于按 IP 限流）
// X-Forwarded-For 客户端可以随便填，所以只有部署在受信反向代理后面时才读：
// 优先 X-Real-IP（代理覆盖写入），否则取 X-Forwarded-For 的最右一跳（代理追加的、它看到的客户端地址）。
// 直连部署一律用 TCP 对端地址。
// =====================

import type { IncomingMessage } from 'http'

type Req = Pick<IncomingMessage, 'headers'> & { socket: { remoteAddress?: string } }

export function clientIp(req: Req, trustProxy: boolean): string {
  if (trustProxy) {
    const real = req.headers['x-real-ip']
    const realIp = (Array.isArray(real) ? real[0] : real)?.trim()
    if (realIp) return realIp
    const fwd = req.headers['x-forwarded-for']
    const hops = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return req.socket.remoteAddress || 'unknown'
}

/** Railway 上自动信任它的代理；其他反向代理部署请设置 TRUST_PROXY=1 */
export function trustProxyFromEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env.TRUST_PROXY === '1' || !!env.RAILWAY_ENVIRONMENT
}
