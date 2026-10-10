import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { getHmrcCategoryLabel } from '~/features/mtd/categories/hmrcCategories'
import {
  mtdTransactionsEmitter,
  notifyMtdTransactionsChanged,
} from '~/features/bankAccounts/client/mtdTransactionsEmitter'
import { useUpdateTransactionCategory } from '~/features/categorisation/client/useUpdateTransactionCategory'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

export type CategorisationStats = {
  total: number
  categorised: number
  toReview: number
  progress: number
  filterCounts?: Record<string, number>
}

export type TransactionFilter = 'to-review' | 'all' | 'income' | 'expenses' | 'transfers'
export type TransactionSort = 'newest' | 'oldest'

type TransactionsResponse = {
  transactions: MtdTransactionDto[]
  total: number
  showing: number
  offset: number
  limit: number
}

const PAGE_SIZE = 8

function recomputeStats(
  stats: CategorisationStats,
  delta: { categorised?: number; toReview?: number },
): CategorisationStats {
  const categorised = Math.max(0, stats.categorised + (delta.categorised ?? 0))
  const toReview = Math.max(0, stats.toReview + (delta.toReview ?? 0))
  const total = stats.total
  const progress = total > 0 ? Math.round((categorised / total) * 100) : 0
  return { ...stats, categorised, toReview, progress }
}

