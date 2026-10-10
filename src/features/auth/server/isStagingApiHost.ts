/** True when auth/api URLs point at the staging api host. */
export function isStagingApiHost(urls: {
  betterAuthUrl: string
  apiServerUrl: string
}): boolean {
  const haystack = `${urls.betterAuthUrl} ${urls.apiServerUrl}`.toLowerCase()
  return haystack.includes('staging-api.')
}
