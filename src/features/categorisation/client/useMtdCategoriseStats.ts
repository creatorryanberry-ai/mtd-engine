import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { mtdTransactionsEmitter } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { CategorisationStats } from './useMtdCategorise'

export function useMtdCategoriseStats() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [stats, setStats] = useState<CategorisationStats>({
    total: 0,
    categorised: 0,
    toReview: 0,
    progress: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      const response = await authFetch<CategorisationStats>('/api/categorisation/stats')
      if (response.error) {
        throw new Error(response.error.message || 'Failed to load categorisation stats')
      }
      setStats(response.data)
    } catch {
      setStats({ total: 0, categorised: 0, toReview: 0, progress: 0 })
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

  return { stats, isLoading, refresh }
}
