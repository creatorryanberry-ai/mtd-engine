import { authClient } from './authClient'
import {
  isTransientAuthNetworkError,
  standardizeBetterAuthError,
} from './betterAuthErrors'

export type SocialProvider = 'google' | 'apple'

export type SocialSignInResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | {
      ok: false
      cancelled?: false
      error: { code: string; message: string }
    }

function isCancelledError(error: unknown) {
  const { code, message } = standardizeBetterAuthError(error)
  return code === 'USER_CANCELLED' || /cancel|cancelled|canceled|dismiss/i.test(message)
}

const androidLocalhostHint =
  "Can't reach the API. On Android, localhost is the device itself — bun android forwards the port with adb reverse."

function toSignInError(error: unknown): SocialSignInResult {
  if (isCancelledError(error)) {
    return { ok: false, cancelled: true }
  }
  if (isTransientAuthNetworkError(error)) {
    return { ok: false, error: { code: 'NETWORK', message: androidLocalhostHint } }
  }
  return { ok: false, error: standardizeBetterAuthError(error) }
}

export async function signInWithSocial(
  provider: SocialProvider,
): Promise<SocialSignInResult> {
  try {
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: '/home/feed',
      errorCallbackURL: '/auth/login',
    })

    if (!error) {
      return { ok: true }
    }
    return toSignInError(error)
  } catch (error) {
    return toSignInError(error)
  }
}
