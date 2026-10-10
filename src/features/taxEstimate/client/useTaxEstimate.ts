import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '~/features/api/client/queryKeys'
import { authFetch, getAuthFetchErrorMessage } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import type { TaxEstimateAnswers } from '~/features/taxEstimate/types'
import type { TaxEstimatePoundsResult } from '~/features/taxEstimate/types'
import type { TaxableBusinessProfit } from '~/features/taxEstimate/types'
import type { TaxJurisdiction } from '~/features/taxEstimate/taxYearRules'

export type TaxEstimateDto = {
  taxYearStart: string
  jurisdiction: TaxJurisdiction
  useProjection: boolean
  answers: TaxEstimateAnswers
  business: TaxableBusinessProfit
  calculation: TaxEstimatePoundsResult
  updatedAt: string
}

function throwIfFailed<T>(
  response: { data?: T | null; error?: unknown },
  fallback: string,
): T {
  if (response.error || response.data == null) {
    const status =
      response.error && typeof response.error === 'object' && 'status' in response.error
        ? Number((response.error as { status?: number }).status)
        : undefined
    const message = getAuthFetchErrorMessage(response.error, fallback)
    console.info('[tax-estimate]', fallback, status ?? '', response.error)
    throw new Error(status ? `${message} (${status})` : message)
  }
  return response.data
}

async function fetchTaxEstimate(taxYearStart: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const params = new URLSearchParams({ taxYearStart })
    const response = await authFetch<TaxEstimateDto>(
      `/api/tax-estimate?${params.toString()}`,
      { signal: controller.signal },
    )
    return throwIfFailed(response, 'Failed to load tax estimate')
  } finally {
    clearTimeout(timer)
  }
}

async function patchTaxEstimate(body: {
  taxYearStart: string
  jurisdiction?: TaxJurisdiction
  useProjection?: boolean
  answers?: Partial<TaxEstimateAnswers>
}) {
  const response = await authFetch<TaxEstimateDto>('/api/tax-estimate', {
    method: 'PATCH',
    body,
  })
  return throwIfFailed(response, 'Failed to save tax estimate')
}

export function useTaxEstimate() {
  const auth = useAuth()
  const userId = auth?.user?.id || ''
  const { taxYearStart } = useSelectedTaxYear()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.taxEstimate(userId, taxYearStart),
    queryFn: () => fetchTaxEstimate(taxYearStart),
    enabled: Boolean(userId),
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : ''
      if (/\(401\)|\(403\)|\(404\)/.test(message)) return false
      return failureCount < 2
    },
  })

  const mutation = useMutation({
    mutationFn: patchTaxEstimate,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.taxEstimate(userId, taxYearStart), data)
    },
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    taxYearStart,
    save: (patch: {
      jurisdiction?: TaxJurisdiction
      useProjection?: boolean
      answers?: Partial<TaxEstimateAnswers>
    }) =>
      mutation.mutateAsync({
        taxYearStart,
        ...patch,
      }),
    isSaving: mutation.isPending,
  }
}
