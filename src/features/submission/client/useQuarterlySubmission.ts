import { useCallback, useEffect, useRef, useState } from 'react'
import { useEmitter } from '@mtd/helpers'

import { authFetch, getAuthFetchErrorMessage } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { getHmrcFraudHeaderRecord } from '~/features/hmrc/client/collectFraudHeaders'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import type { QuarterId } from '~/features/mtd/utils/quarterPeriods'

import type { SubmissionPhase } from '~/features/mtd/components/SubmissionProgressCard'
import {
  mtdSubmissionEmitter,
  notifyMtdSubmissionChanged,
} from '~/features/submission/client/mtdSubmissionEmitter'

import type {
  QuarterlySummary,
  SubmitQuarterlyResult,
} from '~/features/submission/server/submissionService'

const CONNECTING_MS = 3600
const UPLOADING_MS = 1600
const PROCESSING_MS = 1400

export function useQuarterlySubmission(quarterIdOverride?: QuarterId | null) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYearStart, quarterId } = useSubmissionPeriod(quarterIdOverride ?? undefined)

  const [summary, setSummary] = useState<QuarterlySummary | null>(null)
  const [result, setResult] = useState<SubmitQuarterlyResult | null>(null)
  const dismissSuccessRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionPhase, setSubmissionPhase] = useState<SubmissionPhase | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submitQuarterIdRef = useRef<string | null>(null)
  const submitTaxYearStartRef = useRef<string | null>(null)
  const submitResultRef = useRef<SubmitQuarterlyResult | null>(null)
  const submitErrorRef = useRef<string | null>(null)
  const apiRequestRef = useRef<Promise<void> | null>(null)

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
        const response = await authFetch<QuarterlySummary>(
          `/api/submissions/quarterly-summary?${params.toString()}`,
        )
        if (response.error) {
          throw new Error(response.error.message || 'Failed to load submission summary')
        }
        setSummary(response.data)
        if (response.data.existingSubmission && !dismissSuccessRef.current) {
          const existing = response.data.existingSubmission
          setResult({
            status: 'ACCEPTED',
            reference: existing.reference,
            submittedAt: existing.submittedAt,
            incomeTotal: existing.incomeTotal,
            expenseTotal: existing.expenseTotal,
            taxableProfit: existing.taxableProfit,
            taxDue: existing.taxDue,
            source: existing.source,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submission summary')
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

  useEmitter(mtdSubmissionEmitter, () => {
    void refresh({ silent: true })
  })

  const finishSubmission = useCallback(() => {
    submitQuarterIdRef.current = null
    submitTaxYearStartRef.current = null
    apiRequestRef.current = null
    submitResultRef.current = null
    submitErrorRef.current = null
    setSubmissionPhase(null)
    setIsSubmitting(false)
  }, [])

  const submit = useCallback(() => {
    if (!summary || !summary.isReady || summary.existingSubmission || isSubmitting) return

    submitQuarterIdRef.current = summary.quarter.id
    submitTaxYearStartRef.current = summary.quarter.taxYearStart
    submitResultRef.current = null
    submitErrorRef.current = null
    apiRequestRef.current = null
    setError(null)
    setIsSubmitting(true)
    setSubmissionPhase('connecting')
  }, [isSubmitting, summary])

  useEffect(() => {
    if (!isSubmitting || submissionPhase !== 'connecting') return

    const timer = setTimeout(() => {
      setSubmissionPhase('uploading')
    }, CONNECTING_MS)

    return () => clearTimeout(timer)
  }, [isSubmitting, submissionPhase])

  useEffect(() => {
    if (!isSubmitting || submissionPhase !== 'uploading') return

    const quarterIdValue = submitQuarterIdRef.current
    const taxYearStartValue = submitTaxYearStartRef.current
    if (!quarterIdValue || !taxYearStartValue) return

    apiRequestRef.current = (async () => {
      const response = await authFetch<SubmitQuarterlyResult>(
        '/api/submissions/quarterly',
        {
          method: 'POST',
          headers: getHmrcFraudHeaderRecord(),
          body: JSON.stringify({
            quarterId: quarterIdValue,
            taxYearStart: taxYearStartValue,
          }),
        },
      )

      if (response.error) {
        throw new Error(
          getAuthFetchErrorMessage(response.error, 'Failed to submit to HMRC'),
        )
      }

      if (!response.data) {
        throw new Error('Failed to submit to HMRC')
      }

      submitResultRef.current = response.data
    })()

    const timer = setTimeout(() => {
      setSubmissionPhase('processing')
    }, UPLOADING_MS)

    return () => clearTimeout(timer)
  }, [isSubmitting, submissionPhase])

  useEffect(() => {
    if (!isSubmitting || submissionPhase !== 'processing') return

    let cancelled = false

    const complete = async () => {
      try {
        await apiRequestRef.current
        await new Promise<void>((resolve) => {
          setTimeout(resolve, PROCESSING_MS)
        })

        if (cancelled) return

        if (submitErrorRef.current) {
          throw new Error(submitErrorRef.current)
        }

        const submitResult = submitResultRef.current
        if (!submitResult) {
          throw new Error('Failed to submit to HMRC')
        }

        setResult(submitResult)
        dismissSuccessRef.current = false
        notifyMtdSubmissionChanged()
        await refresh({ silent: true })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to submit to HMRC')
        }
      } finally {
        if (!cancelled) {
          finishSubmission()
        }
      }
    }

    void apiRequestRef.current?.catch((err) => {
      submitErrorRef.current =
        err instanceof Error ? err.message : 'Failed to submit to HMRC'
    })

    void complete()

    return () => {
      cancelled = true
    }
  }, [finishSubmission, isSubmitting, refresh, submissionPhase])

  const resetSuccessView = useCallback(() => {
    dismissSuccessRef.current = true
    setResult(null)
  }, [])

  const showConfirmation = useCallback(() => {
    dismissSuccessRef.current = false
    if (summary?.existingSubmission) {
      const existing = summary.existingSubmission
      setResult({
        status: 'ACCEPTED',
        reference: existing.reference,
        submittedAt: existing.submittedAt,
        incomeTotal: existing.incomeTotal,
        expenseTotal: existing.expenseTotal,
        taxableProfit: existing.taxableProfit,
        taxDue: existing.taxDue,
        source: existing.source,
      })
    }
  }, [summary?.existingSubmission])

  return {
    summary,
    result,
    isLoading,
    isSubmitting,
    submissionPhase,
    error,
    refresh,
    submit,
    resetSuccessView,
    showConfirmation,
  }
}
