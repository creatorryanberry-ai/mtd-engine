import { SizableText, XStack, YStack } from 'tamagui'

import {
  formatMileageClaimPounds,
  formatMileageDisplayDate,
} from '~/features/mileage/utils/mileageClaim'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'

import { MileageFormCard } from './MileageFormCard'

export function MileageSeriesPreviewCard({
  journeyCount,
  totalMiles,
  claimPounds,
  submitLabel,
  disabled,
  loading,
  onSubmit,
}: {
  journeyCount: number
  totalMiles: number
  claimPounds: number
  submitLabel: string
  disabled?: boolean
  loading?: boolean
  onSubmit: () => void
}) {
  return (
    <MileageFormCard accent>
      <XStack justify="space-between" gap="$2">
        <PreviewStat value={String(journeyCount)} label="Journeys" flex={0.7} />
        <PreviewStat
          value={totalMiles.toLocaleString('en-GB')}
          label="Business miles"
          flex={1}
        />
        <PreviewStat
          value={formatMileageClaimPounds(claimPounds)}
          label="Estimated claim"
          flex={1.5}
        />
      </XStack>
      <MtdActionButton
        size="large"
        width="100%"
        disabled={disabled}
        loading={loading}
        onPress={onSubmit}
      >
        {submitLabel}
      </MtdActionButton>
    </MileageFormCard>
  )
}

function PreviewStat({
  value,
  label,
  flex,
}: {
  value: string
  label: string
  flex: number
}) {
  return (
    <YStack flex={flex} items="center" gap="$1" minW={0}>
      <SizableText
        fontSize={22}
        fontWeight="700"
        color={MTD_TOKENS.text}
        numberOfLines={1}
      >
        {value}
      </SizableText>
      <SizableText
        fontSize={11}
        color={MTD_TOKENS.textMuted}
        text="center"
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </YStack>
  )
}

export function formatExcludedDatesSummary(dates: string[]): string {
  if (dates.length === 0) return 'None'
  if (dates.length === 1) return formatMileageDisplayDate(dates[0]!)
  return `${dates.length} dates`
}
