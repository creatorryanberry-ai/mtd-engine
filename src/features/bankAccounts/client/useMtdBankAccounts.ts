import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { formatLastUpdated } from '~/features/mtd/utils/formatLastUpdated'
import { TRANSACTION_WINDOW_DAYS } from '~/features/bankAccounts/constants'

import { mtdTransactionsEmitter } from './mtdTransactionsEmitter'
import { useBankAccountsLiveSync } from './useBankAccountsLiveSync'

export type BankAccountsStatus = {
  lastSyncedAt: string | null
  transactionCount: number
  syncWindowDays: number
}

export type BankAccountDto = {
  id: string
  userId: string
  bankLinkItemId: string
  externalAccountId: string
  institutionName: string | null
  accountName: string | null
  sortCode: string | null
  accountNumber: string | null
  accountType: string | null
  balance: number | null
  currency: string | null
  lastSyncedAt: string | null
  syncError: string | null
  transactionCount: number
  unreviewedCount: number
}

type BankAccountsResponse = {
  accounts: BankAccountDto[]
}

export { formatLastUpdated } from '~/features/mtd/utils/formatLastUpdated'

export function useMtdBankAccounts() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [status, setStatus] = useState<BankAccountsStatus>({
    lastSyncedAt: null,
    transactionCount: 0,
    syncWindowDays: TRANSACTION_WINDOW_DAYS,
  })
  const [accounts, setAccounts] = useState<BankAccountDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    setError(null)

    try {
      const [statusResponse, accountsResponse] = await Promise.all([
        authFetch<BankAccountsStatus>('/api/bank-accounts/status'),
        authFetch<BankAccountsResponse>('/api/bank-accounts'),
      ])

      if (accountsResponse.error) {
        throw new Error(accountsResponse.error.message || 'Failed to load bank accounts')
      }

      if (accountsResponse.data) {
        setAccounts(accountsResponse.data.accounts)
      }

      if (statusResponse.error) {
        setError(statusResponse.error.message || 'Failed to load bank account status')
      } else if (statusResponse.data) {
        setStatus(statusResponse.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank accounts')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh()
  })

  useBankAccountsLiveSync(userId, status, refresh)

  return {
    status,
    accounts,
    lastUpdatedLabel: formatLastUpdated(status.lastSyncedAt),
    syncWindowDays: status.syncWindowDays || TRANSACTION_WINDOW_DAYS,
    isLoading,
    error,
    refresh,
  }
}
