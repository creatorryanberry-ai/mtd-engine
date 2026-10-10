import { isStagingApiHost } from './isStagingApiHost'

/** Real production process: production NODE_ENV and not the staging api host. */
export function isRealProductionRuntime(opts: {
  nodeEnv: string | undefined
  betterAuthUrl: string
  apiServerUrl: string
}): boolean {
  if (opts.nodeEnv !== 'production') return false
  return !isStagingApiHost({
    betterAuthUrl: opts.betterAuthUrl,
    apiServerUrl: opts.apiServerUrl,
  })
}
