import { useCallback, useEffect, useRef, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'

import { mtdTransactionsEmitter } from './mtdTransactionsEmitter'

import type { TransactionListTab } from '~/features/mtd/components/TransactionListTabs'
import type { MtdTransactionDto } from '../types'
import type { BankTransactionsResponse } from '../server/transactionsService'

type TransactionListData = {
  transactions: MtdTransactionDto[]
  total: number
}

export function useMtdAccountTransactions(
  bankAccountId: string,
  options?: { mode?: 'tabbed' | 'single'; limit?: number; enabled?: boolean },
) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const mode = options?.mode ?? 'tabbed'
  const limit = options?.limit ?? 50
  const enabled = options?.enabled ?? true
  const refreshGenerationRef = useRef(0)

  const [activeTab, setActiveTab] = useState<TransactionListTab>('for-review')
  const [forReview, setForReview] = useState<TransactionListData>({
    transactions: [],
    total: 0,
  })
  const [categorised, setCategorised] = useState<TransactionListData>({
    transactions: [],
    total: 0,
  })
  const [singleList, setSingleList] = useState<TransactionListData>({
    transactions: [],
    total: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !userId || !bankAccountId) {
      setIsLoading(false)
      return
    }

    const generation = ++refreshGenerationRef.current
    setError(null)

    const accountQuery = `&bankAccountId=${encodeURIComponent(bankAccountId)}`

    try {
      if (mode === 'single') {
        const response = await authFetch<BankTransactionsResponse>(
          `/api/transactions/search?limit=${limit}${accountQuery}`,
        )

        if (generation !== refreshGenerationRef.current) return

        if (response.error) {
          throw new Error(response.error.message || 'Failed to load transactions')
        }

        if (response.data) {
          setSingleList({
            transactions: response.data.transactions,
            total: response.data.total,
          })
        }

        return
      }

      const [forReviewResponse, categorisedResponse] = await Promise.all([
        authFetch<BankTransactionsResponse>(
          `/api/transactions/search?limit=${limit}&excludeReviewed=true${accountQuery}`,
        ),
        authFetch<BankTransactionsResponse>(
          `/api/transactions/search?limit=${limit}&reviewedOnly=true${accountQuery}`,
        ),
      ])

      if (generation !== refreshGenerationRef.current) return

      if (forReviewResponse.error) {
        throw new Error(
          forReviewResponse.error.message || 'Failed to load transactions to review',
        )
      }
      if (categorisedResponse.error) {
        throw new Error(
          categorisedResponse.error.message || 'Failed to load categorised transactions',
        )
      }

      if (forReviewResponse.data) {
        setForReview({
          transactions: forReviewResponse.data.transactions,
          total: forReviewResponse.data.total,
        })
      }
      if (categorisedResponse.data) {
        setCategorised({
          transactions: categorisedResponse.data.transactions,
          total: categorisedResponse.data.total,
        })
      }
    } catch (err) {
      if (generation !== refreshGenerationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      if (generation === refreshGenerationRef.current) {
        setIsLoading(false)
      }
    }
  }, [bankAccountId, enabled, limit, mode, userId])

  useEffect(() => {
    if (!enabled) return
    setIsLoading(true)
    void refresh()
  }, [enabled, refresh])

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh()
  })

  const activeList =
    mode === 'single' ? singleList : activeTab === 'for-review' ? forReview : categorised

  return {
    mode,
    activeTab,
    setActiveTab,
    forReviewCount: forReview.total,
    categorisedCount: categorised.total,
    transactions: activeList.transactions,
    total: activeList.total,
    showingCount: activeList.transactions.length,
    isLoading,
    error,
    refresh,
  }
}
