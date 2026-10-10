import type { Href } from 'one'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { router, useFocusEffect } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import { useMtdCategoriseStats } from '~/features/categorisation/client/useMtdCategoriseStats'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { useReviewFinancialSummary } from '~/features/submission/client/useReviewFinancialSummary'
import { useSubmissionsOverview } from '~/features/submission/client/useSubmissionsOverview'
import { composeHapticPressIn } from '~/interface/haptics/haptics'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'

import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

type WorkflowTone = 'record' | 'review' | 'submit'

const toneStyles = {
  record: {
    card: {
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    circle: { backgroundColor: '#22C55E' },
    label: { color: '#22C55E' },
    circleText: { color: '#04140A' },
    income: { color: '#22C55E' },
  },
  review: {
    card: {
      backgroundColor: 'rgba(217, 119, 6, 0.14)',
      borderColor: 'rgba(217, 119, 6, 0.22)',
    },
    circle: { backgroundColor: '#D97706' },
    label: { color: '#D97706' },
    circleText: { color: '#1A0E02' },
    income: { color: '#D97706' },
  },
  submit: {
    card: {
      backgroundColor: 'rgba(168, 85, 247, 0.14)',
      borderColor: 'rgba(168, 85, 247, 0.22)',
    },
    circle: { backgroundColor: '#A855F7' },
    label: { color: '#A855F7' },
    circleText: { color: '#14081F' },
    income: { color: '#A855F7' },
  },
} as const

type WorkflowCardProps = {
  step: number
  tone: WorkflowTone
  eyebrow: string
  title: string
  subtitle?: string
  footer?: string
  footerAccent?: boolean
  href?: Href | string
  onPress?: () => void
  children?: ReactNode
}

function WorkflowCard({
  step,
  tone,
  eyebrow,
  title,
  subtitle,
  footer,
  footerAccent,
  href,
  onPress,
  children,
}: WorkflowCardProps) {
  const colors = toneStyles[tone]

  return (
    <YStack
      width="100%"
      borderWidth={1}
      rounded="$5"
      p="$4"
      gap="$2.5"
      cursor="pointer"
      onPress={() => {
        if (onPress) {
          onPress()
          return
        }
        if (href) {
          router.push(href as Href)
        }
      }}
      onPressIn={composeHapticPressIn()}
      pressStyle={{ opacity: 0.92 }}
      $lg={{ flex: 1 }}
      style={colors.card}
    >
      <XStack items="flex-start" justify="space-between" gap="$3">
        <XStack items="center" gap="$2.5" flex={1} minW={0}>
          <YStack
            width={28}
            height={28}
            rounded="$10"
            items="center"
            justify="center"
            shrink={0}
            style={colors.circle}
          >
            <SizableText fontSize={14} fontWeight="700" style={colors.circleText}>
              {step}
            </SizableText>
          </YStack>
          <SizableText
            fontSize={13}
            fontWeight="700"
            letterSpacing={1.2}
            textTransform="uppercase"
            style={colors.label}
          >
            {eyebrow}
          </SizableText>
        </XStack>
        <CaretRightIcon size={18} color={MTD_TOKENS.textMuted} />
      </XStack>

      <YStack gap="$1" pr="$4">
        <SizableText fontSize={18} fontWeight="600" color={MTD_TOKENS.text}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>

      {children}

      {footer ? (
        <SizableText
          fontSize={13}
          fontWeight="600"
          color={footerAccent ? MTD_TOKENS.orange : MTD_TOKENS.textMuted}
          mt="$1"
        >
          {footer}
        </SizableText>
      ) : null}
    </YStack>
  )
}

function formatCompactPounds(amount: number) {
  return `£${Math.round(Math.abs(amount)).toLocaleString('en-GB')}`
}

function WorkflowCards() {
  const { setSelectedQuarterId } = useSelectedTaxYear()
  const { stats: categoriseStats } = useMtdCategoriseStats()
  const { overview: submissionOverview } = useSubmissionsOverview()
  const activeQuarterId = submissionOverview?.activeQuarterId ?? null
  const { summary: financialSummary } = useReviewFinancialSummary(activeQuarterId)

  // keep review/submit period in sync with submissions (skips submitted quarters)
  useEffect(() => {
    if (!activeQuarterId) return
    setSelectedQuarterId(activeQuarterId)
  }, [activeQuarterId, setSelectedQuarterId])

  useFocusEffect(() => {
    if (!activeQuarterId) return
    setSelectedQuarterId(activeQuarterId)
  }, [activeQuarterId, setSelectedQuarterId])

  const activeQuarter = submissionOverview?.quarters.find(
    (quarter) => quarter.quarterId === submissionOverview.activeQuarterId,
  )

  const income = financialSummary?.income ?? 0
  const expenses = financialSummary?.expenses ?? 0

  const reviewPeriodLabel = activeQuarter
    ? `${activeQuarter.label} · ${activeQuarter.hmrcUpdatePeriodLabel}`
    : 'Current quarter'

  const reviewFooter =
    categoriseStats.toReview > 0
      ? `${categoriseStats.toReview} thing${categoriseStats.toReview === 1 ? '' : 's'} to check`
      : categoriseStats.total > 0
        ? 'All caught up'
        : 'No transactions yet'

  const submitTitle = activeQuarter
    ? `${activeQuarter.label} submission`
    : 'Quarterly submission'

  const submitSubtitle = activeQuarter?.deadlineLabel
    ? `Due ${activeQuarter.deadlineLabel}`
    : 'Submit when ready'

  const submitFooter =
    activeQuarter?.status === 'submitted'
      ? 'Submitted'
      : categoriseStats.toReview > 0
        ? 'Review required'
        : (activeQuarter?.statusLabel ?? 'Not ready')

  const submitFooterAccent =
    activeQuarter?.status !== 'submitted' &&
    (categoriseStats.toReview > 0 || activeQuarter?.status !== 'readyToSubmit')

  return (
    <>
      <WorkflowCard
        step={1}
        tone="record"
        eyebrow="Record"
        title="Keep your money up to date"
        href={MTD_ROUTES.records}
      >
        <XStack gap="$4" mt="$1" flexWrap="wrap">
          <SizableText fontSize={14} fontWeight="600" style={toneStyles.record.income}>
            {formatCompactPounds(income)} Income
          </SizableText>
          <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.textMuted}>
            {formatCompactPounds(expenses)} Expenses
          </SizableText>
        </XStack>
      </WorkflowCard>

      <WorkflowCard
        step={2}
        tone="review"
        eyebrow="Review"
        title={reviewPeriodLabel}
        subtitle="Make sure nothing's been missed"
        footer={reviewFooter}
        onPress={() => {
          if (activeQuarterId) {
            setSelectedQuarterId(activeQuarterId)
          }
          router.push(MTD_ROUTES.categoriseTransactions as Href)
        }}
      />

      <WorkflowCard
        step={3}
        tone="submit"
        eyebrow="Submit"
        title={submitTitle}
        subtitle={submitSubtitle}
        footer={submitFooter}
        footerAccent={submitFooterAccent}
        href={MTD_ROUTES.submissions}
      />
    </>
  )
}

export function HomeWorkflowSection() {
  return (
    <YStack gap="$3">
      <YStack gap="$3" $lg={{ display: 'none' }}>
        <WorkflowCards />
      </YStack>

      <XStack gap="$3" display="none" items="stretch" $lg={{ display: 'flex' }}>
        <WorkflowCards />
      </XStack>
    </YStack>
  )
}
