import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, YStack } from 'tamagui'

import { BusinessSetupScreen } from '~/features/business/BusinessSetupScreen'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

export default function BusinessSetupPage() {
  const insets = useSafeAreaInsets()

  return (
    <YStack flex={1} bg={MTD_TOKENS.background} pt={isWeb ? 0 : insets.top}>
      <BusinessSetupScreen mode="onboarding" />
    </YStack>
  )
}
