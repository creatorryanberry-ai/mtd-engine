import { describe, expect, it } from 'vitest'

import {
  isAppleSocialConfigured,
  isGoogleSocialConfigured,
  resolveSocialProviderCredentials,
} from '~/features/auth/server/buildSocialProviders'

const empty = {
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  APPLE_CLIENT_ID: '',
  APPLE_TEAM_ID: '',
  APPLE_KEY_ID: '',
  APPLE_PRIVATE_KEY: '',
}

describe('resolveSocialProviderCredentials', () => {
  it('returns no providers when env empty', () => {
    expect(resolveSocialProviderCredentials(empty)).toEqual({})
  })

  it('enables google only when both google vars set', () => {
    expect(
      resolveSocialProviderCredentials({
        ...empty,
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
      }),
    ).toEqual({
      google: { clientId: 'gid', clientSecret: 'gsecret' },
    })
  })

  it('ignores partial google config', () => {
    expect(
      isGoogleSocialConfigured({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: '' }),
    ).toBe(false)
  })

  it('enables apple only when all apple vars set', () => {
    const env = {
      ...empty,
      APPLE_CLIENT_ID: 'com.example.si',
      APPLE_TEAM_ID: 'TEAM',
      APPLE_KEY_ID: 'KEY',
      APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----',
    }
    expect(isAppleSocialConfigured(env)).toBe(true)
    expect(resolveSocialProviderCredentials(env).apple).toEqual({
      clientId: 'com.example.si',
      teamId: 'TEAM',
      keyId: 'KEY',
      privateKey: env.APPLE_PRIVATE_KEY,
    })
  })
})
