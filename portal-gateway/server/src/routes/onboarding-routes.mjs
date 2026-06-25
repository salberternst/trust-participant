import { Router } from 'express'
import {
  buildStateResponse,
  createOnboardingCase,
  refreshOnboarding,
  requestCredentials,
} from '../services/onboarding-service.mjs'

export const onboardingRouter = Router()

onboardingRouter.get('/state', async (req, res) => {
  res.json(await buildStateResponse({ autoProgress: true }))
})

onboardingRouter.post('/cases', async (req, res) => {
  res.status(201).json(await createOnboardingCase(req.body ?? {}))
})

onboardingRouter.post('/credentials/request', async (req, res) => {
  res.json(await requestCredentials())
})

onboardingRouter.post('/refresh', async (req, res) => {
  res.json(await refreshOnboarding())
})
