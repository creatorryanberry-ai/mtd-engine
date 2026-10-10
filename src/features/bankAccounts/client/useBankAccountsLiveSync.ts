import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { isWeb } from 'tamagui'

import { authFetch } from '~/features/auth/client/authFetch'

import type { BankAccountsStatus } from './useMtdBankAccounts'

/** How often to check for cross-device transaction changes while bank screens are open. */
const LIVE_SYNC_POLL_MS = 1_000

function statusChanged(current: BankAccountsStatus, next: BankAccountsStatus) {
  return (
    current.transactionCount !== next.transactionCount ||
    current.lastSyncedAt !== next.lastSyncedAt
  )
}

export function useBankAccountsLiveSync(
  userId: string | undefined,
  status: BankAccountsStatus,
  refresh: () => void | Promise<void>,
) {
  const statusRef = useRef(status)
  statusRef.current = status

  useEffect(() => {
    if (!userId) return

    let cancelled = false

    const checkForChanges = async () => {
      if (
        isWeb &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return
      }

      const response = await authFetch<BankAccountsStatus>('/api/bank-accounts/status')
      if (cancelled || response.error || !response.data) return

      if (statusChanged(statusRef.current, response.data)) {
        void refresh()
      }
    }

    const interval = setInterval(() => void checkForChanges(), LIVE_SYNC_POLL_MS)

    if (isWeb && typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          void checkForChanges()
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        cancelled = true
        clearInterval(interval)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void checkForChanges()
      }
    }
    const subscription = AppState.addEventListener('change', onAppState)

    return () => {
      cancelled = true
      clearInterval(interval)
      subscription.remove()
    }
  }, [userId, refresh])
}
