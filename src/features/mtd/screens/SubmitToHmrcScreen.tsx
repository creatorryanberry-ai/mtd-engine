import { useEffect, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, YStack } from 'tamagui'

import { useQuarterlySubmission } from '~/features/submission/client/useQuarterlySubmission'
import { HmrcTaxEstimateCard } from '~/features/hmrc/components/HmrcTaxEstimateCard'

import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { MtdActionButton } from '../components/MtdActionButton'
import { SubmissionChecklist } from '../components/SubmissionChecklist'
import { SubmissionProgressCard } from '../components/SubmissionProgressCard'
import { SubmissionSuccessCard } from '../components/SubmissionSuccessCard'
import { SubmissionTotalsTable } from '../components/SubmissionTotalsTable'
import { SubmitHeroSection } from '../components/SubmitHeroSection'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

export function SubmitToHmrcScreen() {
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<HTMLElement | null>(null)
  const {
    summary,
    result,
    isLoading,
    isSubmitting,
    submissionPhase,
    error,
    submit,
    resetSuccessView,
    showConfirmation,
  } = useQuarterlySubmission()

  const showSuccess = result !== null
  const showProgress = isSubmitting || submissionPhase !== null
  const activePhase = submissionPhase ?? 'connecting'

  useEffect(() => {
    if (!isWeb || !showProgress) return

    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [showProgress])

  const progressCard = summary ? <SubmissionProgressCard phase={activePhase} /> : null

  const mainContent = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={1200}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6', gap: '$6' }}
    >
      {isLoading && !showProgress && (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      )}

      {!isWeb && showProgress && progressCard}

      {summary && !showProgress && showSuccess && (
        <SubmissionSuccessCard result={result} onStartAgain={resetSuccessView} />
      )}

      {summary && !showProgress && !showSuccess && (
        <>
          <SubmitHeroSection summary={summary} />
          {summary.existingSubmission && (
            <YStack gap="$2">
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                This quarter was already submitted. You can review the totals below.
              </SizableText>
              <SizableText
                fontSize={13}
                fontWeight="600"
                color={MTD_TOKENS.orange}
                cursor="pointer"
                onPress={showConfirmation}
                pressStyle={{ opacity: 0.85 }}
              >
                View confirmation
              </SizableText>
            </YStack>
          )}
          <SubmissionChecklist
            transactionCount={summary.transactionCount}
            toReview={summary.toReview}
            uncategorised={summary.uncategorised}
            blockers={summary.blockers}
          />
          <SubmissionTotalsTable
            categoryLines={summary.categoryLines}
            incomeTotal={summary.incomeTotal}
            expenseTotal={summary.expenseTotal}
            taxableProfit={summary.taxableProfit}
          />
          <HmrcTaxEstimateCard />

          {error && (
            <SizableText fontSize={13} color="#EF4444">
              {error}
            </SizableText>
          )}

          <MtdActionButton
            size="large"
            width="100%"
            loading={isSubmitting}
            disabled={
              !summary.isReady || isSubmitting || Boolean(summary.existingSubmission)
            }
            onPress={submit}
          >
            {summary.existingSubmission ? 'Already submitted' : 'Submit to HMRC'}
          </MtdActionButton>
        </>
      )}

      {!isLoading && !summary && error && (
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          {error}
        </SizableText>
      )}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background} position="relative">
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Submit to HMRC" />
        <YStack ref={scrollRef as any} flex={1} minH={0} overflow="scroll" py="$4">
          {mainContent}
        </YStack>
        {showProgress && (
          <YStack
            position="absolute"
            t={0}
            l={0}
            r={0}
            b={0}
            bg={MTD_TOKENS.background}
            items="center"
            justify="center"
            px="$4"
            py="$6"
            z={20}
          >
            {progressCard}
          </YStack>
        )}
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Submit to HMRC" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {mainContent}
      </ScrollView>
    </YStack>
  )
}
