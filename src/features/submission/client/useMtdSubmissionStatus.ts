import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import { getQuarterInfo, type QuarterId } from '~/features/mtd/utils/quarterPeriods'

import { mtdSubmissionEmitter } from './mtdSubmissionEmitter'
import { mtdTransactionsEmitter } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { QuarterlySummary } from '~/features/submission/server/submissionService'

export function useMtdSubmissionStatus(quarterIdOverride?: QuarterId | null) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart, quarterId } = useSubmissionPeriod(quarterIdOverride ?? undefined)
  const quarter = getQuarterInfo(quarterId, taxYearStart)

  const [summary, setSummary] = useState<QuarterlySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      const params = new URLSearchParams({
        quarter: quarterId,
        taxYearStart,
      })
      const response = await authFetch<QuarterlySummary>(
        `/api/submissions/quarterly-summary?${params.toString()}`,
      )
      if (!response.error && response.data) {
        setSummary(response.data)
      }
    } catch {
      setSummary(null)
    } finally {
      setIsLoading(false)
    }
  }, [quarterId, taxYearStart, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(mtdSubmissionEmitter, () => {
    void refresh()
  })

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh()
  })

  return {
    quarter,
    summary,
    isLoading,
    refresh,
  }
}
