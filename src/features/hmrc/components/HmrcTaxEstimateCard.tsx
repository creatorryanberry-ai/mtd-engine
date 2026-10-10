import { Linking } from 'react-native'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { HMRC_PRODUCTION_ACCOUNT_URL } from '~/features/hmrc/constants'

import { useHmrcConnection } from '../client/useHmrcConnection'
import { useHmrcTaxEstimate } from '../client/useHmrcTaxEstimate'

export function HmrcTaxEstimateCard() {
  const { status } = useHmrcConnection()
  const enabled = status.configured && status.connected
  const { estimate, isLoading, error } = useHmrcTaxEstimate(enabled)

  if (!enabled) return null

  const openHmrcAccount = () => {
    if (isWeb) {
      window.open(HMRC_PRODUCTION_ACCOUNT_URL, '_blank', 'noopener,noreferrer')
      return
    }

    void Linking.openURL(HMRC_PRODUCTION_ACCOUNT_URL)
  }

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$4"
      gap="$3"
    >
      <XStack justify="space-between" items="center" gap="$3">
        <YStack gap="$1" flex={1}>
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            HMRC tax estimate
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={18}>
            {estimate?.disclaimer ??
              'HMRC calculates this from your submitted information. It may change before your final bill.'}
          </SizableText>
        </YStack>
        {isLoading && <Spinner size="small" color={MTD_TOKENS.orange} />}
      </XStack>

      {!isLoading && estimate?.totalIncomeTaxAndNicsDue != null && (
        <SizableText fontSize={28} fontWeight="700" color={MTD_TOKENS.orange}>
          {formatSubmissionAmount(estimate.totalIncomeTaxAndNicsDue)}
        </SizableText>
      )}

      {!isLoading && error && (
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          {error}
        </SizableText>
      )}

      {status.environment === 'production' && (
        <MtdActionButton size="compact" onPress={openHmrcAccount}>
          View full breakdown on HMRC
        </MtdActionButton>
      )}
    </YStack>
  )
}
