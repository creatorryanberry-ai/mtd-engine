import { ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import {
  formatMileageJourneyDescription,
  formatMileageSeriesRepeatLabel,
  formatMileageSeriesStatus,
  formatMileageSeriesSubtitle,
  getMileageSeriesStatus,
} from '~/features/mileage/utils/mileageSeriesFormat'
import {
  formatMileageClaimPounds,
  formatMileageDisplayDate,
} from '~/features/mileage/utils/mileageClaim'
import { todayIsoDate } from '~/features/mileage/utils/isoDates'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { ArrowsClockwiseIcon } from '~/interface/icons/phosphor/ArrowsClockwiseIcon'
import { CalendarIcon } from '~/interface/icons/phosphor/CalendarIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { PencilSimpleIcon } from '~/interface/icons/phosphor/PencilSimpleIcon'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'

import type { MileageSeriesDto } from '~/features/mileage/mileageSeriesTypes'

export function MileageSeriesDetailsScreen({
  series,
  onClose,
  onEdit,
  onDelete,
  onOpenExcludeDates,
}: {
  series: MileageSeriesDto
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenExcludeDates?: () => void
}) {
  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <SeriesDetailsContent
          series={series}
          onClose={requestClose}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenExcludeDates={onOpenExcludeDates}
        />
      )}
    </SlideFromRightPanel>
  )
}

function SeriesDetailsContent({
  series,
  onClose,
  onEdit,
  onDelete,
  onOpenExcludeDates,
}: {
  series: MileageSeriesDto
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenExcludeDates?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { brand } = useBrandTheme()
  const status = getMileageSeriesStatus(series, todayIsoDate())
  const eachWay = series.includesReturnJourney ? series.milesPerJourney / 2 : null

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <XStack
        px="$4"
        pt={isWeb ? '$3' : insets.top + 12}
        pb="$3"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
      >
        <SizableText
          fontSize={15}
          fontWeight="500"
          color={MTD_TOKENS.textMuted}
          cursor="pointer"
          onPress={onClose}
        >
          Back
        </SizableText>
        <YStack
          width={36}
          height={36}
          rounded="$10"
          bg={brand.colors.accent}
          items="center"
          justify="center"
        >
          <ArrowsClockwiseIcon size={18} color={brand.colors.onAccent} />
        </YStack>
        <YStack width={48} />
      </XStack>

      <RNScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isWeb ? 32 : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <YStack px="$4" pt="$4" gap="$4" maxW={720} width="100%" self="center">
          <YStack gap="$2">
            <XStack items="center" gap="$2" flexWrap="wrap">
              <SizableText
                fontSize={22}
                fontWeight="700"
                color={MTD_TOKENS.text}
                flex={1}
              >
                {formatMileageJourneyDescription(
                  series.fromLocation,
                  series.journeyDetails,
                )}
              </SizableText>
              <YStack
                px="$2.5"
                py="$1"
                rounded="$10"
                bg={status === 'active' ? '$green4' : MTD_TOKENS.cardInset}
              >
                <SizableText
                  fontSize={12}
                  fontWeight="600"
                  color={status === 'active' ? MTD_TOKENS.green : MTD_TOKENS.textMuted}
                >
                  {formatMileageSeriesStatus(status)}
                </SizableText>
              </YStack>
            </XStack>
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
              {formatMileageSeriesSubtitle(series)}
            </SizableText>
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
          >
            <XStack justify="space-between" gap="$3">
              <SummaryStat value={String(series.journeyCount)} label="Journeys" />
              <SummaryStat
                value={series.totalMiles.toLocaleString('en-GB')}
                label="Miles"
              />
              <SummaryStat
                value={formatMileageClaimPounds(series.claimPounds)}
                label="Estimated claim"
              />
            </XStack>
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            overflow="hidden"
          >
            <DetailRow
              label="Miles per journey"
              value={`${series.milesPerJourney.toLocaleString('en-GB')} miles`}
            />
            <DetailRow
              label="Return journey"
              value={
                series.includesReturnJourney
                  ? `Yes${eachWay != null ? ` (${eachWay} miles each way)` : ''}`
                  : 'No'
              }
            />
            <DetailRow label="Repeat" value={formatMileageSeriesRepeatLabel(series)} />
            <DetailRow
              label="Start date"
              value={formatMileageDisplayDate(series.startDate)}
            />
            <DetailRow
              label="End date"
              value={formatMileageDisplayDate(series.endDate)}
            />
            <XStack
              px="$4"
              py="$3.5"
              items="center"
              justify="space-between"
              borderTopWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              cursor={onOpenExcludeDates ? 'pointer' : undefined}
              pressStyle={onOpenExcludeDates ? { opacity: 0.85 } : undefined}
              onPress={onOpenExcludeDates}
            >
              <YStack gap="$0.5">
                <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                  Exclude dates
                </SizableText>
                <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
                  {series.excludedDates.length === 0
                    ? 'None'
                    : `${series.excludedDates.length} dates`}
                </SizableText>
              </YStack>
              <XStack items="center" gap="$2">
                <CalendarIcon size={16} color={MTD_TOKENS.textMuted} />
                {onOpenExcludeDates ? (
                  <CaretRightIcon size={16} color={brand.colors.accentIcon} />
                ) : null}
              </XStack>
            </XStack>
          </YStack>

          <XStack gap="$3">
            <MtdActionButton
              flex={1}
              variant="secondary"
              icon={<PencilSimpleIcon size={16} color={MTD_TOKENS.text} />}
              onPress={onEdit}
            >
              Edit series
            </MtdActionButton>
            <MtdActionButton
              flex={1}
              variant="secondary"
              icon={<TrashIcon size={16} color={MTD_TOKENS.orange} />}
              onPress={onDelete}
            >
              <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.orange}>
                Delete series
              </SizableText>
            </MtdActionButton>
          </XStack>
        </YStack>
      </RNScrollView>
    </YStack>
  )
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <YStack flex={1} items="center" gap="$1">
      <SizableText fontSize={22} fontWeight="700" color={MTD_TOKENS.text}>
        {value}
      </SizableText>
      <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
    </YStack>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack
      px="$4"
      py="$3.5"
      gap="$0.5"
      borderBottomWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
    >
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
        {label}
      </SizableText>
      <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
        {value}
      </SizableText>
    </YStack>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
})
