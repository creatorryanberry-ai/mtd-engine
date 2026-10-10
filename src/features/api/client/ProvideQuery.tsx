import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { useAuth } from '~/features/auth/client/authClient'

import { queryClient } from './queryClient'
import { queryKeys } from './queryKeys'
import { subscribeLiveEvents } from './subscribeLiveEvents'

import type { ReactNode } from 'react'

function applyLiveEvent(userId: string, raw: string) {
  try {
    const data = JSON.parse(raw) as { entity?: string }
    if (!data.entity) return
    if (data.entity === 'mtdTransaction') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions(userId) })
    }
    if (data.entity === 'notification') {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.unreadNotificationCount(userId),
      })
    }
    if (data.entity === 'inbox') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox(userId) })
    }
    if (data.entity === 'submission') {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.submissionJobs(userId),
      })
    }
    if (data.entity === 'userPublic' || data.entity === 'userState') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userMe(userId) })
    }
  } catch {
    // ignore malformed events
  }
}

function LiveEventsSubscriber() {
  const auth = useAuth()
  const userId = auth.user?.id

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    const start = setTimeout(() => {
      void subscribeLiveEvents({
        signal: controller.signal,
        onMessage: (raw) => applyLiveEvent(userId, raw),
      })
    }, 1500)
    return () => {
      clearTimeout(start)
      controller.abort()
    }
  }, [userId])

  return null
}

function QueryCacheOnUserChange({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const userId = auth.user?.id
  const previousUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      queryClient.clear()
    }
    previousUserId.current = userId
  }, [userId])

  return children
}

export function ProvideQuery({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryCacheOnUserChange>
        <LiveEventsSubscriber />
        {children}
      </QueryCacheOnUserChange>
    </QueryClientProvider>
  )
}
