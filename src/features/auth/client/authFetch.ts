import { createFetch } from '@better-fetch/fetch'

import { API_BASE_URL } from '~/constants/urls'

import { authState } from './authClient'

export function getAuthToken(): string | undefined {
  return authState.value?.session?.token
}

export const authFetch = createFetch({
  baseURL: API_BASE_URL,
  auth: {
    type: 'Bearer',
    token: () => {
      const sessionToken = getAuthToken()
      if (!sessionToken) {
        console.warn(`No session token, authFetch will fail`)
      }
      return sessionToken
    },
  },
})

export function getAuthFetchErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }

    if ('error' in error) {
      const nested = (error as { error: unknown }).error
      if (typeof nested === 'string') return nested
      if (
        nested &&
        typeof nested === 'object' &&
        'message' in nested &&
        typeof nested.message === 'string'
      ) {
        return nested.message
      }
    }
  }

  return fallback
}
