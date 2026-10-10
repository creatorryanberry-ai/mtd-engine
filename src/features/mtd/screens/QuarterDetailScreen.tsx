import { router, useFocusEffect } from 'one'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { useMtdSubmissionStatus } from '~/features/submission/client/useMtdSubmissionStatus'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { type QuarterId } from '~/features/mtd/utils/quarterPeriods'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { dialogConfirm } from '~/interface/dialogs/actions'

import { MtdActionButton } from '../components/MtdActionButton'
import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { loadReviewWizardProgress } from '../components/review-wizard/reviewWizardProgressStorage'
import {
  getReviewProgressLabel,
  getReviewWizardProgressSummary,
} from '../components/review-wizard/reviewWizardSteps'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

type QuarterDetailScreenProps = {
  quarterId: QuarterId
}

export function QuarterDetailScreen({ quarterId }: QuarterDetailScreenProps) {
  const insets = useSafeAreaInsets()
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYear, taxYearStart, setSelectedQuarterId } = useSelectedTaxYear()
  const { settings } = useBusinessSettings()
  const { quarter, summary, isLoading } = useMtdSubmissionStatus(quarterId)
  const [answeredStepIds, setAnsweredStepIds] = useState(() =>
    userId
      ? loadReviewWizardProgress(userId, taxYearStart, quarterId).answeredStepIds
      : [],
  )

  useEffect(() => {
    setSelectedQuarterId(quarterId)
  }, [quarterId, setSelectedQuarterId])

  const refreshProgress = useCallback(() => {
    if (!userId) {
      setAnsweredStepIds([])
      return
    }
    setAnsweredStepIds(
      loadReviewWizardProgress(userId, taxYearStart, quarterId).answeredStepIds,
    )
  }, [quarterId, taxYearStart, userId])

  useFocusEffect(() => {
    refreshProgress()
  }, [refreshProgress])

  const reviewProgress = useMemo(
    () =>
      getReviewWizardProgressSummary({
        showCisStep: settings?.cisRegistered === true,
        showMileageStep: settings?.vehicleClaimMethod === 'mileage',
        answeredStepIds,
        markAllAnswered: Boolean(summary?.existingSubmission),
      }),
    [
      answeredStepIds,
      settings?.cisRegistered,
      settings?.vehicleClaimMethod,
      summary?.existingSubmission,
    ],
  )

  const recordsComplete = Boolean(summary && summary.toReview === 0)
  const reviewLabel = getReviewProgressLabel(reviewProgress)
  const submitComplete = Boolean(summary?.existingSubmission)

  const openReview = useCallback(() => {
    // selectedQuarterId is what ReviewWizard uses; set it synchronously so
    // fast taps don't fall back to the previous active quarter.
    setSelectedQuarterId(quarterId)
    router.push(MTD_ROUTES.categoriseTransactions as any)
  }, [quarterId, setSelectedQuarterId])

  const handleSubmitPress = useCallback(async () => {
    if (summary?.existingSubmission) {
      router.push(MTD_ROUTES.submitToHmrc as any)
      return
    }

    if (!reviewProgress.allAnswered) {
      const continueReview = await dialogConfirm({
        title: 'Review needed',
        description:
          'Finish the review checklist before submitting to HMRC. This checks that nothing important has been missed.',
        confirmText: 'Review',
        icon: 'warning',
      })
      if (continueReview) {
        openReview()
      }
      return
    }

    router.push(MTD_ROUTES.submitToHmrc as any)
  }, [openReview, reviewProgress.allAnswered, summary?.existingSubmission])

  const statusLabel = summary?.existingSubmission
    ? 'Submitted'
    : summary?.isReady && reviewProgress.allAnswered
      ? 'Ready to submit'
      : summary && summary.toReview > 0
        ? 'Review required'
        : reviewProgress.started
          ? 'Review in progress'
          : 'Not started'

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YStack gap="$2">
        <SizableText
          fontSize={12}
          fontWeight="600"
          color={MTD_TOKENS.orange}
          letterSpacing={1}
        >
          {quarter.label} · {taxYear.label}
        </SizableText>
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          HMRC update period: {quarter.hmrcUpdatePeriodLabel}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.orange}>
          Due {quarter.deadlineLabel}
        </SizableText>
        <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
          {statusLabel.toUpperCase()}
        </SizableText>
      </YStack>

      {isLoading && (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      )}

      {summary && (
        <>
          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$4"
            p="$4"
            gap="$3"
          >
            <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
              Progress
            </SizableText>
            <ProgressRow
              complete={recordsComplete}
              label={recordsComplete ? 'Records complete' : 'Records not complete'}
            />
            <ProgressRow
              complete={reviewProgress.allAnswered}
              active={reviewProgress.started && !reviewProgress.allAnswered}
              label={reviewLabel}
            />
            <ProgressRow
              complete={submitComplete}
              label={submitComplete ? 'Submitted' : 'Submit not started'}
            />
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$4"
            p="$4"
            gap="$3"
            cursor="pointer"
            pressStyle={{ opacity: 0.92 }}
            onPress={openReview}
            accessibilityRole="button"
            accessibilityLabel={
              reviewProgress.started ? 'Continue review' : 'Start review'
            }
          >
            <XStack justify="space-between" items="center">
              <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
                Review checklist
              </SizableText>
              <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
                {reviewProgress.answeredCount} of {reviewProgress.totalCount} answered
              </SizableText>
            </XStack>
            {reviewProgress.items.map((item) => (
              <ProgressRow
                key={item.id}
                complete={item.answered}
                label={item.answered ? item.label : `${item.label} · not answered`}
              />
            ))}
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$4"
            p="$4"
            gap="$2.5"
          >
            <SummaryLine
              label="Income"
              value={formatSubmissionAmount(summary.incomeTotal)}
            />
            <SummaryLine
              label="Expenses"
              value={formatSubmissionAmount(summary.expenseTotal)}
            />
            <SummaryLine
              label="Estimated profit"
              value={formatSubmissionAmount(summary.taxableProfit)}
              accent
            />
            <SummaryLine
              label="Estimated tax"
              value={formatSubmissionAmount(Math.max(0, summary.taxableProfit * 0.15))}
            />
          </YStack>

          <XStack gap="$3" flexDirection="column" $md={{ flexDirection: 'row' }}>
            <MtdActionButton
              flex={1}
              size="large"
              variant={reviewProgress.allAnswered ? 'secondary' : 'primary'}
              onPress={openReview}
            >
              {reviewProgress.started ? 'Continue review' : 'Start review'}
            </MtdActionButton>
            <MtdActionButton
              flex={1}
              size="large"
              variant={reviewProgress.allAnswered ? 'primary' : 'secondary'}
              onPress={() => {
                void handleSubmitPress()
              }}
              disabled={!summary.existingSubmission && !summary.isReady}
            >
              {summary.existingSubmission ? 'View submission' : 'Submit to HMRC'}
            </MtdActionButton>
          </XStack>
        </>
      )}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        <MtdDetailHeader
          backHref={MTD_ROUTES.submissions}
          title={`${quarter.label} detail`}
        />
        <YStack flex={1} minH={0} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader
          backHref={MTD_ROUTES.submissions}
          title={`${quarter.label} detail`}
        />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}

function ProgressRow({
  label,
  complete,
  active,
}: {
  label: string
  complete?: boolean
  active?: boolean
}) {
  return (
    <XStack gap="$2.5" items="center">
      {complete ? (
        <CheckIcon size={16} color={MTD_TOKENS.orange} />
      ) : (
        <YStack
          width={14}
          height={14}
          rounded="$10"
          borderWidth={2}
          borderColor={active ? MTD_TOKENS.orange : MTD_TOKENS.textSubtle}
          bg={active ? MTD_TOKENS.orange : 'transparent'}
        />
      )}
      <SizableText fontSize={13} color={MTD_TOKENS.text}>
        {label}
      </SizableText>
    </XStack>
  )
}

function SummaryLine({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <XStack justify="space-between" items="center">
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
      <SizableText
        fontSize={14}
        fontWeight="600"
        color={accent ? MTD_TOKENS.orange : MTD_TOKENS.text}
      >
        {value}
      </SizableText>
    </XStack>
  )
}
