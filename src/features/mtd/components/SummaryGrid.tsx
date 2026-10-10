import { router, type Href } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'
import {
  useHmrcObligations,
  useHmrcTaxEstimate,
} from '~/features/hmrc/client/useHmrcTaxEstimate'
import { useSubmissionsOverview } from '~/features/submission/client/useSubmissionsOverview'
import { useMtdSubmissionStatus } from '~/features/submission/client/useMtdSubmissionStatus'
import { formatDisplayTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { useTaxEstimate } from '~/features/taxEstimate/client/useTaxEstimate'

import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { composeHapticPressIn } from '~/interface/haptics/haptics'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { CalculatorIcon } from '~/interface/icons/phosphor/CalculatorIcon'
import { CalendarIcon } from '~/interface/icons/phosphor/CalendarIcon'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { FileTextIcon } from '~/interface/icons/phosphor/FileTextIcon'
import { formatSubmissionAmount } from '../utils/formatAmount'

const summaryIcons = {
  calendar: CalendarIcon,
  calculator: CalculatorIcon,
  check: CheckCircleIcon,
  document: FileTextIcon,
} as const

type SummaryItem = {
  label: string
  value: string
  sub: string
  icon: keyof typeof summaryIcons
  href?: Href | string
}

function SummaryCard({ label, value, sub, icon, href }: SummaryItem) {
  const Icon = summaryIcons[icon]

  return (
    <YStack
      flex={1}
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$3.5"
      gap="$2"
      minW={0}
      cursor={href ? 'pointer' : undefined}
      pressStyle={href ? { opacity: 0.92 } : undefined}
      onPress={href ? () => router.push(href as Href) : undefined}
      onPressIn={href ? composeHapticPressIn() : undefined}
    >
      <MtdAccentMutedBg
        width={32}
        height={32}
        rounded="$10"
        items="center"
        justify="center"
      >
        <Icon size={16} color={MTD_TOKENS.orange} />
      </MtdAccentMutedBg>
      <SizableText fontSize={11} color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
      <SizableText fontSize={16} fontWeight="700" color={MTD_TOKENS.orange}>
        {value}
      </SizableText>
      <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
        {sub}
      </SizableText>
    </YStack>
  )
}

export function SummaryGrid() {
  const { overview } = useSubmissionsOverview()
  const activeQuarter = overview?.quarters.find(
    (quarter) => quarter.quarterId === overview.activeQuarterId,
  )
  const { summary } = useMtdSubmissionStatus(activeQuarter?.quarterId)
  const { status: hmrcStatus } = useHmrcConnection()
  const { obligation } = useHmrcObligations()
  const { estimate } = useHmrcTaxEstimate(hmrcStatus.configured && hmrcStatus.connected)
  const { data: taxEstimate } = useTaxEstimate()

  const estimatedTax = taxEstimate?.calculation
    ? formatSubmissionAmount(taxEstimate.calculation.stillToPay)
    : estimate?.totalIncomeTaxAndNicsDue != null
      ? formatSubmissionAmount(estimate.totalIncomeTaxAndNicsDue)
      : summary && summary.taxableProfit > 0
        ? formatSubmissionAmount(summary.taxableProfit * 0.15)
        : '—'

  const nextDue = obligation
    ? new Date(`${obligation.dueDate}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : (activeQuarter?.deadlineLabel ?? '—')

  const hmrcConnectionLabel = !hmrcStatus.configured
    ? 'Not configured'
    : hmrcStatus.connected
      ? 'Connected'
      : 'Not connected'

  const hmrcConnectionSub = !hmrcStatus.configured
    ? 'Sandbox credentials needed'
    : hmrcStatus.connected
      ? (hmrcStatus.businessName ?? 'Self-employment linked')
      : 'Connect in settings'

  const items: SummaryItem[] = [
    {
      label: 'Next submission due',
      value: nextDue,
      sub: obligation
        ? `${obligation.periodStartDate} – ${obligation.periodEndDate}`
        : activeQuarter
          ? `${activeQuarter.quarterId} · ${formatDisplayTaxYear(overview?.taxYear.start ?? '')}`
          : '—',
      icon: 'calendar',
    },
    {
      label: 'Estimated tax',
      value: estimatedTax,
      sub: 'Tap to refine',
      icon: 'calculator',
      href: MTD_ROUTES.estimatedTax,
    },
    {
      label: 'MTD status',
      value: summary?.existingSubmission
        ? 'Submitted'
        : summary?.isReady
          ? 'Ready'
          : 'In progress',
      sub: summary?.existingSubmission ? 'Quarter filed' : "You're on track",
      icon: 'check',
    },
    {
      label: 'HMRC connection',
      value: hmrcConnectionLabel,
      sub: hmrcConnectionSub,
      icon: 'document',
    },
  ]

  return (
    <YStack gap="$3">
      <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
        MTD summary
      </SizableText>

      <YStack gap="$2.5" $md={{ display: 'none' }}>
        <XStack gap="$2.5">
          <SummaryCard {...items[0]} />
          <SummaryCard {...items[1]} />
        </XStack>
        <XStack gap="$2.5">
          <SummaryCard {...items[2]} />
          <SummaryCard {...items[3]} />
        </XStack>
      </YStack>

      <XStack gap="$2.5" display="none" $md={{ display: 'flex' }}>
        {items.map((item) => (
          <SummaryCard key={item.label} {...item} />
        ))}
      </XStack>
    </YStack>
  )
}
