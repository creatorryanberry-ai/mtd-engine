import { isStagingApiHost } from './isStagingApiHost'
import { isVercelPreviewHost } from './isVercelPreviewHost'

/** Real production process: production NODE_ENV, not the staging api host, not a private vercel preview. */
export function isRealProductionRuntime(opts: {
  nodeEnv: string | undefined
  betterAuthUrl: string
  apiServerUrl: string
}): boolean {
  if (opts.nodeEnv !== 'production') return false
  const urls = { betterAuthUrl: opts.betterAuthUrl, apiServerUrl: opts.apiServerUrl }
  return !isStagingApiHost(urls) && !isVercelPreviewHost(urls)
}
