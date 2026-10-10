import { useCallback, useEffect, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'

import { getHmrcFraudHeaderRecord } from './collectFraudHeaders'
import { useHmrcConnection } from './useHmrcConnection'
import { hmrcConnectionEmitter } from './hmrcEmitter'

import type { HmrcObligation, HmrcTaxEstimate } from '../types'

export function useHmrcObligations() {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { status } = useHmrcConnection()
  const [obligation, setObligation] = useState<HmrcObligation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId || !status.configured || !status.connected) {
      setObligation(null)
      setIsLoading(false)
      return
    }

    const response = await authFetch<{ obligation: HmrcObligation | null }>(
      '/api/hmrc/obligations',
      { headers: getHmrcFraudHeaderRecord() },
    )

    if (!response.error && response.data) {
      setObligation(response.data.obligation)
    }

    setIsLoading(false)
  }, [status.configured, status.connected, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(hmrcConnectionEmitter, () => {
    void refresh()
  })

  return { obligation, isLoading, refresh }
}

export function useHmrcTaxEstimate(enabled = true) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart } = useSubmissionPeriod()

  const [estimate, setEstimate] = useState<HmrcTaxEstimate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId || !enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await authFetch<HmrcTaxEstimate>(
        `/api/hmrc/tax-estimate?taxYearStart=${encodeURIComponent(taxYearStart)}`,
        { headers: getHmrcFraudHeaderRecord() },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load HMRC tax estimate')
      }

      setEstimate(response.data)
    } catch (err) {
      setEstimate(null)
      setError(err instanceof Error ? err.message : 'Failed to load HMRC tax estimate')
    } finally {
      setIsLoading(false)
    }
  }, [enabled, taxYearStart, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEmitter(hmrcConnectionEmitter, () => {
    void refresh()
  })

  return { estimate, isLoading, error, refresh }
}
