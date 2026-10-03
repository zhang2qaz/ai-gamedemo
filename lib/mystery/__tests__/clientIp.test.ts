import { clientIp, trustProxyFromEnv } from '../clientIp'

const req = (headers: Record<string, string>, remoteAddress = '10.1.1.1') => ({ headers, socket: { remoteAddress } })

test('直连部署：忽略客户端自己填的转发头', () => {
  expect(clientIp(req({ 'x-forwarded-for': '198.51.100.7' }), false)).toBe('10.1.1.1')
  expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }), false)).toBe('10.1.1.1')
})

test('受信代理：只取 X-Forwarded-For 最右一跳（前面的跳与 X-Real-IP 都可能是客户端伪造的）', () => {
  expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }), 'xff')).toBe('203.0.113.5')
  expect(clientIp(req({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '203.0.113.5' }), 'xff')).toBe('203.0.113.5')
  expect(clientIp(req({}), 'xff')).toBe('10.1.1.1')
})

test('代理会覆盖写入 X-Real-IP 时才用它（TRUST_PROXY=real-ip）', () => {
  expect(clientIp(req({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '6.6.6.6, 203.0.113.5' }), 'real-ip')).toBe('203.0.113.9')
})

test('Railway 上默认按 X-Forwarded-For 最右一跳；其他环境要显式打开', () => {
  expect(trustProxyFromEnv({})).toBe(false)
  expect(trustProxyFromEnv({ TRUST_PROXY: '1' })).toBe('xff')
  expect(trustProxyFromEnv({ TRUST_PROXY: 'real-ip' })).toBe('real-ip')
  expect(trustProxyFromEnv({ RAILWAY_ENVIRONMENT: 'production' })).toBe('xff')
})
