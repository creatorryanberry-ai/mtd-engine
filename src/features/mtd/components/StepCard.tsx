import type { Href } from 'one'
import type { ReactNode } from 'react'
import { router } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { composeHapticPressIn } from '~/interface/haptics/haptics'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { MtdActionButton } from './MtdActionButton'
import { CircularProgress } from './CircularProgress'

/** Fixed height for step action buttons — matches single-line status row (e.g. View). */

type StepCardProps = {
  step: number
  title: string
  description: string
  icon: ReactNode
  statusLabel: string
  statusSubLabel?: string
  statusComplete?: boolean
  progress?: number
  actionLabel: string
  href?: Href | string
}

function StepStatus({
  statusLabel,
  statusSubLabel,
  statusComplete,
  progress,
}: Pick<
  StepCardProps,
  'statusLabel' | 'statusSubLabel' | 'statusComplete' | 'progress'
>) {
  return (
    <XStack gap="$2.5" items="center" flex={1} self="stretch">
      {progress !== undefined && (
        <YStack shrink={0}>
          <CircularProgress progress={progress} size={36} />
        </YStack>
      )}
      <YStack flex={1} gap="$0.5" minW={0} justify="center">
        <XStack items="center" gap="$1">
          <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.text}>
            {statusLabel}
          </SizableText>
          {statusComplete && <CheckIcon size={14} color={MTD_TOKENS.orange} />}
        </XStack>
        {statusSubLabel && (
          <SizableText fontSize={11} color={MTD_TOKENS.orange} lineHeight={14}>
            {statusSubLabel}
          </SizableText>
        )}
      </YStack>
    </XStack>
  )
}

function StepAction({ actionLabel }: Pick<StepCardProps, 'actionLabel'>) {
  return (
    <MtdActionButton size="compact" fontSize={15} pointerEvents="none">
      {actionLabel}
    </MtdActionButton>
  )
}

export function StepCard({
  href,
  step,
  title,
  description,
  icon,
  statusLabel,
  statusSubLabel,
  statusComplete,
  progress,
  actionLabel,
}: StepCardProps) {
  const { brand } = useBrandTheme()
  const statusProps = {
    statusLabel,
    statusSubLabel,
    statusComplete,
    progress,
  }

  const handlePress = href
    ? () => {
        router.push(href as Href)
      }
    : undefined

  return (
    <YStack
      width="100%"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$3.5"
      gap="$3.5"
      cursor={href ? 'pointer' : undefined}
      onPress={handlePress}
      onPressIn={handlePress ? composeHapticPressIn() : undefined}
      pressStyle={{ opacity: 0.9 }}
      hoverStyle={href ? { borderColor: MTD_TOKENS.orange } : undefined}
      accessibilityRole={href ? 'link' : undefined}
      accessibilityLabel={href ? title : undefined}
      $lg={{ flex: 1 }}
    >
      <XStack gap="$3" items="flex-start">
        <MtdAccentMutedBg
          width={52}
          height={52}
          rounded="$4"
          items="center"
          justify="center"
          shrink={0}
          mr={4}
        >
          {icon}
        </MtdAccentMutedBg>

        <YStack flex={1} gap="$1.5" minW={0}>
          <XStack items="center" gap="$2">
            <YStack
              width={29}
              height={29}
              rounded="$10"
              bg={brand.colors.stepCircleActive}
              items="center"
              justify="center"
              shrink={0}
            >
              <SizableText
                fontSize={16}
                fontWeight="700"
                color={brand.colors.stepCircleActiveText}
              >
                {step}
              </SizableText>
            </YStack>
            <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text} flex={1}>
              {title}
            </SizableText>
          </XStack>

          <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={16}>
            {description}
          </SizableText>
        </YStack>
      </XStack>

      <XStack gap="$2" width="100%" items="center" $lg={{ mt: 'auto' }}>
        <YStack flex={1} minW={0} justify="center">
          <StepStatus {...statusProps} />
        </YStack>
        <StepAction actionLabel={actionLabel} />
      </XStack>
    </YStack>
  )
}
