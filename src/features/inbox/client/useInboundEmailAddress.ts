import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '~/features/api/client/queryKeys'
import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'

export type InboundEmailAddressDto = {
  id: string
  emailAddress: string
  isActive: boolean
  createdAt: string
}

async function fetchAddress() {
  const response = await authFetch<{ address: InboundEmailAddressDto }>(
    '/api/inbox/address',
  )
  if (response.error) {
    throw new Error(response.error.message || 'Failed to load inbound email address')
  }
  return response.data.address
}

async function regenerateAddress() {
  const response = await authFetch<{ address: InboundEmailAddressDto }>(
    '/api/inbox/address/regenerate',
    { method: 'POST' },
  )
  if (response.error) {
    throw new Error(response.error.message || 'Failed to regenerate address')
  }
  return response.data.address
}

export function useInboundEmailAddress() {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.inboundEmailAddress(userId),
    queryFn: fetchAddress,
    enabled: !!userId,
  })

  const mutation = useMutation({
    mutationFn: regenerateAddress,
    onSuccess: (address) => {
      queryClient.setQueryData(queryKeys.inboundEmailAddress(userId), address)
    },
  })

  return {
    address: query.data ?? null,
    isLoading: query.isLoading,
    regenerate: mutation.mutateAsync,
    isRegenerating: mutation.isPending,
    error: query.error ?? mutation.error,
  }
}
