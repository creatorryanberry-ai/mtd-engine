import { useCallback, useEffect, useMemo, useState } from 'react'
import { SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'
import { useHmrcTaxEstimate } from '~/features/hmrc/client/useHmrcTaxEstimate'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { formatDisplayTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { useReviewFinancialSummary } from '~/features/submission/client/useReviewFinancialSummary'
import { useSubmissionsOverview } from '~/features/submission/client/useSubmissionsOverview'
import { LockIcon } from '~/interface/icons/phosphor/LockIcon'
import { showToast } from '~/interface/toast/helpers'

import {
  EMPTY_YEAR_END_ANSWERS,
  loadYearEndReviewAnswers,
  saveYearEndReviewAnswers,
  type YearEndReviewAnswers,
} from './yearEndReviewAnswersStorage'
import {
  loadYearEndReviewProgress,
  markYearEndReviewCompleted,
  markYearEndReviewStepAnswered,
} from './yearEndReviewProgressStorage'
import { YearEndReviewStepBody } from './YearEndReviewStepBody'
import {
  canContinueYearEndStep,
  getFirstUnansweredYearEndStepIndex,
  getYearEndReviewSteps,
} from './yearEndReviewSteps'

function ProgressSegments({
  stepIndex,
  totalSteps,
}: {
  stepIndex: number
  totalSteps: number
}) {
  return (
    <XStack gap="$1.5" width="100%">
      {Array.from({ length: totalSteps }, (_, index) => (
        <YStack
          key={index}
          flex={1}
          height={4}
          rounded="$10"
          bg={index <= stepIndex ? MTD_TOKENS.orange : MTD_TOKENS.cardInset}
        />
      ))}
    </XStack>
  )
}

export function YearEndReviewWizard() {
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYear } = useSelectedTaxYear()
  const taxYearStart = taxYear.start
  const { summary, isLoading, error } = useReviewFinancialSummary('Q4')
  const { overview } = useSubmissionsOverview()
  const { status: hmrcStatus } = useHmrcConnection()
  const { estimate: hmrcEstimate } = useHmrcTaxEstimate(
    hmrcStatus.configured && hmrcStatus.connected,
  )

  const [answers, setAnswers] = useState<YearEndReviewAnswers>(() =>
    userId ? loadYearEndReviewAnswers(userId, taxYearStart) : EMPTY_YEAR_END_ANSWERS,
  )
  const [completed, setCompleted] = useState(() =>
    userId ? loadYearEndReviewProgress(userId, taxYearStart).completed : false,
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  const steps = useMemo(() => getYearEndReviewSteps(), [])

  useEffect(() => {
    if (!userId) return
    const loadedAnswers = loadYearEndReviewAnswers(userId, taxYearStart)
    const progress = loadYearEndReviewProgress(userId, taxYearStart)
    setAnswers(loadedAnswers)
    setCompleted(progress.completed)
    setStepIndex(
      getFirstUnansweredYearEndStepIndex({
        answeredStepIds: progress.answeredStepIds,
      }),
    )
    setHydrated(true)
  }, [taxYearStart, userId])

  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(Math.max(0, steps.length - 1))
    }
  }, [stepIndex, steps.length])

  const persistAnswers = useCallback(
    (next: YearEndReviewAnswers) => {
      setAnswers(next)
      if (userId) {
        saveYearEndReviewAnswers(userId, taxYearStart, next)
      }
    },
    [taxYearStart, userId],
  )

  const currentStep = steps[stepIndex] ?? steps[0]
  const isLastStep = stepIndex >= steps.length - 1
  const canContinue = currentStep
    ? canContinueYearEndStep(currentStep.id, answers)
    : false

  const hmrcIncomeTax = hmrcEstimate?.incomeTaxAmount
  const hmrcTotal = hmrcEstimate?.totalIncomeTaxAndNicsDue
  const estimatedTax =
    hmrcIncomeTax != null
      ? hmrcIncomeTax
      : hmrcTotal != null
        ? hmrcTotal
        : summary && summary.profit > 0
          ? summary.estimatedTax
          : null

  const quarters = overview?.quarters ?? []
  const submittedCount = quarters.filter(
    (quarter) => quarter.status === 'submitted',
  ).length
  const quarterlyComplete = quarters.length > 0 && submittedCount === quarters.length

  const markCurrentAnswered = useCallback(() => {
    if (!userId || !currentStep) return
    markYearEndReviewStepAnswered(userId, taxYearStart, currentStep.id)
  }, [currentStep, taxYearStart, userId])

  const goNext = useCallback(() => {
    if (!canContinue || !currentStep) return
    markCurrentAnswered()
    if (isLastStep) return
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }, [canContinue, currentStep, isLastStep, markCurrentAnswered, steps.length])

  const goPrev = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const onSubmit = useCallback(() => {
    if (!userId) return
    markCurrentAnswered()
    const next = markYearEndReviewCompleted(userId, taxYearStart)
    setCompleted(next.completed)
    showToast('Year-end review complete', {
      type: 'success',
      message: 'Final declaration to HMRC coming soon.',
    })
  }, [markCurrentAnswered, taxYearStart, userId])

  if (!hydrated || (isLoading && !summary)) {
    return (
      <YStack py="$8" items="center" gap="$2">
        <Spinner size="large" color={MTD_TOKENS.orange} />
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          Loading year-end review…
        </SizableText>
      </YStack>
    )
  }

  if (error && !summary) {
    return (
      <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
        {error}
      </SizableText>
    )
  }

  if (!currentStep) return null

  const showCompleteCta = currentStep.id === 'complete'
  const showSubtitle =
    currentStep.id !== 'complete' && currentStep.subtitle.trim().length > 0

  return (
    <YStack flex={1} gap="$5">
      <YStack gap="$3">
        <YStack gap="$1">
          <SizableText
            fontSize={15}
            fontWeight="600"
            color={MTD_TOKENS.orange}
            letterSpacing={1}
          >
            YEAR END · {formatDisplayTaxYear(taxYearStart)} · {stepIndex + 1} OF{' '}
            {steps.length}
          </SizableText>
          <ProgressSegments stepIndex={stepIndex} totalSteps={steps.length} />
        </YStack>

        <YStack gap="$2">
          <SizableText
            fontSize={24}
            fontWeight="700"
            color={MTD_TOKENS.text}
            letterSpacing={-0.4}
            lineHeight={32}
            $lg={{ fontSize: 28, lineHeight: 36 }}
          >
            {currentStep.id === 'complete'
              ? 'Your year is complete! 🎉'
              : currentStep.question}
          </SizableText>
          {showSubtitle ? (
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
              {currentStep.subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </YStack>

      <YearEndReviewStepBody
        stepId={currentStep.id}
        answers={answers}
        estimatedTax={estimatedTax}
        income={summary?.income ?? 0}
        expenses={summary?.expenses ?? 0}
        profit={summary?.profit ?? 0}
        quarterlyComplete={quarterlyComplete}
        quarterlySubmittedLabel={
          quarterlyComplete
            ? `${submittedCount} Quarterly Updates Submitted`
            : `${submittedCount} of ${quarters.length || 4} Quarterly Updates Submitted`
        }
        onChange={persistAnswers}
      />

      {showCompleteCta ? (
        <YStack gap="$2" mt={24}>
          <MtdActionButton
            size="large"
            width="100%"
            disabled={completed}
            icon={<LockIcon size={18} color={MTD_TOKENS.onOrange} />}
            onPress={onSubmit}
          >
            {completed ? 'Submitted' : 'Submit Final Tax Return'}
          </MtdActionButton>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
            {completed
              ? 'Year-end information saved. HMRC declaration coming soon.'
              : 'Send your final return to HMRC.'}
          </SizableText>
          {stepIndex > 0 ? (
            <MtdActionButton
              size="large"
              width="100%"
              variant="secondary"
              onPress={goPrev}
            >
              Previous
            </MtdActionButton>
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$3" mt={24}>
          <MtdActionButton
            size="large"
            width="100%"
            disabled={!canContinue}
            onPress={goNext}
          >
            Continue
          </MtdActionButton>
          {stepIndex > 0 ? (
            <MtdActionButton
              size="large"
              width="100%"
              variant="secondary"
              onPress={goPrev}
            >
              Previous
            </MtdActionButton>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}
