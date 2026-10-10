import { createStorageValue } from '@mtd/helpers'

export const notificationPromptStorage = createStorageValue<boolean>(
  'hasSeenNotificationPrompt',
)
