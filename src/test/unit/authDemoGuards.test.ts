import { describe, expect, it } from 'vitest'

import { assertDemoAuthFlagsSafe } from '~/features/auth/server/assertDemoAuthFlagsSafe'
import { isRealProductionRuntime } from '~/features/auth/server/isRealProductionRuntime'
import { isStagingApiHost } from '~/features/auth/server/isStagingApiHost'

describe('isStagingApiHost', () => {
  it('detects staging-api in either url', () => {
    expect(
      isStagingApiHost({
        betterAuthUrl: 'https://staging-api.straightup.tax',
        apiServerUrl: 'https://staging-api.straightup.tax',
      }),
    ).toBe(true)
    expect(
      isStagingApiHost({
        betterAuthUrl: 'https://api.straightup.tax',
        apiServerUrl: 'https://staging-api.straightup.tax',
      }),
    ).toBe(true)
  })

  it('is false for production hosts', () => {
    expect(
      isStagingApiHost({
        betterAuthUrl: 'https://api.straightup.tax',
        apiServerUrl: 'https://api.straightup.tax',
      }),
    ).toBe(false)
  })
})

describe('isRealProductionRuntime', () => {
  it('is false outside production NODE_ENV', () => {
    expect(
      isRealProductionRuntime({
        nodeEnv: 'development',
        betterAuthUrl: 'https://api.straightup.tax',
        apiServerUrl: 'https://api.straightup.tax',
      }),
    ).toBe(false)
  })

  it('is false for staging host in production mode', () => {
    expect(
      isRealProductionRuntime({
        nodeEnv: 'production',
        betterAuthUrl: 'https://staging-api.straightup.tax',
        apiServerUrl: 'https://staging-api.straightup.tax',
      }),
    ).toBe(false)
  })

  it('is true for real production host', () => {
    expect(
      isRealProductionRuntime({
        nodeEnv: 'production',
        betterAuthUrl: 'https://api.straightup.tax',
        apiServerUrl: 'https://api.straightup.tax',
      }),
    ).toBe(true)
  })
})

describe('assertDemoAuthFlagsSafe', () => {
  it('allows demo flags outside real production', () => {
    expect(() =>
      assertDemoAuthFlagsSafe({
        isRealProduction: false,
        allowDemoAuth: '1',
        viteDemoMode: '1',
      }),
    ).not.toThrow()
  })

  it('allows empty flags on real production', () => {
    expect(() =>
      assertDemoAuthFlagsSafe({
        isRealProduction: true,
        allowDemoAuth: '',
        viteDemoMode: '',
      }),
    ).not.toThrow()
  })

  it('rejects ALLOW_DEMO_AUTH on real production', () => {
    expect(() =>
      assertDemoAuthFlagsSafe({
        isRealProduction: true,
        allowDemoAuth: '1',
        viteDemoMode: '',
      }),
    ).toThrow(/ALLOW_DEMO_AUTH/)
  })

  it('rejects VITE_DEMO_MODE on real production', () => {
    expect(() =>
      assertDemoAuthFlagsSafe({
        isRealProduction: true,
        allowDemoAuth: '',
        viteDemoMode: 'true',
      }),
    ).toThrow(/VITE_DEMO_MODE/)
  })
})
