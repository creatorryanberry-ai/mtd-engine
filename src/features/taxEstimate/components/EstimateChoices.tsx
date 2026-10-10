import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { ReviewWizardChoice } from '~/features/mtd/components/review-wizard/ReviewWizardChoice'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

export function EstimateYesNo({
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
}: {
  value: 'yes' | 'no' | 'not_sure' | null
  onChange: (value: 'yes' | 'no') => void
  yesLabel?: string
  noLabel?: string
}) {
  return (
    <XStack gap="$3" width="100%">
      <YStack flex={1}>
        <ReviewWizardChoice
          label={noLabel}
          selected={value === 'no'}
          onPress={() => onChange('no')}
        />
      </YStack>
      <YStack flex={1}>
        <ReviewWizardChoice
          label={yesLabel}
          selected={value === 'yes'}
          onPress={() => onChange('yes')}
        />
      </YStack>
    </XStack>
  )
}

export function EstimateNotSureButton({ onPress }: { onPress: () => void }) {
  return (
    <MtdActionButton variant="secondary" size="large" width="100%" onPress={onPress}>
      Not sure
    </MtdActionButton>
  )
}

export function EstimateHelper({ children }: { children: ReactNode }) {
  return (
    <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
      {children}
    </SizableText>
  )
}
