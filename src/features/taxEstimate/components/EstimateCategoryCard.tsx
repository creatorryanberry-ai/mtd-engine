import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { WarningCircleIcon } from '~/interface/icons/phosphor/WarningCircleIcon'
import { composeHapticPressIn } from '~/interface/haptics/haptics'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import type { CategoryAnswerStatus } from '~/features/taxEstimate/types'

export function EstimateCategoryCard({
  title,
  question,
  icon,
  iconBg,
  iconColor,
  status,
  onPress,
}: {
  title: string
  question: string
  icon: ReactNode
  iconBg: string
  iconColor: string
  status: CategoryAnswerStatus
  onPress: () => void
}) {
  return (
    <YStack
      flex={1}
      minW={0}
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$3"
      gap="$2"
      cursor="pointer"
      pressStyle={{ opacity: 0.92 }}
      onPress={onPress}
      onPressIn={composeHapticPressIn()}
    >
      <XStack items="center" justify="space-between">
        <YStack
          width={36}
          height={36}
          rounded="$10"
          items="center"
          justify="center"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </YStack>
        {status === 'complete' || status === 'no' ? (
          <CheckIcon size={16} color={iconColor} />
        ) : status === 'needs_review' || status === 'incomplete' ? (
          <WarningCircleIcon size={16} color="#D97706" />
        ) : (
          <CaretRightIcon size={16} color={MTD_TOKENS.textSubtle} />
        )}
      </XStack>
      <SizableText fontSize={14} fontWeight="700" color={MTD_TOKENS.text}>
        {title}
      </SizableText>
      <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={16}>
        {question}
      </SizableText>
    </YStack>
  )
}
