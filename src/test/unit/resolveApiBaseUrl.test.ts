import { describe, expect, it } from 'vitest'

import { resolveApiBaseUrl } from '~/constants/resolveApiBaseUrl'

describe('resolveApiBaseUrl', () => {
  it('prefers API_SERVER_URL over hostname and location', () => {
    expect(
      resolveApiBaseUrl({
        apiServerUrl: 'https://staging-api.straightup.tax/',
        apiHostname: 'localhost:8082',
        protocol: 'http',
        locationOrigin: 'http://localhost:8082',
        isReactNative: true,
      }),
    ).toBe('https://staging-api.straightup.tax')
  })

  it('does not use the metro location on react native', () => {
    expect(
      resolveApiBaseUrl({
        apiHostname: 'staging-api.straightup.tax',
        protocol: 'https',
        locationOrigin: 'http://localhost:8082',
        isReactNative: true,
      }),
    ).toBe('https://staging-api.straightup.tax')
  })

  it('ignores react native bundler location when no api host is set', () => {
    expect(() =>
      resolveApiBaseUrl({
        locationOrigin: 'http://localhost:8082',
        isReactNative: true,
        fallbackUrl: 'http://one-server.example.com',
      }),
    ).toThrow(/VITE_API_HOSTNAME/)
  })
})
