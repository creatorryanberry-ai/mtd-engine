import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SizableText, ScrollView, YStack } from 'tamagui'

import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { NotificationList } from '~/interface/notification/NotificationList'

export const NotificationPage = () => {
  const insets = useSafeAreaInsets()

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <MtdDetailHeader backHref="/home/feed" />
      <YStack px="$4" pt="$3" pb="$2">
        <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text}>
          Notifications
        </SizableText>
      </YStack>
      <ScrollView flex={1}>
        <YStack
          mx="$4"
          mb={insets.bottom + MTD_TAB_BAR_HEIGHT + 16}
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          overflow="hidden"
        >
          <NotificationList />
        </YStack>
      </ScrollView>
    </YStack>
  )
}
