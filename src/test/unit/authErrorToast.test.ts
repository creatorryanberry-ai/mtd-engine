import { describe, expect, it } from 'vitest'

import { shouldSurfaceAuthErrorToast } from '~/features/auth/client/betterAuthErrors'

describe('shouldSurfaceAuthErrorToast', () => {
  it('suppresses react-native network failures after app resume', () => {
    expect(
      shouldSurfaceAuthErrorToast(
        { message: 'Network request failed' },
        { hasPersistedSession: false },
      ),
    ).toBe(false)
  })

  it('suppresses network failures even when a session was persisted', () => {
    // focus refetch often fails briefly when returning from background;
    // retries handle recovery — toasting "Auth error" is noise
    expect(
      shouldSurfaceAuthErrorToast(
        { message: 'Network request failed' },
        { hasPersistedSession: true },
      ),
    ).toBe(false)
  })

  it('suppresses failed-to-fetch style browser errors when logged out', () => {
    expect(
      shouldSurfaceAuthErrorToast(
        { message: 'Failed to fetch' },
        { hasPersistedSession: false },
      ),
    ).toBe(false)
  })

  it('surfaces real auth errors when a session was expected', () => {
    expect(
      shouldSurfaceAuthErrorToast(
        { message: 'UNAUTHORIZED', status: 401 },
        { hasPersistedSession: true },
      ),
    ).toBe(true)
  })

  it('does not surface errors when already logged out with no session', () => {
    expect(
      shouldSurfaceAuthErrorToast(
        { message: 'UNAUTHORIZED', status: 401 },
        { hasPersistedSession: false },
      ),
    ).toBe(false)
  })
})
