import { memo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, YStack } from 'tamagui'

import { MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { HomeWorkflowSection } from '../components/HomeWorkflowSection'
import { MtdHeader } from '../components/MtdHeader'
import { NewTaxYearBanner } from '../components/NewTaxYearBanner'
import { SecurityFooterCard } from '../components/SecurityFooterCard'
import { SummaryGrid } from '../components/SummaryGrid'

const BOTTOM_NAV_HEIGHT = MTD_TAB_BAR_HEIGHT

export const MtdOverviewScreen = memo(() => {
  const insets = useSafeAreaInsets()

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$2"
      pb={isWeb ? '$6' : insets.bottom + BOTTOM_NAV_HEIGHT + 24}
      maxW={1200}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6', gap: '$6' }}
    >
      <HomeWorkflowSection />
      <NewTaxYearBanner />
      <SummaryGrid />
      <SecurityFooterCard />
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        <MtdHeader />
        <YStack flex={1} minH={0} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <MtdHeader />
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
})
