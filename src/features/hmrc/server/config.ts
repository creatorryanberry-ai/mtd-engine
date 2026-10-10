import { server } from '~/env'

import type { HmrcEnvironment } from '../types'

export function getHmrcEnvironment(): HmrcEnvironment {
  return server.HMRC_ENV === 'production' ? 'production' : 'sandbox'
}

export function isHmrcConfigured() {
  return Boolean(server.HMRC_CLIENT_ID && server.HMRC_CLIENT_SECRET)
}

export function getHmrcUrls() {
  const env = getHmrcEnvironment()

  if (env === 'production') {
    return {
      apiBaseUrl: 'https://api.service.hmrc.gov.uk',
      authorizeUrl: 'https://www.tax.service.gov.uk/oauth/authorize',
      tokenUrl: 'https://api.service.hmrc.gov.uk/oauth/token',
      accountUrl: server.HMRC_ACCOUNT_URL || 'https://www.tax.service.gov.uk/account',
    }
  }

  return {
    apiBaseUrl: 'https://test-api.service.hmrc.gov.uk',
    authorizeUrl: 'https://test-www.tax.service.gov.uk/oauth/authorize',
    tokenUrl: 'https://test-api.service.hmrc.gov.uk/oauth/token',
    accountUrl: 'https://www.tax.service.gov.uk/account',
  }
}

export function getHmrcRedirectUri(platform: 'web' | 'native') {
  if (platform === 'native') {
    return server.HMRC_NATIVE_REDIRECT_URI || 'straightuptax://hmrc/callback'
  }

  return server.HMRC_REDIRECT_URI || `${server.BETTER_AUTH_URL}/api/hmrc/callback`
}

export function requireHmrcConfigured() {
  if (!isHmrcConfigured()) {
    throw new Error('HMRC is not configured')
  }
}
