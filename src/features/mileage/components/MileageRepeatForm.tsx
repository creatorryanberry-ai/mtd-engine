import { SizableText, XStack, YStack } from 'tamagui'

import { MileageFormCard } from '~/features/mileage/components/MileageFormCard'
import { MileageSeriesPreviewCard } from '~/features/mileage/components/MileageSeriesPreviewCard'
import { MileageWeekdayChips } from '~/features/mileage/components/MileageWeekdayChips'
import {
  DEFAULT_WEEKLY_WEEKDAYS,
  MILEAGE_SERIES_VALIDATION_MESSAGES,
  generateMileageOccurrences,
  validateMileageSeriesInput,
} from '~/features/mileage/utils/mileageOccurrences'
import { previewMileageSeriesClaim } from '~/features/mileage/utils/mileageSeriesPreview'
import { Input } from '~/interface/forms/Input'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { ArrowsDownUpIcon } from '~/interface/icons/phosphor/ArrowsDownUpIcon'
import { CalendarIcon } from '~/interface/icons/phosphor/CalendarIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { MapPinIcon } from '~/interface/icons/phosphor/MapPinIcon'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'
import type { MileageRecurrenceType } from '~/features/mileage/utils/mileageOccurrences'

export type MileageRepeatDraft = {
  fromLocation: string
  journeyDetails: string
  miles: string
  includesReturnJourney: boolean
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
  startDate: string
  endDate: string
  excludedDates: string[]
}

