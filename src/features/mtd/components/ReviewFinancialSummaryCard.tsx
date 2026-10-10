import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'
import { useHmrcTaxEstimate } from '~/features/hmrc/client/useHmrcTaxEstimate'
import { useReviewFinancialSummary } from '~/features/submission/client/useReviewFinancialSummary'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'

import { MTD_TOKENS } from '../mtdTokens'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'

type SummaryRow = {
  key: string
  label: string
  value: number
  emphasis?: 'default' | 'profit' | 'muted'
  hint?: string
}

type SummaryRowProps = {
  label: string
  value: number
  emphasis?: 'default' | 'profit' | 'muted'
  hint?: string
  isLast: boolean
}

function SummaryListRow({
  label,
  value,
  emphasis = 'default',
  hint,
  isLast,
}: SummaryRowProps) {
  const valueColor =
    emphasis === 'profit'
      ? MTD_TOKENS.orange
      : emphasis === 'muted'
        ? MTD_TOKENS.textMuted
        : MTD_TOKENS.text

  return (
    <XStack
      px="$4"
      py="$3.5"
      items="center"
      justify="space-between"
      gap="$3"
      borderBottomWidth={isLast ? 0 : 1}
      borderColor={MTD_TOKENS.cardBorder}
    >
      <YStack flex={1} minW={0} gap="$0.5">
        <SizableText
          fontSize={14}
          fontWeight={emphasis === 'profit' ? '600' : '500'}
          color={MTD_TOKENS.text}
        >
          {label}
        </SizableText>
        {hint ? (
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
            {hint}
          </SizableText>
        ) : null}
      </YStack>
      <SizableText
        fontSize={emphasis === 'profit' ? 16 : 14}
        fontWeight={emphasis === 'profit' ? '700' : '600'}
        color={valueColor}
        shrink={0}
      >
        {formatSubmissionAmount(value)}
      </SizableText>
    </XStack>
  )
}

export function ReviewFinancialSummaryCard() {
  const { summary, isLoading, error } = useReviewFinancialSummary()
  const { status: hmrcStatus } = useHmrcConnection()
  const { estimate: hmrcEstimate } = useHmrcTaxEstimate(
    hmrcStatus.configured && hmrcStatus.connected,
  )

  // tax: same as homepage (HMRC total / income tax, else 15% of profit)
  // NI: HMRC NICs when available, else Class 4 local estimate
  const hmrcIncomeTax = hmrcEstimate?.incomeTaxAmount
  const hmrcNic = hmrcEstimate?.totalNicAmount
  const hmrcTotal = hmrcEstimate?.totalIncomeTaxAndNicsDue

  const estimatedTax =
    hmrcIncomeTax != null
      ? hmrcIncomeTax
      : hmrcTotal != null
        ? hmrcTotal
        : summary && summary.profit > 0
          ? summary.estimatedTax
          : null

  const estimatedNationalInsurance =
    hmrcNic != null ? hmrcNic : summary ? summary.estimatedNationalInsurance : null

  const taxHint =
    hmrcIncomeTax != null || hmrcTotal != null
      ? 'From HMRC in-year calculation'
      : '15% of profit'

  const niHint = hmrcNic != null ? 'From HMRC in-year calculation' : 'Class 4 estimate'

  const rows: SummaryRow[] = summary
    ? [
        {
          key: 'income',
          label: 'Income',
          value: summary.income,
        },
        {
          key: 'expenses',
          label: 'Expenses',
          value: summary.expenses,
        },
        {
          key: 'profit',
          label: 'Profit',
          value: summary.profit,
          emphasis: 'profit',
        },
        ...(estimatedTax != null
          ? [
              {
                key: 'tax',
                label: 'Estimated tax',
                value: estimatedTax,
                emphasis: 'muted' as const,
                hint: taxHint,
              },
            ]
          : []),
        ...(estimatedNationalInsurance != null
          ? [
              {
                key: 'ni',
                label: 'Estimated National Insurance',
                value: estimatedNationalInsurance,
                emphasis: 'muted' as const,
                hint: niHint,
              },
            ]
          : []),
        ...(summary.showCisTax
          ? [
              {
                key: 'cis',
                label: 'CIS tax already paid',
                value: summary.cisTaxPaid,
                emphasis: 'muted' as const,
                hint: 'From accepted CIS vouchers',
              },
            ]
          : []),
      ]
    : []

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack gap="$1" flex={1} minW={0}>
          <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
            Financial summary
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            {summary
              ? `Accepted transactions · ${summary.taxYearLabel} to date`
              : 'Accepted transactions this tax year'}
          </SizableText>
        </YStack>
        {summary ? (
          <MtdAccentMutedBg px="$2.5" py="$1.5" rounded="$10">
            <SizableText fontSize={11} fontWeight="600" color={MTD_TOKENS.orange}>
              {summary.quarterLabel}
            </SizableText>
          </MtdAccentMutedBg>
        ) : null}
      </XStack>

      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        overflow="hidden"
      >
        {isLoading && !summary ? (
          <XStack px="$4" py="$6" items="center" justify="center" gap="$2">
            <Spinner size="small" color={MTD_TOKENS.orange} />
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              Loading summary…
            </SizableText>
          </XStack>
        ) : error && !summary ? (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} px="$4" py="$4">
            {error}
          </SizableText>
        ) : (
          rows.map((row, index) => (
            <SummaryListRow
              key={row.key}
              label={row.label}
              value={row.value}
              emphasis={row.emphasis}
              hint={row.hint}
              isLast={index === rows.length - 1}
            />
          ))
        )}
      </YStack>
    </YStack>
  )
}
