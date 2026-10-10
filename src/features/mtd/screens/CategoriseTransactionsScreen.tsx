import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, YStack } from 'tamagui'

import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { ReviewWizard } from '../components/review-wizard/ReviewWizard'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

export const CategoriseTransactionsScreen = memo(() => {
  const insets = useSafeAreaInsets()

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6', gap: '$6' }}
    >
      <ReviewWizard />
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Review" />
        <YStack flex={1} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Review" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
})
