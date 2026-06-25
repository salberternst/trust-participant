import { Readable } from 'node:stream'
import { config } from '../config/index.mjs'

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export async function proxyToPortal(req, res) {
  const target = new URL(req.originalUrl, config.portalUpstreamUrl)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || hopByHopHeaders.has(key.toLowerCase())) continue
    if (Array.isArray(value)) headers.set(key, value.join(','))
    else headers.set(key, value)
  }
  headers.set('x-forwarded-host', req.headers.host ?? '')
  headers.set('x-forwarded-proto', 'http')

  const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET')
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? 'half' : undefined,
  })

  upstream.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) res.setHeader(key, value)
  })
  res.status(upstream.status)
  if (!upstream.body) {
    res.end()
    return
  }
  Readable.fromWeb(upstream.body).pipe(res)
}
