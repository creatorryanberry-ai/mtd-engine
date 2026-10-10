/**
 * private vercel previews (docs/engine-vercel.md) sit behind vercel
 * authentication on *.vercel.app; real production is served from our own domains.
 */
export function isVercelPreviewHost(urls: {
  betterAuthUrl: string
  apiServerUrl: string
}) {
  return [urls.betterAuthUrl, urls.apiServerUrl].every((url) => {
    try {
      return new URL(url).hostname.endsWith('.vercel.app')
    } catch {
      return false
    }
  })
}
