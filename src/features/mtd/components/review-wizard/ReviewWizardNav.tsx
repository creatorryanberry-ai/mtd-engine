import { XStack } from 'tamagui'

import { MtdActionButton } from '../MtdActionButton'

type ReviewWizardNavProps = {
  canGoPrev: boolean
  canGoNext?: boolean
  isLastStep: boolean
  onPrev: () => void
  onNext: () => void
}

export function ReviewWizardNav({
  canGoPrev,
  canGoNext = true,
  isLastStep,
  onPrev,
  onNext,
}: ReviewWizardNavProps) {
  return (
    <XStack gap="$3" width="100%" items="center" mt={40}>
      <MtdActionButton
        flex={1}
        size="large"
        variant="secondary"
        disabled={!canGoPrev}
        onPress={onPrev}
      >
        Previous
      </MtdActionButton>
      <MtdActionButton flex={1} size="large" disabled={!canGoNext} onPress={onNext}>
        {isLastStep ? 'Submit to HMRC' : 'Next'}
      </MtdActionButton>
    </XStack>
  )
}
