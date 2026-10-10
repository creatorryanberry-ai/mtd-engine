import { formatDistanceToNow } from '@mtd/helpers'
import { memo } from 'react'
import { SizableText, View, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { BellIcon } from '~/interface/icons/phosphor/BellIcon'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { WarningCircleIcon } from '~/interface/icons/phosphor/WarningCircleIcon'

import type { NotificationType } from '~/features/notification/types'

type NotificationListItemProps = {
  id: string
  type: NotificationType
  title: string
  body?: string
  read: boolean
  createdAt: number
  onPress?: () => void
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'submission_success':
      return CheckCircleIcon
    case 'sync_error':
      return WarningCircleIcon
    case 'submission_due':
    case 'system':
    default:
      return BellIcon
  }
}

export const NotificationListItem = memo(
  ({ type, title, body, read, createdAt, onPress }: NotificationListItemProps) => {
    const Icon = getNotificationIcon(type)
    const timeAgo = formatDistanceToNow(createdAt)

    return (
      <XStack
        px="$4"
        py="$3"
        gap="$3"
        items="center"
        bg={read ? 'transparent' : MTD_TOKENS.cardInset}
        hoverStyle={{ bg: MTD_TOKENS.card }}
        pressStyle={{ bg: MTD_TOKENS.card }}
        cursor="pointer"
        onPress={onPress}
      >
        <View position="relative">
          <View
            width={44}
            height={44}
            rounded="$10"
            bg={MTD_TOKENS.cardInset}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            items="center"
            justify="center"
          >
            <Icon size={20} color={MTD_TOKENS.orange} />
          </View>
          {!read && (
            <View
              position="absolute"
              t={-2}
              r={-2}
              width={10}
              height={10}
              rounded="$10"
              bg={MTD_TOKENS.orange}
            />
          )}
        </View>

        <YStack flex={1} gap="$1">
          <XStack justify="space-between" items="center">
            <SizableText
              size="$4"
              color={MTD_TOKENS.text}
              fontWeight={read ? '400' : '600'}
              numberOfLines={1}
            >
              {title}
            </SizableText>
            <SizableText size="$2" color={MTD_TOKENS.textSubtle}>
              {timeAgo}
            </SizableText>
          </XStack>
          {body && (
            <SizableText size="$3" color={MTD_TOKENS.textMuted} numberOfLines={2}>
              {body}
            </SizableText>
          )}
        </YStack>
      </XStack>
    )
  },
)
