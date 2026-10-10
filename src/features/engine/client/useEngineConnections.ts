import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { engineApi } from './engineApi'
import { engineQueryKeys } from './engineQueryKeys'

import type { ConnectInput } from './engineApi'

export function useEngineConnectors() {
  const query = useQuery({
    queryKey: engineQueryKeys.connectors,
    queryFn: engineApi.listConnectors,
  })
  return {
    connectors: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function useEngineConnections(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.connections(workspaceId ?? ''),
    queryFn: () => engineApi.listConnections(workspaceId!),
    enabled: !!workspaceId,
  })
  return {
    connections: query.data ?? [],
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

function useInvalidateConnections(workspaceId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({
      queryKey: engineQueryKeys.connections(workspaceId),
    })
    void queryClient.invalidateQueries({
      queryKey: engineQueryKeys.dashboard(workspaceId),
    })
    void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
  }
}

export function useConnectProvider(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: ({ provider, ...input }: ConnectInput & { provider: string }) =>
      engineApi.connectProvider(workspaceId, provider, input),
    onSuccess: invalidate,
  })
}

export function useSyncConnection(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (connectionId: string) =>
      engineApi.syncConnection(workspaceId, connectionId),
    onSuccess: invalidate,
  })
}

export function useDisconnect(workspaceId: string) {
  const invalidate = useInvalidateConnections(workspaceId)
  return useMutation({
    mutationFn: (connectionId: string) => engineApi.disconnect(workspaceId, connectionId),
    onSuccess: invalidate,
  })
}
