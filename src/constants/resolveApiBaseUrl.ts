const ONE_PLACEHOLDER = 'http://one-server.example.com'

export function resolveApiBaseUrl(input: {
  apiServerUrl?: string
  apiHostname?: string
  protocol?: string
  locationOrigin?: string
  isReactNative?: boolean
  fallbackUrl?: string
}) {
  const server = input.apiServerUrl?.replace(/\/$/, '')
  if (server) return server
  if (input.apiHostname) {
    const proto = input.protocol || 'https'
    return `${proto}://${input.apiHostname}`
  }
  if (!input.isReactNative && input.locationOrigin) return input.locationOrigin
  if (input.fallbackUrl && input.fallbackUrl !== ONE_PLACEHOLDER) return input.fallbackUrl
  throw new Error('VITE_API_HOSTNAME not set — cannot resolve API_BASE_URL')
}
