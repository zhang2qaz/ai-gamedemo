// =====================
// 剧本杀 - 取连接的来源 IP（用于按 IP 限流）
// X-Forwarded-For 客户端可以随便填，所以只有部署在受信反向代理后面时才读，并且只取最右一跳
// （受信代理追加的、它看到的客户端地址；前面的跳都可能是客户端伪造的）。
// X-Real-IP 只有在明确知道代理会覆盖写入时才可用（TRUST_PROXY=real-ip），否则客户端也能自己填。
// 直连部署一律用 TCP 对端地址。
// =====================

import type { IncomingMessage } from 'http'

type Req = Pick<IncomingMessage, 'headers'> & { socket: { remoteAddress?: string } }

export type TrustProxy = false | 'xff' | 'real-ip'

export function clientIp(req: Req, trust: TrustProxy | boolean): string {
  const mode: TrustProxy = trust === true ? 'xff' : trust
  if (mode === 'real-ip') {
    const real = req.headers['x-real-ip']
    // 多个值（被 Node 拼接）时取最后一个：代理写入的在最后
    const parts = (Array.isArray(real) ? real.join(',') : real ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  if (mode) {
    const fwd = req.headers['x-forwarded-for']
    const hops = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }
  return req.socket.remoteAddress || 'unknown'
}

/**
 * TRUST_PROXY=1：在受信反向代理后面，取 X-Forwarded-For 最右一跳；
 * TRUST_PROXY=real-ip：代理会覆盖写入 X-Real-IP 时用它；
 * Railway 上默认按 1 处理。
 */
export function trustProxyFromEnv(env: Record<string, string | undefined> = process.env): TrustProxy {
  if (env.TRUST_PROXY === 'real-ip') return 'real-ip'
  if (env.TRUST_PROXY === '1' || !!env.RAILWAY_ENVIRONMENT) return 'xff'
  return false
}
