import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '~/features/auth/client/authClient'

import { engineApi } from './engineApi'
import { engineQueryKeys } from './engineQueryKeys'

import type {
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberInput,
  UpdateWorkspaceInput,
} from './engineApi'

export function useEngineWorkspaces() {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const query = useQuery({
    queryKey: engineQueryKeys.workspaces(userId),
    queryFn: engineApi.listWorkspaces,
    enabled: !!userId,
  })
  return {
    workspaces: query.data ?? [],
    isLoading: !!userId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateWorkspace() {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => engineApi.createWorkspace(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.workspaces(userId) })
    },
  })
}

export function useEngineWorkspace(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.workspace(workspaceId ?? ''),
    queryFn: () => engineApi.getWorkspace(workspaceId!),
    enabled: !!workspaceId,
  })
  return {
    workspace: query.data ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useUpdateWorkspace(workspaceId: string) {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      engineApi.updateWorkspace(workspaceId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(engineQueryKeys.workspace(workspaceId), data)
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.workspaces(userId) })
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.dashboard(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

export function useEngineMembers(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.members(workspaceId ?? ''),
    queryFn: () => engineApi.listMembers(workspaceId!),
    enabled: !!workspaceId,
  })
  return {
    members: query.data ?? [],
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function useAddMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteMemberInput) => engineApi.addMember(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.members(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

export function useUpdateMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, ...input }: UpdateMemberInput & { memberId: string }) =>
      engineApi.updateMember(workspaceId, memberId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.members(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => engineApi.removeMember(workspaceId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.members(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

/** the signed-in user's role in a workspace, from the cached workspace list */
export function useEngineRole(workspaceId: string | undefined) {
  const { workspaces, isLoading } = useEngineWorkspaces()
  const role = workspaces.find((item) => item.id === workspaceId)?.role ?? null
  return {
    role,
    isLoading,
    isAdmin: role === 'owner' || role === 'admin',
    canEdit: role === 'owner' || role === 'admin' || role === 'marketer',
  }
}
