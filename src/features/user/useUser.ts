import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '~/features/api/client/queryKeys'
import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'

import type { User } from '~/data/types'

type UserState = { userId: string; darkMode: boolean; hasOnboarded: boolean }

type MeResponse = {
  user: User | null
  state: UserState | null
}

async function fetchMe(): Promise<MeResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await authFetch<MeResponse>('/api/users/me', {
      signal: controller.signal,
    })
    if (response.error) {
      throw new Error(response.error.message || 'Failed to load user')
    }
    return response.data
  } finally {
    clearTimeout(timer)
  }
}

export const useUser = () => {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.userMe(userId),
    queryFn: fetchMe,
    enabled: !!userId,
    retry: 1,
  })

  const mutation = useMutation({
    mutationFn: async (
      patch: Partial<Pick<User, 'name' | 'username' | 'image'>> & {
        hasOnboarded?: boolean
      },
    ) => {
      const response = await authFetch<{ user: User | null; state: UserState | null }>(
        '/api/users/me',
        {
          method: 'PATCH',
          body: patch,
        },
      )
      if (response.error) {
        throw new Error(response.error.message || 'Failed to update user')
      }
      return response.data
    },
    onSuccess: () => {
      if (!userId) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.userMe(userId) })
    },
  })

  const user = data?.user ?? null
  const state = data?.state ?? null

  return {
    ...auth,
    user,
    state,
    hasOnboarded: state?.hasOnboarded ?? false,
    update: (next: Partial<User>) => mutation.mutateAsync(next),
    markOnboarded: () => mutation.mutateAsync({ hasOnboarded: true }),
    isAdmin: (auth.user as { role?: string } | null)?.role === 'admin',
    isLoading: !!userId && isLoading,
    isError: !!userId && isError,
    refresh: refetch,
    isOnline: null,
  }
}
