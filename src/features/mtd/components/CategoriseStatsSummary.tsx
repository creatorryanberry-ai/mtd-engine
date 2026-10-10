import { SizableText, XStack, YStack } from 'tamagui'

import type { CategorisationStats } from '~/features/categorisation/client/useMtdCategorise'
import { MTD_TOKENS } from '../mtdTokens'
import { CircularProgress } from './CircularProgress'

type CategoriseStatsSummaryProps = {
  stats: CategorisationStats
  progressSize?: number
  labelFontSize?: number
  subLabelFontSize?: number
}

export function CategoriseStatsSummary({
  stats,
  progressSize = 52,
  labelFontSize = 14,
  subLabelFontSize = 12,
}: CategoriseStatsSummaryProps) {
  if (stats.total === 0) {
    return (
      <SizableText fontSize={labelFontSize} fontWeight="600" color={MTD_TOKENS.textMuted}>
        No transactions yet
      </SizableText>
    )
  }

  return (
    <XStack gap="$3" items="center">
      <CircularProgress progress={stats.progress} size={progressSize} />
      <YStack gap="$0.5">
        <SizableText fontSize={labelFontSize} fontWeight="600" color={MTD_TOKENS.text}>
          {stats.categorised} of {stats.total} Categorised
        </SizableText>
        {stats.toReview > 0 ? (
          <SizableText fontSize={subLabelFontSize} color={MTD_TOKENS.orange}>
            {stats.toReview} to review
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  )
}
