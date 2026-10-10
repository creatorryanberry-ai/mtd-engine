import { Slot } from 'one'
import { YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

export const NotificationLayout = () => {
  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <Slot />
    </YStack>
  )
}
