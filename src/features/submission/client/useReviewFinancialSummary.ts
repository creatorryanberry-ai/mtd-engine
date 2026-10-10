import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import type { QuarterId } from '~/features/mtd/utils/quarterPeriods'
import { mtdTransactionsEmitter } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { ReviewFinancialSummary } from '~/features/submission/reviewFinancialEstimates'

export function useReviewFinancialSummary(quarterIdOverride?: QuarterId | null) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart, quarterId } = useSubmissionPeriod(quarterIdOverride ?? undefined)
  const [summary, setSummary] = useState<ReviewFinancialSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      if (!options?.silent) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const params = new URLSearchParams({
          quarter: quarterId,
          taxYearStart,
        })
        const response = await authFetch<ReviewFinancialSummary>(
          `/api/submissions/review-summary?${params.toString()}`,
        )
        if (response.error) {
          throw new Error(response.error.message || 'Failed to load review summary')
        }
        setSummary(response.data ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load review summary')
        setSummary(null)
      } finally {
        if (!options?.silent) {
          setIsLoading(false)
        }
      }
    },
    [quarterId, taxYearStart, userId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh({ silent: true })
  })

  return { summary, isLoading, error, refresh, quarterId, taxYearStart }
}
