import { Platform } from 'react-native'

import { DEMO_EMAIL, DEMO_OTP } from '~/constants/app'

import { authClient, authState, setAuthClientToken } from './authClient'
import { clearExpoAuthStorage } from './clearExpoAuthStorage'

type DemoSignInResult =
  | { success: true; error?: undefined }
  | { success?: undefined; error: { message?: string; status?: number; code?: string } }

function waitForLoggedIn(timeoutMs = 8000) {
  return new Promise<{ ok: true } | { ok: false; reason: string }>((resolve) => {
    if (authState.value?.state === 'logged-in') {
      resolve({ ok: true })
      return
    }

    const timeout = setTimeout(() => {
      unsubscribe()
      resolve({ ok: false, reason: 'Session did not become active in time' })
    }, timeoutMs)

    const unsubscribe = authState.listen((next) => {
      if (next.state === 'logged-in') {
        clearTimeout(timeout)
        unsubscribe()
        resolve({ ok: true })
      }
    })
  })
}

async function finishDemoSignIn(signInResult: {
  data?: { token?: string | null } | null
  error?: { message?: string; status?: number; code?: string } | null
}): Promise<DemoSignInResult> {
  if (signInResult.error) {
    return { error: signInResult.error }
  }

  const token = signInResult.data?.token
  if (typeof token === 'string' && token.length > 0) {
    await setAuthClientToken({ token: '', session: token })
  }

  await authClient.getSession()

  const waited = await waitForLoggedIn()
  if (!waited.ok) {
    return { error: { message: waited.reason, status: 500 } }
  }

  return { success: true }
}

export const signInAsDemo = async (): Promise<DemoSignInResult> => {
  if (Platform.OS !== 'web') {
    clearExpoAuthStorage()
  }

  const sendResult = await authClient.emailOtp.sendVerificationOtp({
    email: DEMO_EMAIL,
    type: 'sign-in',
  })
  if (sendResult.error) {
    return { error: sendResult.error }
  }

  const signInResult = await authClient.signIn.emailOtp({
    email: DEMO_EMAIL,
    otp: DEMO_OTP,
  })

  return finishDemoSignIn(signInResult)
}
