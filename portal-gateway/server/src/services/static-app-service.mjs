import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { config } from '../config/index.mjs'

export async function serveOnboardingApp(req, res) {
  const pathname = decodeURIComponent(new URL(req.originalUrl, 'http://localhost').pathname)
  const hasExtension = Boolean(extname(pathname))
  const relativePath = hasExtension ? pathname.replace(/^\/+/, '') : 'index.html'
  const filePath = normalize(join(config.staticDir, relativePath))

  if (!filePath.startsWith(config.staticDir) || !existsSync(filePath)) {
    await sendStaticFile(res, join(config.staticDir, 'index.html'))
    return
  }
  await sendStaticFile(res, filePath)
}

export async function sendStaticFile(res, filePath) {
  res.status(200)
  res.set({
    'Content-Type': contentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  createReadStream(filePath).pipe(res)
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'text/html; charset=utf-8'
  }
}
