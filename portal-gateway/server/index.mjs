import { createApp } from './src/app.mjs'
import { config } from './src/config/index.mjs'
import { closePool } from './src/db/pool.mjs'

const app = createApp()
const server = app.listen(config.port, () => {
  console.log(`participant portal gateway listening on ${config.port}`)
})

process.on('SIGTERM', async () => {
  server.close()
  await closePool().catch(() => undefined)
})
