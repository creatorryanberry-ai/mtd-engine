import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import type { QuarterStatus } from '~/features/mtd/utils/quarterStatus'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

type QuarterStatusRowProps = {
  quarterLabel: string
  statusLabel: string
  status: QuarterStatus
  periodLabel?: string
  subLabel?: string
  onPress?: () => void
  trailing?: ReactNode
}

function StatusIcon({ status }: { status: QuarterStatus }) {
  if (status === 'submitted') {
    return <CheckIcon size={16} color={MTD_TOKENS.orange} />
  }

  const color =
    status === 'overdue' || status === 'reviewRequired'
      ? MTD_TOKENS.orange
      : status === 'readyToSubmit'
        ? MTD_TOKENS.green
        : MTD_TOKENS.textSubtle

  return (
    <YStack
      width={16}
      height={16}
      rounded="$10"
      borderWidth={2}
      borderColor={color}
      bg={status === 'current' || status === 'readyForReview' ? color : 'transparent'}
    />
  )
}

export function QuarterStatusRow({
  quarterLabel,
  statusLabel,
  status,
  periodLabel,
  subLabel,
  onPress,
  trailing,
}: QuarterStatusRowProps) {
  const isQuiet = status === 'upcoming'

  return (
    <XStack
      gap="$3"
      items="center"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      px="$3.5"
      py="$3.5"
      opacity={isQuiet ? 0.72 : 1}
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.88 } : undefined}
    >
      <StatusIcon status={status} />
      <YStack flex={1} gap="$0.5" minW={0}>
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          {quarterLabel}
        </SizableText>
        {periodLabel ? (
          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
            {periodLabel}
          </SizableText>
        ) : null}
        <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
          {statusLabel}
          {subLabel ? ` · ${subLabel}` : ''}
        </SizableText>
      </YStack>
      {trailing}
    </XStack>
  )
}
