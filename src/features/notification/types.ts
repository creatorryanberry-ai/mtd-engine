export type NotificationType =
  | 'system'
  | 'submission_due'
  | 'submission_success'
  | 'sync_error'

export type InAppNotification = {
  id: string
  userId: string
  type: NotificationType
  title: string
  body?: string
  read: boolean
  createdAt: number
}

export type NotificationListItemProps = {
  notification: InAppNotification
  onPress?: (notification: InAppNotification) => void
  onMarkRead?: (notificationId: string) => void
}
