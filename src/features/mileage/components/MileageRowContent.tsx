import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import {
  formatMileageClaimPounds,
  formatMileageDisplayDate,
} from '~/features/mileage/utils/mileageClaim'
import { formatMileageJourneyDescription } from '~/features/mileage/utils/mileageSeriesFormat'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { ArrowsClockwiseIcon } from '~/interface/icons/phosphor/ArrowsClockwiseIcon'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'

type MileageRowContentProps = {
  entry: MileageEntryDto
  fromLocation?: string | null
  onPress?: () => void
  onPressSeries?: () => void
  trailing?: ReactNode
}

export function MileageRowContent({
  entry,
  fromLocation,
  onPress,
  onPressSeries,
  trailing,
}: MileageRowContentProps) {
  const { brand } = useBrandTheme()
  const description = entry.seriesId
    ? formatMileageJourneyDescription(fromLocation, entry.journeyDetails)
    : entry.journeyDetails

  return (
    <XStack
      px="$3"
      py="$3"
      gap="$2"
      borderBottomWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      bg={MTD_TOKENS.card}
      items="center"
    >
      <YStack flex={1} gap="$1">
        <XStack items="center" gap="$3">
          <SizableText
            flex={1}
            fontSize={12}
            fontWeight="300"
            color={MTD_TOKENS.textMuted}
            cursor={onPress ? 'pointer' : undefined}
            pressStyle={onPress ? { opacity: 0.85 } : undefined}
            onPress={onPress}
          >
            {formatMileageDisplayDate(entry.date)}
          </SizableText>
          <SizableText
            flex={1}
            fontSize={14}
            fontWeight="700"
            color={MTD_TOKENS.text}
            text="right"
            cursor={onPress ? 'pointer' : undefined}
            pressStyle={onPress ? { opacity: 0.85 } : undefined}
            onPress={onPress}
          >
            {entry.miles.toLocaleString('en-GB')}
          </SizableText>
          <SizableText
            flex={1}
            fontSize={12}
            fontWeight="300"
            color={MTD_TOKENS.textMuted}
            text="right"
            cursor={onPress ? 'pointer' : undefined}
            onPress={onPress}
          >
            {entry.rateLabel}
          </SizableText>
          <SizableText
            flex={1}
            fontSize={14}
            fontWeight="700"
            color={MTD_TOKENS.text}
            text="right"
            cursor={onPress ? 'pointer' : undefined}
            onPress={onPress}
          >
            {formatMileageClaimPounds(entry.claimPounds)}
          </SizableText>
        </XStack>
        <XStack items="center" gap="$1.5">
          {entry.seriesId ? (
            <XStack
              shrink={0}
              cursor={onPressSeries ? 'pointer' : undefined}
              pressStyle={onPressSeries ? { opacity: 0.8 } : undefined}
              onPress={onPressSeries}
              pointerEvents="box-only"
            >
              <ArrowsClockwiseIcon size={14} color={brand.colors.accentIcon} />
            </XStack>
          ) : null}
          <SizableText
            flex={1}
            fontSize={15}
            fontWeight="600"
            color={MTD_TOKENS.text}
            numberOfLines={2}
            cursor={onPress ? 'pointer' : undefined}
            pressStyle={onPress ? { opacity: 0.85 } : undefined}
            onPress={onPress}
          >
            {description}
          </SizableText>
        </XStack>
      </YStack>
      {trailing}
    </XStack>
  )
}
