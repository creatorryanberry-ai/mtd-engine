import { SizableText, XStack, YStack } from 'tamagui'

import { InfoIcon } from '~/interface/icons/phosphor/InfoIcon'
import { ShieldIcon } from '~/interface/icons/phosphor/ShieldIcon'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import type { ConfidenceLevel } from '~/features/taxEstimate/types'

export function EstimateConfidenceCard({
  level,
  message,
  completionPercent,
}: {
  level: ConfidenceLevel
  message: string
  completionPercent: number
}) {
  const filled = Math.min(4, Math.max(1, Math.ceil((completionPercent / 100) * 4)))
  const tone = level === 'high' ? '#166534' : level === 'medium' ? '#B45309' : '#6B7280'

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      gap="$3"
    >
      <XStack items="center" justify="space-between" gap="$3">
        <XStack items="center" gap="$2" flex={1} minW={0}>
          <ShieldIcon size={22} color={tone} />
          <SizableText fontSize={16} fontWeight="700" color={MTD_TOKENS.text}>
            Estimate confidence
          </SizableText>
          <InfoIcon size={16} color={MTD_TOKENS.textSubtle} />
        </XStack>
        <XStack
          items="center"
          gap="$1.5"
          px="$2.5"
          py="$1"
          rounded="$10"
          style={{ backgroundColor: `${tone}1A` }}
        >
          <YStack width={8} height={8} rounded="$10" style={{ backgroundColor: tone }} />
          <SizableText fontSize={12} fontWeight="700" style={{ color: tone }}>
            {level.toUpperCase()}
          </SizableText>
        </XStack>
      </XStack>

      <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
        {message}
      </SizableText>

      <XStack gap="$1.5" width="100%">
        {Array.from({ length: 4 }, (_, index) => (
          <YStack
            key={index}
            flex={1}
            height={8}
            rounded="$10"
            style={{ backgroundColor: index < filled ? tone : undefined }}
            bg={index < filled ? undefined : MTD_TOKENS.cardInset}
          />
        ))}
      </XStack>
    </YStack>
  )
}
