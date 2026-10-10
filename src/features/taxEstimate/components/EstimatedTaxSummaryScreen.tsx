import { router } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useTaxEstimate } from '~/features/taxEstimate/client/useTaxEstimate'
import { EstimateConfidenceCard } from '~/features/taxEstimate/components/EstimateConfidenceCard'
import { EstimatePoundsText } from '~/features/taxEstimate/components/EstimatePoundsText'
import { ArrowSquareOutIcon } from '~/interface/icons/phosphor/ArrowSquareOutIcon'

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <XStack items="center" justify="space-between" gap="$3" py="$2">
      <SizableText
        fontSize={strong ? 16 : 14}
        fontWeight={strong ? '700' : '500'}
        color={MTD_TOKENS.text}
        flex={1}
      >
        {label}
      </SizableText>
      <EstimatePoundsText
        pounds={value}
        fontSize={strong ? 16 : 14}
        fontWeight={strong ? '700' : '600'}
      />
    </XStack>
  )
}

export function EstimatedTaxSummaryScreen() {
  const insets = useSafeAreaInsets()
  const { data, isLoading, error, refetch } = useTaxEstimate()
  const calculation = data?.calculation

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
      ) : isLoading || !calculation ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : (
        <>
          <SizableText fontSize={24} fontWeight="700" color={MTD_TOKENS.text}>
            Your estimated tax position
          </SizableText>
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
            {calculation.taxYearLabel}
          </SizableText>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
            gap="$1"
          >
            <Row label="Estimated Income Tax" value={calculation.incomeTax} />
            <Row label="Estimated Class 4 NI" value={calculation.class4Ni} />
            <Row label="Student Loan" value={calculation.studentLoan} />
            <Row label="Child Benefit Charge" value={calculation.childBenefitCharge} />
            <Row label="Estimated CGT" value={calculation.capitalGainsTax} />
            {calculation.cgtNote ? (
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                {calculation.cgtNote}
              </SizableText>
            ) : null}
            <YStack height={1} bg={MTD_TOKENS.cardBorder} my="$2" />
            <Row label="Estimated total liability" value={calculation.totalLiability} />
            <Row label="Already paid / deducted" value={calculation.alreadyPaid} />
            <YStack height={1} bg={MTD_TOKENS.cardBorder} my="$2" />
            <Row
              label="Estimated amount still to pay"
              value={calculation.stillToPay}
              strong
            />
          </YStack>

          {calculation.paymentsOnAccount.required ? (
            <YStack
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              p="$4"
              gap="$1"
            >
              <SizableText fontSize={16} fontWeight="700" color={MTD_TOKENS.text} mb="$2">
                Potential Payments on Account
              </SizableText>
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted} mb="$2">
                These are advance payments towards next year's tax, not part of this
                year's bill.
              </SizableText>
              <Row
                label="31 January"
                value={calculation.paymentsOnAccount.januaryTotal}
              />
              <Row label="31 July" value={calculation.paymentsOnAccount.julyPayment} />
            </YStack>
          ) : null}

          <EstimateConfidenceCard
            level={calculation.confidence.level}
            message={calculation.confidence.message}
            completionPercent={calculation.confidence.completionPercent}
          />

          {calculation.class2Note ? (
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
              {calculation.class2Note}
            </SizableText>
          ) : null}

          <MtdActionButton
            size="large"
            width="100%"
            onPress={() => router.push(MTD_ROUTES.estimatedTaxBreakdown)}
          >
            How is this calculated?
          </MtdActionButton>

          <XStack items="center" gap="$2" justify="center">
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              How is this calculated?
            </SizableText>
            <ArrowSquareOutIcon size={14} color={MTD_TOKENS.textMuted} />
          </XStack>

          <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} lineHeight={18}>
            {calculation.disclaimer}
          </SizableText>
        </>
      )}
    </YStack>
  )

  const header = (
    <MtdDetailHeader
      backHref={MTD_ROUTES.estimatedTax}
      title="Estimate summary"
      skipSlideClose
      onBack={() => router.replace(MTD_ROUTES.estimatedTax)}
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
