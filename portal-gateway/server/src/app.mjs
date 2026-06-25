import express from 'express'
import { onboardingRouter } from './routes/onboarding-routes.mjs'
import { errorHandler } from './routes/error-handler.mjs'
import { ensureDb } from './db/state-repository.mjs'
import { isOnboarded } from './services/onboarding-service.mjs'
import { serveSanitizedPortalConfig } from './services/portal-config-service.mjs'
import { proxyToPortal } from './services/portal-proxy-service.mjs'
import { serveOnboardingApp } from './services/static-app-service.mjs'

export function createApp() {
  const app = express()

  app.get('/health', async (req, res) => {
    await ensureDb()
    res.json({ status: 'ok' })
  })

  app.use('/api/onboarding', express.json(), onboardingRouter)

  app.get('/config.js', async (req, res) => {
    await serveSanitizedPortalConfig(res)
  })

  app.use(async (req, res) => {
    if (await isOnboarded()) {
      await proxyToPortal(req, res)
      return
    }

    await serveOnboardingApp(req, res)
  })

  app.use(errorHandler)
  return app
}
