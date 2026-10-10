import { useCallback, useEffect, useRef, useState } from 'react'

import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { MILEAGE_LIST_PAGE_SIZE } from '~/features/mileage/utils/mileageListPage'

export type MileageEntryDto = {
  id: string
  date: string
  journeyDetails: string
  miles: number
  seriesId?: string | null
  seriesOverride?: boolean
  rateLabel: string
  claimPounds: number
  createdAt: string
  updatedAt: string
}

type MileageListResponse = {
  entries: MileageEntryDto[]
  totalCount?: number
  totalClaimPounds?: number
  hasMore?: boolean
}

export function useMileageEntries(options?: { pageSize?: number }) {
  const auth = useAuth()
  const userId = auth?.user?.id
  const pageSize = options?.pageSize

  const [entries, setEntries] = useState<MileageEntryDto[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalClaimPounds, setTotalClaimPounds] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const generationRef = useRef(0)
  const loadMoreLockRef = useRef(false)

  const refresh = useCallback(async (): Promise<MileageEntryDto[]> => {
    if (!userId) {
      setIsLoading(false)
      return []
    }

    const generation = ++generationRef.current
    loadMoreLockRef.current = false
    setError(null)

    try {
      const query = pageSize ? `?limit=${pageSize}&offset=0` : ''
      const response = await authFetch<MileageListResponse>(`/api/mileage${query}`)

      if (generation !== generationRef.current) return entriesRef.current

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load mileage entries')
      }

      const rows = response.data.entries
      setEntries(rows)
      setTotalCount(response.data.totalCount ?? rows.length)
      setTotalClaimPounds(
        response.data.totalClaimPounds ??
          rows.reduce((sum, entry) => sum + entry.claimPounds, 0),
      )
      setHasMore(Boolean(pageSize && response.data.hasMore))
      return rows
    } catch (err) {
      if (generation !== generationRef.current) return entriesRef.current
      setError(err instanceof Error ? err.message : 'Failed to load mileage entries')
      return []
    } finally {
      if (generation === generationRef.current) setIsLoading(false)
    }
  }, [pageSize, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!userId || !pageSize || !hasMore || loadMoreLockRef.current) return

    loadMoreLockRef.current = true
    setIsLoadingMore(true)
    const generation = generationRef.current
    const offset = entriesRef.current.length

    try {
      const response = await authFetch<MileageListResponse>(
        `/api/mileage?limit=${pageSize}&offset=${offset}`,
      )

      if (generation !== generationRef.current) return

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load mileage entries')
      }

      const rows = response.data.entries
      setEntries((current) => {
        const seen = new Set(current.map((entry) => entry.id))
        return [...current, ...rows.filter((entry) => !seen.has(entry.id))]
      })
      setTotalCount(response.data.totalCount ?? offset + rows.length)
      if (response.data.totalClaimPounds != null) {
        setTotalClaimPounds(response.data.totalClaimPounds)
      }
      setHasMore(Boolean(response.data.hasMore))
    } catch (err) {
      if (generation !== generationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load mileage entries')
    } finally {
      if (generation === generationRef.current) {
        loadMoreLockRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [hasMore, pageSize, userId])

  const createEntry = useCallback(
    async (input: { date: string; journeyDetails: string; miles: number }) => {
      const response = await authFetch<{ entry: MileageEntryDto }>('/api/mileage', {
        method: 'POST',
        body: input,
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create mileage entry')
      }

      await refresh()
      return response.data.entry
    },
    [refresh],
  )

  const updateEntry = useCallback(
    async (
      entryId: string,
      input: { date: string; journeyDetails: string; miles: number },
    ) => {
      const response = await authFetch<{ entry: MileageEntryDto }>('/api/mileage', {
        method: 'PATCH',
        body: { id: entryId, ...input },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update mileage entry')
      }

      await refresh()
      return response.data.entry
    },
    [refresh],
  )

  const deleteEntry = useCallback(
    async (entryId: string) => {
      const response = await authFetch<{ success: boolean }>(
        `/api/mileage?id=${encodeURIComponent(entryId)}`,
        { method: 'DELETE' },
      )

      if (response.error) {
        throw new Error(response.error.message || 'Failed to delete mileage entry')
      }

      await refresh()
    },
    [refresh],
  )

  return {
    entries,
    totalCount,
    totalClaimPounds,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    createEntry,
    updateEntry,
    deleteEntry,
  }
}

export { MILEAGE_LIST_PAGE_SIZE }
