import { router } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useTaxEstimate } from '~/features/taxEstimate/client/useTaxEstimate'
import { EstimatePoundsText } from '~/features/taxEstimate/components/EstimatePoundsText'

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <XStack items="center" justify="space-between" gap="$3" py="$2">
      <SizableText
        fontSize={14}
        color={muted ? MTD_TOKENS.textMuted : MTD_TOKENS.text}
        flex={1}
      >
        {label}
      </SizableText>
      <EstimatePoundsText pounds={value} fontSize={14} fontWeight="600" />
    </XStack>
  )
}

export function EstimatedTaxBreakdownScreen() {
  const insets = useSafeAreaInsets()
  const { data, isLoading, error, refetch } = useTaxEstimate()
  const calculation = data?.calculation
  const breakdown = calculation?.breakdown

  const content = (
    <YStack
      gap="$4"
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={560}
      width="100%"
      mx="auto"
    >
      {error && !calculation ? (
        <YStack py="$8" items="center" gap="$3">
          <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
            Could not load this estimate
          </SizableText>
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
            {error instanceof Error ? error.message : 'Please try again.'}
          </SizableText>
          <MtdActionButton onPress={() => void refetch()}>Try again</MtdActionButton>
        </YStack>
      ) : isLoading || !calculation || !breakdown ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : (
        <>
          <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text}>
            How this is calculated
          </SizableText>
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
            A plain-English look at the numbers behind your {calculation.taxYearLabel}{' '}
            estimate.
          </SizableText>

          {breakdown.projectionNote ? (
            <SizableText fontSize={14} color={MTD_TOKENS.text} lineHeight={20}>
              {breakdown.projectionNote}
            </SizableText>
          ) : null}

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
          >
            <Row label="Business profit" value={breakdown.businessProfit} />
            <Row label="Employment income" value={breakdown.employmentIncome} />
            <Row label="Savings interest" value={breakdown.savingsInterest} />
            <Row label="Dividends" value={breakdown.dividends} />
            <Row label="Property" value={breakdown.propertyProfit} />
            <Row label="Pensions" value={breakdown.pensionIncome} />
            <Row label="Other income" value={breakdown.otherIncome} />
            <YStack height={1} bg={MTD_TOKENS.cardBorder} my="$2" />
            <Row label="Total income" value={breakdown.totalIncome} />
            <Row label="Personal Allowance" value={-breakdown.personalAllowance} muted />
            <Row label="Taxable income" value={breakdown.taxableIncome} />
          </YStack>

          {breakdown.nonSavingsSlices.length > 0 ? (
            <YStack
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              p="$4"
            >
              <SizableText fontSize={16} fontWeight="700" mb="$2" color={MTD_TOKENS.text}>
                Income Tax
              </SizableText>
              {breakdown.nonSavingsSlices.map((slice) => (
                <Row
                  key={`${slice.label}-${slice.rate}`}
                  label={`${slice.label} (${Math.round(slice.rate * 100)}%)`}
                  value={slice.tax}
                />
              ))}
            </YStack>
          ) : null}

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
          >
            <SizableText fontSize={16} fontWeight="700" mb="$2" color={MTD_TOKENS.text}>
              Class 4 National Insurance
            </SizableText>
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted} mb="$2">
              This only applies to your self-employed profit, not wages, rent or
              dividends.
            </SizableText>
            <Row
              label="Profit in the main band"
              value={breakdown.class4.profitWithinMainBand}
            />
            <Row
              label="Profit above the upper limit"
              value={breakdown.class4.profitAboveUpperLimit}
            />
            <Row label="Class 4 NI" value={breakdown.class4.total} />
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
          >
            <SizableText fontSize={16} fontWeight="700" mb="$2" color={MTD_TOKENS.text}>
              Already taken off
            </SizableText>
            <Row
              label="Taken from your pay"
              value={calculation.alreadyPaidBreakdown.paye}
            />
            <Row
              label="Taken from pensions"
              value={calculation.alreadyPaidBreakdown.pension}
            />
            <Row label="CIS tax deducted" value={calculation.alreadyPaidBreakdown.cis} />
            <Row label="Student Loan" value={calculation.studentLoan} />
          </YStack>

          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} lineHeight={18}>
            {calculation.disclaimer}
          </SizableText>
        </>
      )}
    </YStack>
  )

  const header = (
    <MtdDetailHeader
      backHref={MTD_ROUTES.estimatedTaxSummary}
      title="How this is calculated"
      skipSlideClose
      onBack={() => router.replace(MTD_ROUTES.estimatedTaxSummary)}
    />
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        {header}
        <YStack flex={1} minH={0} overflow="scroll">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>{header}</YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}
