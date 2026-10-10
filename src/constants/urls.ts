import { getURL } from 'one'

import { resolveApiBaseUrl } from './resolveApiBaseUrl'

function urlFromHostname(host: string | undefined): string | null {
  if (!host) return null
  const proto = import.meta.env.VITE_PROTOCOL || process.env.VITE_PROTOCOL || 'https'
  return `${proto}://${host}`
}

function isReactNative() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
}

export const API_BASE_URL = resolveApiBaseUrl({
  apiServerUrl: process.env.API_SERVER_URL,
  apiHostname: import.meta.env.VITE_API_HOSTNAME || process.env.VITE_API_HOSTNAME,
  protocol: import.meta.env.VITE_PROTOCOL || process.env.VITE_PROTOCOL,
  locationOrigin:
    typeof location !== 'undefined' && location.host
      ? `${location.protocol}//${location.host}`
      : undefined,
  isReactNative: isReactNative(),
  fallbackUrl: getURL(),
})

export const SERVER_URL = (() => {
  if (isReactNative()) {
    const fromApi = process.env.API_SERVER_URL?.replace(/\/$/, '')
    if (fromApi) return fromApi
    const fromHost = urlFromHostname(
      import.meta.env.VITE_API_HOSTNAME || process.env.VITE_API_HOSTNAME,
    )
    if (fromHost) return fromHost
  }
  if (typeof location !== 'undefined' && location.host) {
    return `${location.protocol}//${location.host}`
  }

  const url = getURL()
  if (url === 'http://one-server.example.com') {
    const fromWeb = urlFromHostname(
      import.meta.env.VITE_WEB_HOSTNAME || process.env.VITE_WEB_HOSTNAME,
    )
    if (fromWeb) return fromWeb
    const fromApi = urlFromHostname(
      import.meta.env.VITE_API_HOSTNAME || process.env.VITE_API_HOSTNAME,
    )
    if (fromApi) return fromApi
    throw new Error(
      'VITE_WEB_HOSTNAME / VITE_API_HOSTNAME not set — cannot resolve SERVER_URL',
    )
  }
  return url
})()

export const DEFAULT_HOT_UPDATE_SERVER_URL =
  'https://huosdtejcaqhwgpdubyd.supabase.co/functions/v1/update-server'

export const API_URL = `${API_BASE_URL}/api`
export const AUTH_URL = `${API_BASE_URL}/api/auth`
