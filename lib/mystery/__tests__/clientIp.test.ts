import { clientIp, trustProxyFromEnv } from '../clientIp'

const req = (headers: Record<string, string>, remoteAddress = '10.1.1.1') => ({ headers, socket: { remoteAddress } })

test('直连部署：忽略客户端自己填的转发头', () => {
  expect(clientIp(req({ 'x-forwarded-for': '198.51.100.7' }), false)).toBe('10.1.1.1')
  expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }), false)).toBe('10.1.1.1')
})

test('受信代理：取代理写入的 X-Real-IP，否则取 X-Forwarded-For 最右一跳（第一跳可被伪造）', () => {
  expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }), true)).toBe('203.0.113.5')
  expect(clientIp(req({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }), true)).toBe('203.0.113.9')
  expect(clientIp(req({}), true)).toBe('10.1.1.1')
})

test('Railway 上自动信任代理，其他环境要显式打开', () => {
  expect(trustProxyFromEnv({})).toBe(false)
  expect(trustProxyFromEnv({ TRUST_PROXY: '1' })).toBe(true)
  expect(trustProxyFromEnv({ RAILWAY_ENVIRONMENT: 'production' })).toBe(true)
})