export function parsePositiveMiles(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const REPEAT_OPTIONS: { id: MileageRecurrenceType; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export function MileageRepeatForm({
  draft,
  onChange,
  existingEntries,
  submitLabelPrefix,
  isSaving,
  onSubmit,
  onOpenExcludeDates,
}: {
  draft: MileageRepeatDraft
  onChange: (next: MileageRepeatDraft) => void
  existingEntries: MileageEntryDto[]
  submitLabelPrefix: 'Create' | 'Save'
  isSaving?: boolean
  onSubmit: () => void
  onOpenExcludeDates: () => void
}) {
  const { brand } = useBrandTheme()
  const parsedMiles = parsePositiveMiles(draft.miles)
  const occurrenceInput = {
    recurrenceType: draft.recurrenceType,
    selectedWeekdays: draft.selectedWeekdays,
    startDate: draft.startDate,
    endDate: draft.endDate,
    excludedDates: draft.excludedDates,
  }
  const dates = generateMileageOccurrences(occurrenceInput)
  const issue = validateMileageSeriesInput({
    journeyDetails: draft.journeyDetails,
    milesPerJourney: parsedMiles,
    ...occurrenceInput,
  })
  const preview = previewMileageSeriesClaim({
    dates: issue ? [] : dates,
    milesPerJourney: parsedMiles ?? 0,
    journeyDetails: draft.journeyDetails,
    existingEntries,
  })
  const eachWay =
    draft.includesReturnJourney && parsedMiles != null ? parsedMiles / 2 : null
  const canSubmit = issue == null && parsedMiles != null && !isSaving

  const patch = (partial: Partial<MileageRepeatDraft>) => {
    onChange({ ...draft, ...partial })
  }

  return (
    <YStack gap="$4">
      <MileageFormCard>
        <FieldLabel>From</FieldLabel>
        <XStack items="center" gap="$2">
          <HouseIcon size={18} color={MTD_TOKENS.textMuted} />
          <Input
            flex={1}
            value={draft.fromLocation}
            onChangeText={(fromLocation) => patch({ fromLocation })}
            placeholder="Home"
            autoCapitalize="sentences"
            {...mtdInputProps}
          />
        </XStack>
        <XStack justify="center" py="$1">
          <YStack
            width={36}
            height={36}
            items="center"
            justify="center"
            rounded="$10"
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={() =>
              patch({
                fromLocation: draft.journeyDetails,
                journeyDetails: draft.fromLocation,
              })
            }
          >
            <ArrowsDownUpIcon size={16} color={MTD_TOKENS.textMuted} />
          </YStack>
        </XStack>
        <FieldLabel>To / Journey description</FieldLabel>
        <XStack items="center" gap="$2">
          <MapPinIcon size={18} color={MTD_TOKENS.textMuted} />
          <Input
            flex={1}
            value={draft.journeyDetails}
            onChangeText={(journeyDetails) => patch({ journeyDetails })}
            placeholder="Client site, Sheffield"
            autoCapitalize="sentences"
            {...mtdInputProps}
          />
        </XStack>
      </MileageFormCard>

      <MileageFormCard>
        <FieldLabel>Miles per journey</FieldLabel>
        <Input
          value={draft.miles}
          onChangeText={(miles) => patch({ miles })}
          placeholder="0"
          keyboardType="decimal-pad"
          {...mtdInputProps}
        />
        <XStack
          items="center"
          gap="$3"
          cursor="pointer"
          pressStyle={{ opacity: 0.9 }}
          onPress={() => patch({ includesReturnJourney: !draft.includesReturnJourney })}
        >
          <YStack
            width={22}
            height={22}
            rounded="$2"
            borderWidth={1.5}
            borderColor={
              draft.includesReturnJourney
                ? brand.colors.accentIcon
                : MTD_TOKENS.cardBorder
            }
            bg={draft.includesReturnJourney ? brand.colors.accent : 'transparent'}
            items="center"
            justify="center"
          >
            {draft.includesReturnJourney ? (
              <CheckIcon size={12} color={brand.colors.onAccent} />
            ) : null}
          </YStack>
          <YStack flex={1} gap="$0.5">
            <SizableText fontSize={14} fontWeight="500" color={MTD_TOKENS.text}>
              This includes return journey
            </SizableText>
            {eachWay != null ? (
              <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
                {Number.isInteger(eachWay) ? eachWay : eachWay.toFixed(1)} miles each way
              </SizableText>
            ) : null}
          </YStack>
        </XStack>
      </MileageFormCard>

      <MileageFormCard>
        <FieldLabel>Repeat</FieldLabel>
        <XStack gap="$2">
          {REPEAT_OPTIONS.map((option) => (
            <RepeatChip
              key={option.id}
              label={option.label}
              selected={draft.recurrenceType === option.id}
              onPress={() =>
                patch({
                  recurrenceType: option.id,
                  selectedWeekdays:
                    option.id === 'weekly' && draft.selectedWeekdays.length === 0
                      ? DEFAULT_WEEKLY_WEEKDAYS
                      : draft.selectedWeekdays,
                })
              }
            />
          ))}
        </XStack>
        {draft.recurrenceType === 'weekly' ? (
          <MileageWeekdayChips
            selected={draft.selectedWeekdays}
            onChange={(selectedWeekdays) => patch({ selectedWeekdays })}
          />
        ) : null}
        <XStack gap="$3">
          <YStack flex={1} gap="$1.5">
            <FieldLabel>Start date</FieldLabel>
            <MtdDatePicker
              value={draft.startDate}
              onChange={(startDate) => patch({ startDate })}
              maxDate={false}
            />
          </YStack>
          <YStack flex={1} gap="$1.5">
            <FieldLabel>End date</FieldLabel>
            <MtdDatePicker
              value={draft.endDate}
              onChange={(endDate) => patch({ endDate })}
              minDate={draft.startDate}
              maxDate={false}
            />
          </YStack>
        </XStack>
      </MileageFormCard>

      <XStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        p="$4"
        items="center"
        gap="$3"
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={onOpenExcludeDates}
        pointerEvents="box-only"
      >
        <CalendarIcon size={20} color={brand.colors.accentIcon} />
        <YStack flex={1} gap="$0.5">
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            Exclude dates
          </SizableText>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            Holidays, sickness, bank holidays or days you did not travel
          </SizableText>
        </YStack>
        <SizableText fontSize={14} fontWeight="600" color={brand.colors.accentIcon}>
          {draft.excludedDates.length === 0
            ? 'None'
            : `${draft.excludedDates.length} date${draft.excludedDates.length === 1 ? '' : 's'}`}
        </SizableText>
        <CaretRightIcon size={16} color={brand.colors.accentIcon} />
      </XStack>

      <MileageSeriesPreviewCard
        journeyCount={preview.journeyCount}
        totalMiles={preview.totalMiles}
        claimPounds={preview.claimPounds}
        submitLabel={`${submitLabelPrefix} ${preview.journeyCount} mileage ${preview.journeyCount === 1 ? 'entry' : 'entries'}`}
        disabled={!canSubmit}
        loading={isSaving}
        onSubmit={onSubmit}
      />

      {issue ? (
        <SizableText fontSize={13} color={MTD_TOKENS.orange}>
          {MILEAGE_SERIES_VALIDATION_MESSAGES[issue]}
        </SizableText>
      ) : null}
    </YStack>
  )
}

function FieldLabel({ children }: { children: string }) {
  return (
    <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
      {children}
    </SizableText>
  )
}

function RepeatChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const { borderColor, textColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      row
      flex={1}
      items="center"
      justify="center"
      py="$2.5"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <SizableText fontSize={13} fontWeight={selected ? '600' : '500'} color={textColor}>
        {label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

export function draftToWriteInput(draft: MileageRepeatDraft) {
  const miles = parsePositiveMiles(draft.miles)
  if (miles == null) return null
  return {
    fromLocation: draft.fromLocation.trim() || null,
    journeyDetails: draft.journeyDetails.trim(),
    milesPerJourney: miles,
    includesReturnJourney: draft.includesReturnJourney,
    recurrenceType: draft.recurrenceType,
    selectedWeekdays: draft.selectedWeekdays,
    startDate: draft.startDate,
    endDate: draft.endDate,
    excludedDates: draft.excludedDates,
  }
}
