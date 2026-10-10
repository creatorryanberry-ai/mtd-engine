export function standardizeBetterAuthError(error: unknown) {
  let code = 'UNKNOWN'
  let message = 'Unknown error'

  if (error && typeof error === 'object') {
    const errorCode = Reflect.get(error, 'code')
    if (errorCode && typeof errorCode === 'string') {
      code = errorCode
    }

    const errorMessage = Reflect.get(error, 'message')
    if (errorMessage && typeof errorMessage === 'string') {
      message = errorMessage
    }
  }

  return { code, message }
}

function authErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') return message
  }
  return ''
}

/** react-native / fetch connectivity blips — common on app resume */
export function isTransientAuthNetworkError(error: unknown): boolean {
  const message = authErrorMessage(error)
  return /network request failed|failed to fetch|network error|load failed/i.test(message)
}

/**
 * whether onAuthError should show a toast.
 * focus/online refetch runs even when logged out; transient network failures
 * there are not auth failures and must not spam the user.
 */
export function shouldSurfaceAuthErrorToast(
  error: unknown,
  opts: { hasPersistedSession: boolean },
): boolean {
  if (!opts.hasPersistedSession) return false
  if (isTransientAuthNetworkError(error)) return false
  return true
}
