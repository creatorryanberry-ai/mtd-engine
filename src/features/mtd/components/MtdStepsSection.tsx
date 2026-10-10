import { SizableText, XStack, YStack } from 'tamagui'

import { useMtdCategoriseStats } from '~/features/categorisation/client/useMtdCategoriseStats'
import { useSubmissionsOverview } from '~/features/submission/client/useSubmissionsOverview'
import { formatSubmissionTimestamp } from '~/features/mtd/utils/formatAmount'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'
import { CloudArrowUpIcon } from '~/interface/icons/phosphor/CloudArrowUpIcon'
import { TagIcon } from '~/interface/icons/phosphor/TagIcon'

import { MTD_ROUTES, MTD_STEPS } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { StepCard } from './StepCard'

function useStepIcons() {
  const { brand } = useBrandTheme()
  const iconColor = brand.colors.accentIcon

  return [
    <BankIcon key="bank" size={26} color={iconColor} />,
    <TagIcon key="tag" size={26} color={iconColor} />,
    <CloudArrowUpIcon key="cloud" size={26} color={iconColor} />,
  ]
}

const stepHrefs: Partial<Record<number, (typeof MTD_ROUTES)[keyof typeof MTD_ROUTES]>> = {
  1: MTD_ROUTES.records,
  2: MTD_ROUTES.categoriseTransactions,
  3: MTD_ROUTES.submissions,
}

function getStepStatus(
  step: (typeof MTD_STEPS)[number],
  categoriseStats: {
    categorised: number
    total: number
    toReview: number
    progress: number
  },
  submissionSummary: ReturnType<typeof useSubmissionsOverview>['overview'],
  activeQuarterLabel: string,
  activeQuarterPeriodLabel: string,
  activeQuarterDeadlineLabel: string,
) {
  if (step.step === 1) {
    const { categorised, total, toReview, progress } = categoriseStats
    return {
      statusLabel:
        total > 0 ? `${categorised} of ${total} Categorised` : 'No transactions yet',
      statusSubLabel: toReview > 0 ? `${toReview} to review` : undefined,
      statusComplete: total > 0 && toReview === 0,
      progress: total > 0 ? progress : undefined,
    }
  }

  if (step.step === 2) {
    const { total, toReview } = categoriseStats
    if (total === 0) {
      return {
        statusLabel: 'No transactions yet',
        statusComplete: false,
      }
    }

    if (toReview > 0) {
      return {
        statusLabel: `${toReview} to review`,
        statusSubLabel: `${activeQuarterLabel} · ${activeQuarterPeriodLabel}`,
        statusComplete: false,
      }
    }

    return {
      statusLabel: 'All categorised',
      statusSubLabel: `${activeQuarterLabel} · ready to review`,
      statusComplete: true,
    }
  }

  if (step.step === 3) {
    const activeQuarter = submissionSummary?.quarters.find(
      (quarter) => quarter.quarterId === submissionSummary.activeQuarterId,
    )

    if (activeQuarter?.status === 'submitted') {
      return {
        statusLabel: 'Submitted',
        statusSubLabel: activeQuarter.submittedAt
          ? formatSubmissionTimestamp(activeQuarter.submittedAt)
          : `${activeQuarterLabel}: ${activeQuarterPeriodLabel}`,
        statusComplete: true,
        progress: undefined,
      }
    }

    if (categoriseStats.toReview > 0) {
      return {
        statusLabel: `${categoriseStats.toReview} to review`,
        statusSubLabel: 'Before you can submit',
        statusComplete: false,
        progress: undefined,
      }
    }

    return {
      statusLabel: activeQuarter?.statusLabel ?? 'Not ready',
      statusSubLabel: `${activeQuarterLabel} · Due ${activeQuarterDeadlineLabel}`,
      statusComplete: activeQuarter?.status === 'readyToSubmit',
      progress: undefined,
    }
  }

  return { statusLabel: '', statusComplete: undefined, progress: undefined }
}

function StepCards() {
  const stepIcons = useStepIcons()
  const { stats: categoriseStats } = useMtdCategoriseStats()
  const { overview: submissionOverview } = useSubmissionsOverview()

  const activeQuarter = submissionOverview?.quarters.find(
    (quarter) => quarter.quarterId === submissionOverview.activeQuarterId,
  )
  const taxYearLabel = submissionOverview?.taxYear.label ?? ''
  const activeQuarterLabel = activeQuarter
    ? `${activeQuarter.label} · ${taxYearLabel}`
    : ''
  const activeQuarterPeriodLabel = activeQuarter?.hmrcUpdatePeriodLabel ?? ''
  const activeQuarterDeadlineLabel = activeQuarter?.deadlineLabel ?? ''

  return MTD_STEPS.map((step, index) => {
    const { statusLabel, statusSubLabel, statusComplete, progress } = getStepStatus(
      step,
      categoriseStats,
      submissionOverview,
      activeQuarterLabel,
      activeQuarterPeriodLabel,
      activeQuarterDeadlineLabel,
    )

    return (
      <StepCard
        key={step.step}
        step={step.step}
        title={step.title}
        description={step.description}
        icon={stepIcons[index]}
        statusLabel={statusLabel}
        statusSubLabel={statusSubLabel}
        statusComplete={statusComplete}
        progress={progress}
        actionLabel={step.actionLabel}
        href={stepHrefs[step.step]}
      />
    )
  })
}

export function MtdStepsSection() {
  return (
    <YStack gap="$3">
      <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
        Your 3 steps to MTD done right
      </SizableText>

      <YStack gap="$3" $lg={{ display: 'none' }}>
        <StepCards />
      </YStack>

      <XStack gap="$3" display="none" items="stretch" $lg={{ display: 'flex' }}>
        <StepCards />
      </XStack>
    </YStack>
  )
}
