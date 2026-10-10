import { AsyncLocalStorage } from 'node:async_hooks'
import { setupAsyncLocalStorage } from '@mtd/helpers'

import { initializeErrorHandling } from './features/errors/setupErrorHandling'
import { initializeLogger } from './features/logger/logger'

async function setup() {
  if (process.env.ONE_RENDER_MODE === 'ssg') {
    return
  }

  console.info(`[server] start (SHA: ${process.env.GIT_SHA})`)

  setupAsyncLocalStorage(AsyncLocalStorage)
  initializeErrorHandling()
  initializeLogger()
}

await setup()

export {}
