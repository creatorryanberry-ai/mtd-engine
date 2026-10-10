import { useCallback, useEffect, useState } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { mileageSeriesRequestError } from '~/features/mileage/client/mileageSeriesRequestError'

import type {
  MileageSeriesDto,
  MileageSeriesWriteInput,
} from '~/features/mileage/mileageSeriesTypes'

export type { MileageSeriesDto, MileageSeriesWriteInput }

function throwIfSeriesFailed<T>(
  response: { data?: T | null; error?: unknown },
  fallback: string,
): T {
  if (response.error || response.data == null) {
    throw new Error(mileageSeriesRequestError(response.error, fallback))
  }
  return response.data
}

export function useMileageSeries() {
  const auth = useAuth()
  const userId = auth?.user?.id

  const [series, setSeries] = useState<MileageSeriesDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<MileageSeriesDto[]> => {
    if (!userId) {
      setIsLoading(false)
      return []
    }

    setError(null)

    try {
      const response = await authFetch<{ series: MileageSeriesDto[] }>(
        '/api/mileage-series',
      )
      const payload = throwIfSeriesFailed(response, 'Failed to load mileage series')
      const rows = Array.isArray(payload.series) ? payload.series : []
      setSeries(rows)
      return rows
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mileage series')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getSeries = useCallback(async (seriesId: string) => {
    const response = await authFetch<{ series: MileageSeriesDto }>(
      `/api/mileage-series?id=${encodeURIComponent(seriesId)}`,
    )
    const payload = throwIfSeriesFailed(response, 'Failed to load mileage series')
    return payload.series
  }, [])

  const createSeries = useCallback(
    async (input: MileageSeriesWriteInput) => {
      const response = await authFetch<{ series: MileageSeriesDto }>(
        '/api/mileage-series',
        {
          method: 'POST',
          body: input,
        },
      )
      const payload = throwIfSeriesFailed(response, 'Failed to create mileage series')
      await refresh()
      return payload.series
    },
    [refresh],
  )

  const updateSeries = useCallback(
    async (
      seriesId: string,
      input: MileageSeriesWriteInput,
      scope: { type: 'entireSeries' } | { type: 'thisAndFuture'; fromDate: string },
    ) => {
      const response = await authFetch<{ series: MileageSeriesDto }>(
        '/api/mileage-series',
        {
          method: 'PATCH',
          body: {
            id: seriesId,
            ...input,
            scope: scope.type,
            fromDate: scope.type === 'thisAndFuture' ? scope.fromDate : undefined,
          },
        },
      )
      const payload = throwIfSeriesFailed(response, 'Failed to update mileage series')
      await refresh()
      return payload.series
    },
    [refresh],
  )

  const deleteSeries = useCallback(
    async (
      seriesId: string,
      scope: { type: 'entireSeries' } | { type: 'thisAndFuture'; fromDate: string },
    ) => {
      const params = new URLSearchParams({
        id: seriesId,
        scope: scope.type,
      })
      if (scope.type === 'thisAndFuture') {
        params.set('fromDate', scope.fromDate)
      }

      const response = await authFetch<{ success: boolean }>(
        `/api/mileage-series?${params.toString()}`,
        { method: 'DELETE' },
      )
      throwIfSeriesFailed(response, 'Failed to delete mileage series')
      await refresh()
    },
    [refresh],
  )

  return {
    series,
    isLoading,
    error,
    refresh,
    getSeries,
    createSeries,
    updateSeries,
    deleteSeries,
  }
}
