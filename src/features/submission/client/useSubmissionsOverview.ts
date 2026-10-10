import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { mtdSubmissionEmitter } from '~/features/submission/client/mtdSubmissionEmitter'
import { mtdTransactionsEmitter } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { SubmissionsOverview } from '~/features/submission/server/submissionsOverviewService'

export function useSubmissionsOverview() {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart } = useSelectedTaxYear()

  const [overview, setOverview] = useState<SubmissionsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      if (!options?.silent) {
        setIsLoading(true)
      }

      try {
        const response = await authFetch<SubmissionsOverview>(
          `/api/submissions/overview?taxYearStart=${encodeURIComponent(taxYearStart)}`,
        )
        if (!response.error && response.data) {
          setOverview(response.data)
        }
      } catch {
        setOverview(null)
      } finally {
        if (!options?.silent) {
          setIsLoading(false)
        }
      }
    },
    [taxYearStart, userId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(mtdSubmissionEmitter, () => {
    void refresh({ silent: true })
  })

  useEmitter(mtdTransactionsEmitter, () => {
    void refresh({ silent: true })
  })

  return { overview, isLoading, refresh }
}
