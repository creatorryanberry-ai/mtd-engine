import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '~/features/api/client/queryKeys'
import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'

import type { BusinessSettingsPatch } from '~/features/business/businessSettingsValidation'
import type { User } from '~/data/types'

type UserState = { userId: string; darkMode: boolean; hasOnboarded: boolean }

type UserMeResponse = {
  user: User | null
  state: UserState | null
}

export type BusinessSettings = {
  userId: string
  businessName: string | null
  businessStartDate: string | null
  businessDescription: string | null
  businessType: 'self-employed' | 'landlord' | null
  cisRegistered: boolean | null
  vehicleClaimMethod: 'mileage' | 'actual' | null
  updatedAt: string
}

async function fetchBusinessSettings(): Promise<BusinessSettings> {
  const response = await authFetch<BusinessSettings>('/api/users/business-settings')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to load business settings')
  }
  return response.data
}

async function patchBusinessSettings(
  patch: BusinessSettingsPatch,
): Promise<BusinessSettings> {
  const response = await authFetch<BusinessSettings>('/api/users/business-settings', {
    method: 'PATCH',
    body: patch,
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to save business settings')
  }
  return response.data
}

export const useBusinessSettings = () => {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.businessSettings(userId),
    queryFn: fetchBusinessSettings,
    enabled: !!userId,
  })

  const mutation = useMutation({
    mutationFn: patchBusinessSettings,
    onSuccess: () => {
      if (!userId) return

      queryClient.setQueryData<UserMeResponse>(queryKeys.userMe(userId), (current) => {
        if (!current) {
          return {
            user: null,
            state: {
              userId,
              darkMode: false,
              hasOnboarded: true,
            },
          }
        }

        return {
          ...current,
          state: current.state
            ? { ...current.state, hasOnboarded: true }
            : {
                userId,
                darkMode: false,
                hasOnboarded: true,
              },
        }
      })

      void queryClient.invalidateQueries({ queryKey: queryKeys.businessSettings(userId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.userMe(userId) })
      notifyMtdTransactionsChanged()
    },
  })

  return {
    settings: data ?? null,
    isLoading,
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}
