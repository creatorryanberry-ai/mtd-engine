import { SizableText, XStack, YStack } from 'tamagui'

import type { CategorisationStats } from '~/features/categorisation/client/useMtdCategorise'
import { MtdActionButton } from './MtdActionButton'
import { MTD_TOKENS } from '../mtdTokens'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { SparkleIcon } from '~/interface/icons/phosphor/SparkleIcon'

type CategoriseSummaryFooterProps = {
  stats: CategorisationStats
  selectedCount: number
  isReviewing: boolean
  onReviewPress: () => void
  onReviewAllPress: () => void
}

export function CategoriseSummaryFooter({
  stats,
  selectedCount,
  isReviewing,
  onReviewPress,
  onReviewAllPress,
}: CategoriseSummaryFooterProps) {
  const colors = useMtdThemeColors()
  const canReview = selectedCount > 0 && !isReviewing
  const canReviewAll = stats.toReview > 0 && !isReviewing

  return (
    <YStack gap="$4">
      <XStack gap="$3" flexDirection="column" $md={{ flexDirection: 'row' }}>
        <XStack
          flex={1}
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          p="$3.5"
          gap="$3"
          items="center"
        >
          <YStack
            width={40}
            height={40}
            rounded="$10"
            items="center"
            justify="center"
            style={{ backgroundColor: `${colors.purple}22` }}
          >
            <SparkleIcon size={20} color={MTD_TOKENS.purple} />
          </YStack>
          <YStack gap="$0.5">
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
              Auto-categorised
            </SizableText>
            <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
              {stats.categorised} transactions
            </SizableText>
          </YStack>
        </XStack>

        <XStack
          flex={1}
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          p="$3.5"
          gap="$3"
          items="center"
        >
          <YStack
            width={40}
            height={40}
            rounded="$10"
            bg={MTD_TOKENS.orangeMuted}
            items="center"
            justify="center"
          >
            <CheckCircleIcon size={20} color={MTD_TOKENS.orange} />
          </YStack>
          <YStack gap="$0.5">
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
              To review
            </SizableText>
            <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
              {stats.toReview} transactions
            </SizableText>
          </YStack>
        </XStack>
      </XStack>

      <XStack
        gap="$3"
        flexDirection="column"
        $sm={{ flexDirection: 'row', items: 'center' }}
      >
        <YStack
          px="$4"
          py="$3.5"
          items="center"
          justify="center"
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          flex={1}
        >
          <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.textMuted}>
            Skip for now
          </SizableText>
        </YStack>
        <MtdActionButton
          flex={1}
          size="large"
          variant="secondary"
          disabled={!canReviewAll}
          loading={isReviewing}
          onPress={onReviewAllPress}
        >
          {isReviewing ? 'Reviewing...' : `Review all (${stats.toReview})`}
        </MtdActionButton>
        <MtdActionButton
          flex={2}
          size="large"
          disabled={!canReview}
          loading={isReviewing}
          onPress={onReviewPress}
        >
          {isReviewing
            ? 'Reviewing...'
            : `Review ${selectedCount} transaction${selectedCount === 1 ? '' : 's'}`}
        </MtdActionButton>
      </XStack>
    </YStack>
  )
}
