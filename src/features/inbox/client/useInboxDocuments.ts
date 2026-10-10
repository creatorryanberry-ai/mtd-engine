import { useFocusEffect } from 'one'
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '~/features/api/client/queryKeys'
import { authFetch } from '~/features/auth/client/authFetch'
import { useAuth } from '~/features/auth/client/authClient'

export type InboxDocumentListItem = {
  id: string
  originalFileName: string
  mimeType: string
  fileSize: number
  source: string
  status: string
  receivedAt: string
  fromAddress: string | null
  subject: string | null
}

export type InboxDocumentDetail = InboxDocumentListItem & {
  previewUrl: string | null
  mtdTransactionId: string | null
  errorMessage: string | null
}

export type InboxEmailNoticeItem = {
  id: string
  status: string
  receivedAt: string
  fromAddress: string | null
  subject: string | null
  errorMessage: string | null
}

type InboxListResponse = {
  items: InboxDocumentListItem[]
  waitingCount: number
  notices: InboxEmailNoticeItem[]
}

async function fetchInbox() {
  const response = await authFetch<InboxListResponse>('/api/inbox')
  if (response.error) {
    throw new Error(response.error.message || 'Failed to load inbox')
  }
  return response.data
}

async function fetchInboxDocument(id: string) {
  const response = await authFetch<{ item: InboxDocumentDetail }>(`/api/inbox/${id}`)
  if (response.error) {
    throw new Error(response.error.message || 'Failed to load document')
  }
  return response.data.item
}

async function ignoreInboxDocument(id: string) {
  const response = await authFetch<{ ok: true }>(`/api/inbox/${id}/ignore`, {
    method: 'POST',
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to ignore document')
  }
}

async function markInboxDocumentProcessed(id: string, mtdTransactionId: string) {
  const response = await authFetch<{ ok: true }>(`/api/inbox/${id}/processed`, {
    method: 'POST',
    body: { mtdTransactionId },
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to update inbox document')
  }
}

async function deleteInboxNotice(id: string) {
  const response = await authFetch<{ ok: true }>(`/api/inbox-notices/${id}/delete`, {
    method: 'POST',
  })
  if (response.error) {
    throw new Error(response.error.message || 'Failed to delete inbox notice')
  }
}

export function useInboxDocuments() {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()
  const [isFocused, setIsFocused] = useState(false)

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true)
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.inbox(userId) })
      }
      return () => setIsFocused(false)
    }, [queryClient, userId]),
  )

  const query = useQuery({
    queryKey: queryKeys.inbox(userId),
    queryFn: fetchInbox,
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchInterval: isFocused ? 15_000 : false,
  })

  useEffect(() => {
    if (!userId) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocused) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.inbox(userId) })
      }
    })
    return () => subscription.remove()
  }, [isFocused, queryClient, userId])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inbox(userId) })
  }

  const ignoreMutation = useMutation({
    mutationFn: ignoreInboxDocument,
    onSuccess: invalidate,
  })

  const processedMutation = useMutation({
    mutationFn: ({ id, mtdTransactionId }: { id: string; mtdTransactionId: string }) =>
      markInboxDocumentProcessed(id, mtdTransactionId),
    onSuccess: invalidate,
  })

  const deleteNoticeMutation = useMutation({
    mutationFn: deleteInboxNotice,
    onSuccess: invalidate,
  })

  return {
    items: query.data?.items ?? [],
    waitingCount: query.data?.waitingCount ?? 0,
    notices: query.data?.notices ?? [],
    isLoading: !userId || query.isLoading,
    error: query.error,
    refresh: query.refetch,
    fetchDocument: fetchInboxDocument,
    ignoreDocument: ignoreMutation.mutateAsync,
    markProcessed: processedMutation.mutateAsync,
    deleteNotice: deleteNoticeMutation.mutateAsync,
  }
}
