import { LegendList } from '@legendapp/list'
import { memo, useCallback } from 'react'
import { SizableText, Spinner, YStack } from 'tamagui'

import { apiFetch } from '~/features/api/client/apiFetch'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useAuth } from '~/features/auth/client/authClient'
import { useNotifications } from '~/features/notification/useNotifications'

import { NotificationListItem } from './NotificationListItem'

import type { NotificationType } from '~/features/notification/types'

type AppNotification = {
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

type NotificationListProps = {
  onNotificationPress?: (notification: AppNotification) => void
  pageSize?: number
}

const LoadingState = (
  <YStack flex={1} items="center" justify="center" py="$8">
    <Spinner />
  </YStack>
)

const EmptyState = (
  <YStack flex={1} items="center" justify="center" py="$8">
    <SizableText size="$4" color={MTD_TOKENS.textSubtle}>
      No notifications yet
    </SizableText>
  </YStack>
)

export const NotificationList = memo(
  ({ onNotificationPress, pageSize = 50 }: NotificationListProps) => {
    const { user } = useAuth()
    const { notifications, status } = useNotifications(user?.id ?? '', pageSize)

    const handleMarkRead = useCallback(async (notificationId: string) => {
      await apiFetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        json: { read: true },
      })
    }, [])

    const handlePress = useCallback(
      (notification: AppNotification) => {
        if (!notification.read) {
          void handleMarkRead(notification.id)
        }
        onNotificationPress?.(notification)
      },
      [handleMarkRead, onNotificationPress],
    )

    const renderItem = useCallback(
      ({ item }: { item: AppNotification }) => (
        <NotificationListItem
          id={item.id}
          type={item.type as NotificationType}
          title={item.title ?? ''}
          body={item.body ?? undefined}
          read={item.read}
          createdAt={new Date(item.createdAt).getTime()}
          onPress={() => handlePress(item)}
        />
      ),
      [handlePress],
    )

    if (status.type === 'pending') return LoadingState
    if (!notifications?.length) return EmptyState

    return (
      <LegendList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
      />
    )
  },
)

NotificationList.displayName = 'NotificationList'
