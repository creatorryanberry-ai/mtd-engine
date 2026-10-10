import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { engineApi } from './engineApi'
import { engineQueryKeys } from './engineQueryKeys'

import type { Page } from './engineApi'

const PAGE_SIZE = 50

function usePaged<T>(
  queryKey: readonly unknown[],
  workspaceId: string | undefined,
  fetchPage: (workspaceId: string, cursor: string | null) => Promise<Page<T>>,
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(workspaceId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!workspaceId,
  })
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  return {
    items,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
    refetch: query.refetch,
  }
}

export function useEngineAudit(workspaceId: string | undefined) {
  return usePaged(engineQueryKeys.audit(workspaceId ?? ''), workspaceId, (id, cursor) =>
    engineApi.listAudit(id, { limit: PAGE_SIZE, cursor }),
  )
}

export function useEngineContacts(workspaceId: string | undefined) {
  return usePaged(
    engineQueryKeys.contacts(workspaceId ?? ''),
    workspaceId,
    (id, cursor) => engineApi.listContacts(id, { limit: PAGE_SIZE, cursor }),
  )
}

export function useEngineOrders(workspaceId: string | undefined) {
  return usePaged(engineQueryKeys.orders(workspaceId ?? ''), workspaceId, (id, cursor) =>
    engineApi.listOrders(id, { limit: PAGE_SIZE, cursor }),
  )
}

export function useEngineLlmCalls(workspaceId: string | undefined, enabled = true) {
  return usePaged(
    engineQueryKeys.llmCalls(workspaceId ?? ''),
    enabled ? workspaceId : undefined,
    (id, cursor) => engineApi.listLlmCalls(id, { limit: PAGE_SIZE, cursor }),
  )
}

export function useEngineDashboard(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.dashboard(workspaceId ?? ''),
    queryFn: () => engineApi.getDashboard(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  })
  return {
    summary: query.data ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
