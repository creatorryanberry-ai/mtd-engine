import { useMemo } from 'react'
import { router } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { QuarterStatusRow } from '~/features/mtd/components/QuarterStatusRow'
import { TaxYearSelector } from '~/features/mtd/components/TaxYearSelector'
import { isYearEndReviewCompleted } from '~/features/mtd/components/year-end-review/yearEndReviewProgressStorage'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { useSubmissionsOverview } from '~/features/submission/client/useSubmissionsOverview'

export function SubmissionsOverviewScreen() {
  const insets = useSafeAreaInsets()
  const auth = useAuth()
  const userId = auth?.user?.id
  const { taxYear } = useSelectedTaxYear()
  const { overview, isLoading } = useSubmissionsOverview()

  const yearEndCompleted = useMemo(
    () => (userId ? isYearEndReviewCompleted(userId, taxYear.start) : false),
    [taxYear.start, userId],
  )

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
      <YStack gap="$3">
        <TaxYearSelector />
      </YStack>

      {isLoading && (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      )}

      {overview && (
        <>
          <YStack gap="$3">
            <SizableText
              fontSize={12}
              fontWeight="600"
              color={MTD_TOKENS.textMuted}
              letterSpacing={1}
            >
              QUARTERLY UPDATES
            </SizableText>
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              Keep HMRC up to date throughout the year
            </SizableText>

            <YStack gap="$2.5">
              {overview.quarters.map((quarter) => (
                <QuarterStatusRow
                  key={quarter.quarterId}
                  quarterLabel={`${quarter.label} · ${taxYear.label}`}
                  periodLabel={quarter.periodLabel}
                  statusLabel={quarter.statusLabel}
                  status={quarter.status}
                  subLabel={
                    quarter.status === 'submitted'
                      ? undefined
                      : `Due ${quarter.deadlineLabel}`
                  }
                  onPress={() => {
                    router.push(`${MTD_ROUTES.submissions}/${quarter.quarterId}` as any)
                  }}
                />
              ))}
            </YStack>
          </YStack>

          <YStack gap="$3">
            <SizableText
              fontSize={12}
              fontWeight="600"
              color={MTD_TOKENS.textMuted}
              letterSpacing={1}
            >
              YEAR END
            </SizableText>
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              Pre-submit review before your final tax return
            </SizableText>

            <QuarterStatusRow
              quarterLabel={`Year End Review · ${overview.yearEnd.taxYearLabel}`}
              statusLabel={
                yearEndCompleted || overview.yearEnd.status === 'completed'
                  ? 'Completed'
                  : 'Ready to start'
              }
              status={
                yearEndCompleted || overview.yearEnd.status === 'completed'
                  ? 'submitted'
                  : 'readyForReview'
              }
              subLabel={overview.yearEnd.periodLabel}
              onPress={() => router.push(MTD_ROUTES.yearEnd as any)}
            />
          </YStack>
        </>
      )}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Submissions" />
        <YStack flex={1} minH={0} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Submissions" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}
