import { router } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import {
  getTaxYearStart,
  listAvailableTaxYears,
} from '~/features/mtd/utils/quarterPeriods'

export function NewTaxYearBanner() {
  const { taxYearStart, setTaxYearStart } = useSelectedTaxYear()
  const currentTaxYearStart = getTaxYearStart()
  const previousTaxYear = listAvailableTaxYears().find(
    (year) => year.start !== currentTaxYearStart,
  )

  if (taxYearStart === currentTaxYearStart || !previousTaxYear) {
    return null
  }

  return (
    <YStack gap="$3">
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        p="$4"
        gap="$2"
      >
        <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
          Finish {previousTaxYear.label}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          Your year-end tax return for the previous tax year may still be outstanding.
        </SizableText>
        <XStack gap="$2">
          <MtdActionButton
            flex={1}
            variant="secondary"
            onPress={() => setTaxYearStart(previousTaxYear.start)}
          >
            Continue {previousTaxYear.label}
          </MtdActionButton>
          <MtdActionButton flex={1} onPress={() => setTaxYearStart(currentTaxYearStart)}>
            Start {listAvailableTaxYears()[0]?.label}
          </MtdActionButton>
        </XStack>
      </YStack>
    </YStack>
  )
}

export function NewTaxYearPrompt() {
  const currentTaxYear = listAvailableTaxYears()[0]

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$4"
      gap="$2"
    >
      <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
        Your new tax year is ready
      </SizableText>
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
        We&apos;ve set up {currentTaxYear?.label ?? 'your new tax year'} for you. You can
        start recording income and expenses now.
      </SizableText>
      <MtdActionButton onPress={() => router.push(MTD_ROUTES.submissions as any)}>
        Open submissions
      </MtdActionButton>
    </YStack>
  )
}
