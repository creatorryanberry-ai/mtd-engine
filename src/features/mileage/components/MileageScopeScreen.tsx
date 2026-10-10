import { SizableText, YStack } from 'tamagui'

import { formatMileageDisplayDate } from '~/features/mileage/utils/mileageClaim'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { isWeb } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'
import type { MileageSeriesDto } from '~/features/mileage/mileageSeriesTypes'

export type MileageEditScope = 'this' | 'thisAndFuture' | 'entireSeries'

export function MileageScopeScreen({
  mode,
  entry,
  series,
  onSelect,
  onClose,
}: {
  mode: 'edit' | 'delete'
  entry: MileageEntryDto
  series: MileageSeriesDto | null
  onSelect: (scope: MileageEditScope) => void
  onClose: () => void
}) {
  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <ScopeContent
          mode={mode}
          entry={entry}
          series={series}
          onSelect={onSelect}
          onClose={requestClose}
        />
      )}
    </SlideFromRightPanel>
  )
}

function ScopeContent({
  mode,
  entry,
  series,
  onSelect,
  onClose,
}: {
  mode: 'edit' | 'delete'
  entry: MileageEntryDto
  series: MileageSeriesDto | null
  onSelect: (scope: MileageEditScope) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const { brand } = useBrandTheme()
  const range = series
    ? `${formatMileageDisplayDate(series.startDate)} – ${formatMileageDisplayDate(series.endDate)}`
    : formatMileageDisplayDate(entry.date)

  const question =
    mode === 'delete' ? 'What would you like to delete?' : 'What would you like to edit?'

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack
        px="$4"
        pt={isWeb ? '$3' : insets.top + 12}
        pb="$3"
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
          Cancel
        </SizableText>
      </YStack>

      <YStack px="$4" pt="$5" gap="$4" maxW={720} width="100%" self="center">
        <SizableText fontSize={22} fontWeight="700" color={MTD_TOKENS.text}>
          {question}
        </SizableText>

        <ScopeOption
          title={mode === 'delete' ? 'This journey only' : 'This journey only'}
          subtitle={formatMileageDisplayDate(entry.date)}
          onPress={() => onSelect('this')}
        />
        <ScopeOption
          title="This and future journeys"
          subtitle={`From ${formatMileageDisplayDate(entry.date)} onwards`}
          onPress={() => onSelect('thisAndFuture')}
        />
        <ScopeOption
          title="Entire series"
          subtitle={range}
          onPress={() => onSelect('entireSeries')}
        />

        <YStack
          bg={brand.colors.accentMutedBg}
          borderWidth={1}
          borderColor={brand.colors.accentBorder}
          rounded="$4"
          p="$3"
        >
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={19}>
            {mode === 'delete'
              ? 'Deleting the whole series stops it repeating. Journeys already in your log stay unless you delete them separately.'
              : 'Editing future journeys will not change excluded dates or past entries.'}
          </SizableText>
        </YStack>
      </YStack>
    </YStack>
  )
}

function ScopeOption({
  title,
  subtitle,
  onPress,
}: {
  title: string
  subtitle: string
  onPress: () => void
}) {
  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      gap="$1"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
        {title}
      </SizableText>
      <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
        {subtitle}
      </SizableText>
    </YStack>
  )
}
