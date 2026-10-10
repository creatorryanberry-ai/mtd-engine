'use no memo'
import { createBetterAuthClient } from '@mtd/better-auth-utils'
import { href } from 'one'
import { useMemo } from 'react'

import { API_BASE_URL } from '~/constants/urls'
import { setUser } from '~/features/user/getUser'
import { showToast } from '~/interface/toast/Toast'

import { shouldSurfaceAuthErrorToast } from './betterAuthErrors'
import { clearExpoAuthStorage } from './clearExpoAuthStorage'
import { plugins, resetAuthPlugins } from './plugins'

import type { User } from 'better-auth'
import type { AuthData } from '~/features/auth/types'

type AppUser = User & { role?: 'admin' }

// the auth client retries failed session fetches on a timer, so onAuthError can
// fire repeatedly (e.g. offline / unreachable server). only surface one toast
// until auth recovers, so we don't spam the user with the same error.
let hasShownAuthErrorToast = false

const betterAuthClient = createBetterAuthClient({
  baseURL: API_BASE_URL,
  plugins,
  createUser: (user) => user as AppUser,
  onClearAuth: () => {
    clearExpoAuthStorage()
    resetAuthPlugins()
  },
  onAuthStateChange: (state) => {
    setUser(state.user)
    if (state.state === 'logged-in' || state.state === 'logged-out') {
      hasShownAuthErrorToast = false
    }
  },
  onAuthError: (error: any) => {
    if (hasShownAuthErrorToast) {
      return
    }
    const hasPersistedSession = !!betterAuthClient.getAuth().session?.token
    if (!shouldSurfaceAuthErrorToast(error, { hasPersistedSession })) {
      return
    }
    hasShownAuthErrorToast = true
    showToast(`Auth error: ${error.message || JSON.stringify(error)}`, {
      type: 'error',
    })
  },
})

export const useAuth = () => {
  const auth = betterAuthClient.useAuth()
  const authUserId = auth?.user?.id
  const authUserRole = auth?.user?.role

  const authData = useMemo((): AuthData | null => {
    if (!authUserId) {
      return null
    }
    return {
      id: authUserId,
      role: authUserRole,
    }
  }, [authUserId, authUserRole])

  return {
    ...auth,
    authClient: betterAuthClient.authClient,
    authData,
    loginText: auth.state === 'logged-in' ? 'Account' : 'Login',
    loginLink: href(auth.state === 'logged-in' ? '/home/feed' : '/auth/login'),
  }
}

export const {
  setAuthClientToken,
  clearAuthClientToken,
  clearAllAuth,
  authState,
  authClient,
} = betterAuthClient
