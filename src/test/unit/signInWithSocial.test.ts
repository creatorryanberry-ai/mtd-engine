import { beforeEach, describe, expect, it, vi } from 'vitest'

const { social } = vi.hoisted(() => ({
  social: vi.fn(),
}))

vi.mock('~/features/auth/client/authClient', () => ({
  authClient: {
    signIn: {
      social,
    },
  },
}))

import { signInWithSocial } from '~/features/auth/client/signInWithSocial'

describe('signInWithSocial', () => {
  beforeEach(() => {
    social.mockReset()
  })

  it('starts social sign-in with the native callback path', async () => {
    social.mockResolvedValue({ data: { redirect: true }, error: null })

    await expect(signInWithSocial('google')).resolves.toEqual({ ok: true })
    expect(social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/home/feed',
      errorCallbackURL: '/auth/login',
    })
  })

  it('returns cancellation without an error', async () => {
    social.mockResolvedValue({
      data: null,
      error: { code: 'USER_CANCELLED', message: 'User cancelled' },
    })

    await expect(signInWithSocial('apple')).resolves.toEqual({
      ok: false,
      cancelled: true,
    })
  })

  it('recognizes dismissed authentication as cancellation', async () => {
    social.mockResolvedValue({
      data: null,
      error: { message: 'Authentication dismissed' },
    })

    await expect(signInWithSocial('google')).resolves.toEqual({
      ok: false,
      cancelled: true,
    })
  })

  it('returns a standardized authentication error', async () => {
    social.mockResolvedValue({
      data: null,
      error: { code: 'PROVIDER_ERROR', message: 'Provider unavailable' },
    })

    await expect(signInWithSocial('apple')).resolves.toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Provider unavailable',
      },
    })
  })

  it('maps thrown react-native network failures to a reachable error', async () => {
    social.mockRejectedValue(new TypeError('Network request failed'))

    await expect(signInWithSocial('google')).resolves.toEqual({
      ok: false,
      error: {
        code: 'NETWORK',
        message: expect.stringContaining('adb reverse'),
      },
    })
  })
})
