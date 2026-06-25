import vm from 'node:vm'
import { join } from 'node:path'
import { config } from '../config/index.mjs'
import { isPlainObject, pruneUndefined } from '../lib/objects.mjs'
import { sendStaticFile } from './static-app-service.mjs'

export async function serveSanitizedPortalConfig(res) {
  try {
    const upstream = await fetch(`${config.portalUpstreamUrl}/config.js`)
    if (upstream.ok) {
      const publicConfig = extractPublicThemeConfig(await upstream.text())
      if (publicConfig) {
        res.set({
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.send(`window.config = ${JSON.stringify(publicConfig)};
`)
        return
      }
    }
  } catch {
    // Fall back to the bundled default theme when the portal is not reachable yet.
  }

  await sendStaticFile(res, join(config.staticDir, 'config.js'))
}

function extractPublicThemeConfig(source) {
  const sandbox = { window: {}, config: undefined }
  vm.runInNewContext(source, sandbox, { timeout: 50 })
  const runtimeConfig = sandbox.window.config ?? sandbox.config
  if (!runtimeConfig || typeof runtimeConfig !== 'object') return null

  return pruneUndefined({
    title: typeof runtimeConfig.title === 'string' ? runtimeConfig.title : undefined,
    theme: sanitizeTheme(runtimeConfig.theme),
  })
}

function sanitizeTheme(theme) {
  if (!theme || typeof theme !== 'object') return undefined
  return pruneUndefined({
    light: sanitizeThemeMode(theme.light),
    dark: sanitizeThemeMode(theme.dark),
  })
}

function sanitizeThemeMode(mode) {
  if (!mode || typeof mode !== 'object') return undefined
  return pruneUndefined({
    palette: sanitizePalette(mode.palette),
    typography: isPlainObject(mode.typography) ? mode.typography : undefined,
    spacing: typeof mode.spacing === 'number' ? mode.spacing : undefined,
    shape: isPlainObject(mode.shape) ? mode.shape : undefined,
    sidebarWidth: typeof mode.sidebarWidth === 'number' ? mode.sidebarWidth : undefined,
    logo: sanitizeLogo(mode.logo),
  })
}

function sanitizePalette(palette) {
  if (!palette || typeof palette !== 'object') return undefined
  return pruneUndefined({
    primary: sanitizeColorGroup(palette.primary),
    secondary: sanitizeColorGroup(palette.secondary),
    background: sanitizeColorGroup(palette.background),
    text: sanitizeColorGroup(palette.text),
    error: sanitizeColorGroup(palette.error),
    warning: sanitizeColorGroup(palette.warning),
    info: sanitizeColorGroup(palette.info),
    success: sanitizeColorGroup(palette.success),
    mode: typeof palette.mode === 'string' ? palette.mode : undefined,
  })
}

function sanitizeColorGroup(group) {
  if (!group || typeof group !== 'object') return undefined
  return Object.fromEntries(Object.entries(group).filter(([, value]) => typeof value === 'string'))
}

function sanitizeLogo(logo) {
  if (!logo || typeof logo !== 'object') return undefined
  return pruneUndefined({
    src: typeof logo.src === 'string' ? logo.src : undefined,
    alt: typeof logo.alt === 'string' ? logo.alt : undefined,
    sx: isPlainObject(logo.sx) ? logo.sx : undefined,
  })
}
