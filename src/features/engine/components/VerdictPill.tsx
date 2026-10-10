import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { CircleHalfIcon } from '~/interface/icons/phosphor/CircleHalfIcon'
import { ClockIcon } from '~/interface/icons/phosphor/ClockIcon'
import { XCircleIcon } from '~/interface/icons/phosphor/XCircleIcon'
import { wrapWithTooltip } from '~/interface/tooltip/Tooltip'

import type { LiftVerdictValue } from '~/features/engine/contract'
import type { IconComponent } from '~/interface/icons/types'
import type { ColorTokens } from 'tamagui'

/** status colours are reserved for verdicts and always ship with an icon and a label */
export const VERDICT_COLOR: Record<LiftVerdictValue, ColorTokens> = {
  collecting: '$blue10',
  positive: '$green10',
  negative: '$red10',
  inconclusive: '$color10',
}

export const VERDICT_LABEL: Record<LiftVerdictValue, string> = {
  collecting: 'Collecting',
  positive: 'Positive',
  negative: 'Negative',
  inconclusive: 'Inconclusive',
}

export const VERDICT_HELP: Record<LiftVerdictValue, string> = {
  collecting:
    'At least one group is below the minimum sample, so no call is made yet, whatever the interval shows.',
  positive:
    'Both groups reached the minimum sample and the whole 95% interval is above zero.',
  negative:
    'Both groups reached the minimum sample and the whole 95% interval is below zero.',
  inconclusive:
    'Both groups reached the minimum sample but the 95% interval still includes zero, so the effect could go either way.',
}

const VERDICT_ICON: Record<LiftVerdictValue, IconComponent> = {
  collecting: ClockIcon,
  positive: CheckCircleIcon,
  negative: XCircleIcon,
  inconclusive: CircleHalfIcon,
}

export function VerdictPill({
  verdict,
  showHelp,
}: {
  verdict: LiftVerdictValue
  showHelp?: boolean
}) {
  const color = VERDICT_COLOR[verdict]
  const Icon = VERDICT_ICON[verdict]
  const pill = (
    <XStack
      px="$2"
      py={2}
      rounded="$10"
      borderWidth={1}
      borderColor={color}
      items="center"
      gap="$1.5"
      self="flex-start"
      aria-label={`${VERDICT_LABEL[verdict]}. ${VERDICT_HELP[verdict]}`}
    >
      <Icon size={12} color={color} />
      <SizableText fontSize={11} fontWeight="600" color={MTD_TOKENS.text}>
        {VERDICT_LABEL[verdict]}
      </SizableText>
    </XStack>
  )
  if (!showHelp) {
    return isWeb ? wrapWithTooltip(pill, { tooltip: VERDICT_HELP[verdict] }) : pill
  }
  return (
    <YStack gap="$1">
      {pill}
      <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} lineHeight={16}>
        {VERDICT_HELP[verdict]}
      </SizableText>
    </YStack>
  )
}
