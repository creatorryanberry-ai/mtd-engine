import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '~/features/api/client/apiFetch'
import { queryKeys } from '~/features/api/client/queryKeys'

type Notification = {
  id: string
  userId: string
  actorId: string | null
  type: string
  title: string | null
  body: string | null
  data: string | null
  read: boolean
  createdAt: string
}

type ListResponse = { items: Notification[] }

export const useNotifications = (userId: string, pageSize?: number) => {
  const { data, status } = useQuery({
    queryKey: [...queryKeys.notifications(userId), pageSize],
    queryFn: () =>
      apiFetch<ListResponse>(`/api/notifications?pageSize=${pageSize ?? 50}`),
    enabled: Boolean(userId),
  })

  return {
    notifications: data?.items,
    status: { type: status },
  }
}

export const useUnreadNotifications = (userId: string) => {
  const { data, status } = useQuery({
    queryKey: [...queryKeys.notifications(userId), 'unread'],
    queryFn: async () => {
      const all = await apiFetch<ListResponse>('/api/notifications?pageSize=100')
      return { items: all.items.filter((n) => !n.read) }
    },
    enabled: Boolean(userId),
  })

  return { notifications: data?.items, status: { type: status } }
}

export const useUnreadNotificationCount = (userId: string) => {
  const { data } = useQuery({
    queryKey: queryKeys.unreadNotificationCount(userId),
    queryFn: async () => {
      const all = await apiFetch<ListResponse>('/api/notifications?pageSize=100')
      return all.items.filter((n) => !n.read).length
    },
    enabled: Boolean(userId),
  })

  return data ?? 0
}