export function useMtdCategorise(bankAccountId?: string) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { updateCategory, approveTransactions } = useUpdateTransactionCategory()

  const [stats, setStats] = useState<CategorisationStats>({
    total: 0,
    categorised: 0,
    toReview: 0,
    progress: 0,
  })
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({})
  const [transactions, setTransactions] = useState<MtdTransactionDto[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<TransactionFilter>('to-review')
  const [sort, setSort] = useState<TransactionSort>('newest')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isReviewing, setIsReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  const transactionsRef = useRef(transactions)
  transactionsRef.current = transactions
  const refreshGenerationRef = useRef(0)

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    const generation = ++refreshGenerationRef.current
    setError(null)
    const offset = (page - 1) * PAGE_SIZE
    const accountQuery = bankAccountId
      ? `&bankAccountId=${encodeURIComponent(bankAccountId)}`
      : ''

    try {
      const [statsResponse, transactionsResponse] = await Promise.all([
        authFetch<CategorisationStats>(
          `/api/categorisation/stats?filters=true&unreviewedOnly=true${accountQuery}`,
        ),
        authFetch<TransactionsResponse>(
          `/api/transactions/search?limit=${PAGE_SIZE}&offset=${offset}&filter=${filter}&sort=${sort}&excludeReviewed=true${accountQuery}`,
        ),
      ])

      if (generation !== refreshGenerationRef.current) return

      if (statsResponse.error) {
        throw new Error(
          statsResponse.error.message || 'Failed to load categorisation stats',
        )
      }
      if (transactionsResponse.error) {
        throw new Error(
          transactionsResponse.error.message || 'Failed to load transactions',
        )
      }

      setStats(statsResponse.data)
      setFilterCounts(statsResponse.data.filterCounts ?? {})
      setTransactions(transactionsResponse.data.transactions)
      setTotal(transactionsResponse.data.total)
    } catch (err) {
      if (generation !== refreshGenerationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load categorisation data')
    } finally {
      if (generation === refreshGenerationRef.current) {
        setIsLoading(false)
      }
    }
  }, [bankAccountId, filter, page, sort, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh()
  })

  const applyReviewedTransaction = useCallback((transactionId: string) => {
    let wasNeedsReview = false

    setTransactions((prev) => {
      const existing = prev.find((t) => t.id === transactionId)
      wasNeedsReview = existing?.needsReview ?? false
      return prev.filter((t) => t.id !== transactionId)
    })

    setTotal((prev) => Math.max(0, prev - 1))

    if (wasNeedsReview) {
      setStats((prev) => recomputeStats(prev, { categorised: 1, toReview: -1 }))
      setFilterCounts((prev) => ({
        ...prev,
        'to-review': Math.max(0, (prev['to-review'] ?? 0) - 1),
        all: Math.max(0, (prev.all ?? 0) - 1),
      }))
    } else {
      setStats((prev) => recomputeStats(prev, { categorised: 1 }))
      setFilterCounts((prev) => ({
        ...prev,
        all: Math.max(0, (prev.all ?? 0) - 1),
      }))
    }
  }, [])

  const changeTransactionCategory = useCallback(
    async (transactionId: string, hmrcCategory: string) => {
      const existing = transactionsRef.current.find((t) => t.id === transactionId)
      if (!existing) return

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                hmrcCategory,
                category: getHmrcCategoryLabel(hmrcCategory),
                categorySource: 'user' as const,
              }
            : t,
        ),
      )

      try {
        const saved = await updateCategory(transactionId, hmrcCategory, { notify: true })
        if (saved) {
          setTransactions((prev) => prev.map((t) => (t.id === transactionId ? saved : t)))
        }
      } catch (err) {
        void refresh()
        throw err
      }
    },
    [refresh, updateCategory],
  )

  const acceptEditedTransactions = useCallback(
    async ({
      hmrcCategory,
      transactionIds,
    }: {
      hmrcCategory: string
      transactionIds: string[]
    }) => {
      if (transactionIds.length === 0) return

      await Promise.all(
        transactionIds.map((transactionId) =>
          updateCategory(transactionId, hmrcCategory, { notify: false }),
        ),
      )

      for (const transactionId of transactionIds) {
        applyReviewedTransaction(transactionId)
      }

      notifyMtdTransactionsChanged()
    },
    [applyReviewedTransaction, updateCategory],
  )

  const visibleIds = useMemo(() => transactions.map((t) => t.id), [transactions])

  const selectedCount = selectedIds.size

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [selectedIds, visibleIds],
  )

  const toggleRowSelected = useCallback((transactionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }, [])

  const toggleAllVisibleSelected = useCallback(() => {
    const ids = transactionsRef.current.map((t) => t.id)
    if (ids.length === 0) return

    const allSelected = ids.every((id) => selectedIdsRef.current.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        for (const id of ids) {
          next.delete(id)
        }
      } else {
        for (const id of ids) {
          next.add(id)
        }
      }
      return next
    })
  }, [])

  const reviewSelected = useCallback(async () => {
    const selected = transactionsRef.current.filter((t) =>
      selectedIdsRef.current.has(t.id),
    )
    if (selected.length === 0) return

    setIsReviewing(true)
    const toApproveIds = selected.map((t) => t.id)

    try {
      await approveTransactions(toApproveIds, { notify: false })
      setSelectedIds(new Set())
      await refresh()
      notifyMtdTransactionsChanged()
    } catch (err) {
      console.error('[categorise] review selected failed', err)
    } finally {
      setIsReviewing(false)
    }
  }, [approveTransactions, refresh])

  const reviewAll = useCallback(async () => {
    if (!userId) return

    setIsReviewing(true)

    try {
      const accountQuery = bankAccountId
        ? `&bankAccountId=${encodeURIComponent(bankAccountId)}`
        : ''
      const response = await authFetch<TransactionsResponse>(
        `/api/transactions/search?limit=10000&offset=0&filter=all&sort=newest&excludeReviewed=true${accountQuery}`,
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load transactions')
      }

      const toApproveIds = response.data.transactions.map((t) => t.id)
      if (toApproveIds.length === 0) return

      await approveTransactions(toApproveIds, { notify: false })
      setSelectedIds(new Set())
      await refresh()
      notifyMtdTransactionsChanged()
    } catch (err) {
      console.error('[categorise] review all failed', err)
    } finally {
      setIsReviewing(false)
    }
  }, [approveTransactions, bankAccountId, refresh, userId])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const changeFilter = useCallback((nextFilter: TransactionFilter) => {
    setFilter(nextFilter)
    setPage(1)
    setSelectedIds(new Set())
    setIsLoading(true)
  }, [])

  const changeSort = useCallback((nextSort: TransactionSort) => {
    setSort(nextSort)
    setPage(1)
    setSelectedIds(new Set())
    setIsLoading(true)
  }, [])

  const changePage = useCallback((nextPage: number) => {
    setPage(nextPage)
    setSelectedIds(new Set())
    setIsLoading(true)
  }, [])

  return {
    stats,
    filterCounts,
    transactions,
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    filter,
    sort,
    isLoading,
    isReviewing,
    error,
    selectedIds,
    selectedCount,
    allVisibleSelected,
    refresh,
    changeFilter,
    changeSort,
    changePage,
    changeTransactionCategory,
    acceptEditedTransactions,
    toggleRowSelected,
    toggleAllVisibleSelected,
    reviewSelected,
    reviewAll,
  }
}
