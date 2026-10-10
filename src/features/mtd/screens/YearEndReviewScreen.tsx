import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, YStack } from 'tamagui'

import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { YearEndReviewWizard } from '~/features/mtd/components/year-end-review/YearEndReviewWizard'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

export function YearEndReviewScreen() {
  const insets = useSafeAreaInsets()

  const padded = (
    <YStack
      gap="$4"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YearEndReviewWizard />
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.submissions} title="Year End Review" />
        <YStack flex={1} minH={0} overflow="scroll" py="$4">
          {padded}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.submissions} title="Year End Review" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {padded}
      </ScrollView>
    </YStack>
  )
}
