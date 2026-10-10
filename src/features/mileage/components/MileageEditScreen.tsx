import { useEffect, useRef, useState } from 'react'
import { ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useMileageEntries } from '~/features/mileage/client/useMileageEntries'
import { useMileageSeries } from '~/features/mileage/client/useMileageSeries'
import {
  MileageJourneyModeToggle,
  type MileageJourneyMode,
} from '~/features/mileage/components/MileageJourneyModeToggle'
import { MileageExcludeDatesScreen } from '~/features/mileage/components/MileageExcludeDatesScreen'
import {
  MileageRepeatForm,
  draftToWriteInput,
  parsePositiveMiles,
  type MileageRepeatDraft,
} from '~/features/mileage/components/MileageRepeatForm'
import { confirmDeleteMileageEntry } from '~/features/mileage/utils/confirmDeleteMileageEntry'
import { todayIsoDate } from '~/features/mileage/utils/isoDates'
import {
  calculateMileageClaim,
  formatMileageClaimPounds,
  getCumulativeMilesBeforeEntry,
} from '~/features/mileage/utils/mileageClaim'
import {
  DEFAULT_WEEKLY_WEEKDAYS,
  MILEAGE_SERIES_VALIDATION_MESSAGES,
  validateMileageSeriesInput,
} from '~/features/mileage/utils/mileageOccurrences'
import { Input, type Input as InputElement } from '~/interface/forms/Input'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import {
  MTD_INPUT_FONT_SIZE,
  mtdFieldChrome,
  mtdInputProps,
} from '~/features/mtd/mtdFormStyles'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'
import type { MileageSeriesDto } from '~/features/mileage/mileageSeriesTypes'
import type { MileageEditScope } from '~/features/mileage/components/MileageScopeScreen'

function emptyRepeatDraft(journeyDetails = '', miles = ''): MileageRepeatDraft {
  const today = todayIsoDate()
  return {
    fromLocation: '',
    journeyDetails,
    miles,
    includesReturnJourney: false,
    recurrenceType: 'weekly',
    selectedWeekdays: DEFAULT_WEEKLY_WEEKDAYS,
    startDate: today,
    endDate: today,
    excludedDates: [],
  }
}

function draftFromSeries(
  series: MileageSeriesDto,
  startDate = series.startDate,
): MileageRepeatDraft {
  return {
    fromLocation: series.fromLocation ?? '',
    journeyDetails: series.journeyDetails,
    miles: String(series.milesPerJourney),
    includesReturnJourney: series.includesReturnJourney,
    recurrenceType: series.recurrenceType,
    selectedWeekdays: series.selectedWeekdays,
    startDate,
    endDate: series.endDate,
    excludedDates: series.excludedDates,
  }
}

type MileageEditScreenProps = {
  entry?: MileageEntryDto | null
  series?: MileageSeriesDto | null
  scope?: MileageEditScope | null
  existingEntries: MileageEntryDto[]
  onClose: () => void
  onSaved: (entry?: MileageEntryDto) => void
  onDeleted?: () => void
}

function MileageEditContent({
  entry,
  series,
  scope,
  existingEntries,
  onClose,
  onSaved,
  onDeleted,
}: MileageEditScreenProps) {
  const insets = useSafeAreaInsets()
  const { createEntry, updateEntry, deleteEntry } = useMileageEntries()
  const { createSeries, updateSeries } = useMileageSeries()

  const isCreate = !entry && !series
  const isSeriesEdit =
    scope === 'thisAndFuture' || scope === 'entireSeries' || (!entry && !!series)
  const [mode, setMode] = useState<MileageJourneyMode>(
    isSeriesEdit ? 'repeating' : 'single',
  )
  const [date, setDate] = useState(entry?.date ?? todayIsoDate())
  const [journeyDetails, setJourneyDetails] = useState(
    entry?.journeyDetails ?? series?.journeyDetails ?? '',
  )
  const [miles, setMiles] = useState(
    entry ? String(entry.miles) : series ? String(series.milesPerJourney) : '',
  )
  const [repeatDraft, setRepeatDraft] = useState<MileageRepeatDraft>(() => {
    if (series) {
      return draftFromSeries(
        series,
        scope === 'thisAndFuture' && entry ? entry.date : series.startDate,
      )
    }
    return emptyRepeatDraft()
  })
  const [excludeOpen, setExcludeOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const journeyInputRef = useRef<InputElement | null>(null)
  const showRepeating = isCreate ? mode === 'repeating' : isSeriesEdit

  useEffect(() => {
    if (!isCreate || showRepeating) return
    const timer = setTimeout(() => journeyInputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [isCreate, showRepeating])

  const parsedMiles = parsePositiveMiles(miles)
  const cumulativeMilesBefore = getCumulativeMilesBeforeEntry(existingEntries, {
    date: date.trim(),
    createdAt: entry?.createdAt,
    excludeId: entry?.id,
  })
  const previewClaim =
    parsedMiles != null ? calculateMileageClaim(parsedMiles, cumulativeMilesBefore) : null
  const canSaveSingle =
    date.trim().length > 0 && journeyDetails.trim().length > 0 && parsedMiles != null

  const handleSaveSingle = async () => {
    if (!canSaveSingle || parsedMiles == null) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        date: date.trim(),
        journeyDetails: journeyDetails.trim(),
        miles: parsedMiles,
      }
      if (entry) {
        const updated = await updateEntry(entry.id, payload)
        onSaved(updated)
      } else {
        const created = await createEntry(payload)
        onSaved(created)
      }
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save mileage entry',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveRepeating = async () => {
    const input = draftToWriteInput(repeatDraft)
    if (!input) return
    const issue = validateMileageSeriesInput({
      journeyDetails: input.journeyDetails,
      milesPerJourney: input.milesPerJourney,
      recurrenceType: input.recurrenceType,
      selectedWeekdays: input.selectedWeekdays,
      startDate: input.startDate,
      endDate: input.endDate,
      excludedDates: input.excludedDates,
      deletedDates: series?.deletedDates ?? [],
    })
    if (issue) {
      setError(MILEAGE_SERIES_VALIDATION_MESSAGES[issue])
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      if (series && (scope === 'thisAndFuture' || scope === 'entireSeries' || !entry)) {
        await updateSeries(
          series.id,
          input,
          scope === 'thisAndFuture' && entry
            ? { type: 'thisAndFuture', fromDate: entry.date }
            : { type: 'entireSeries' },
        )
      } else {
        await createSeries(input)
      }
      onSaved()
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save repeating journey',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = () => {
    if (showRepeating) return void handleSaveRepeating()
    return void handleSaveSingle()
  }

  const handleDelete = async () => {
    if (!entry || isDeleting || isSaving) return
    const confirmed = await confirmDeleteMileageEntry(entry)
    if (!confirmed) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteEntry(entry.id)
      onDeleted?.()
      onClose()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete mileage entry',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background} position="relative">
      <XStack
        px="$4"
        pt={isWeb ? '$3' : insets.top + 12}
        pb="$3"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        bg={MTD_TOKENS.background}
      >
        <YStack
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={onClose}
          py="$1"
          pr="$2"
        >
          <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.textMuted}>
            Cancel
          </SizableText>
        </YStack>

        <MtdActionButton
          size="compact"
          disabled={showRepeating ? isSaving : !canSaveSingle || isSaving}
          loading={isSaving}
          onPress={handleSave}
        >
          Save
        </MtdActionButton>
      </XStack>

      <RNScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isWeb ? 32 : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <YStack px="$4" pt="$4" gap="$5" maxW={720} width="100%" self="center">
          {isCreate ? (
            <MileageJourneyModeToggle
              value={mode}
              onChange={(next) => {
                setMode(next)
                if (next === 'repeating') {
                  setRepeatDraft((current) => ({
                    ...current,
                    journeyDetails: journeyDetails || current.journeyDetails,
                    miles: miles || current.miles,
                  }))
                } else {
                  setJourneyDetails(repeatDraft.journeyDetails || journeyDetails)
                  setMiles(repeatDraft.miles || miles)
                }
              }}
            />
          ) : null}

          {showRepeating ? (
            <MileageRepeatForm
              draft={repeatDraft}
              onChange={setRepeatDraft}
              existingEntries={existingEntries}
              submitLabelPrefix={isCreate ? 'Create' : 'Save'}
              isSaving={isSaving}
              onSubmit={() => void handleSaveRepeating()}
              onOpenExcludeDates={() => setExcludeOpen(true)}
            />
          ) : (
            <YStack gap="$3">
              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Date
                </SizableText>
                <MtdDatePicker value={date} onChange={setDate} placeholder="DD/MM/YYYY" />
              </YStack>

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Journey details
                </SizableText>
                <Input
                  ref={journeyInputRef}
                  value={journeyDetails}
                  onChangeText={setJourneyDetails}
                  placeholder="e.g. Client meeting in London"
                  autoCapitalize="sentences"
                  {...mtdInputProps}
                />
              </YStack>

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Mileage
                </SizableText>
                <Input
                  value={miles}
                  onChangeText={setMiles}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  {...mtdInputProps}
                />
              </YStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Rate
                  </SizableText>
                  <YStack width="100%" justify="center" {...mtdFieldChrome}>
                    <SizableText fontSize={MTD_INPUT_FONT_SIZE} color={MTD_TOKENS.text}>
                      {previewClaim?.rateLabel ?? '—'}
                    </SizableText>
                  </YStack>
                </YStack>

                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Claim
                  </SizableText>
                  <YStack width="100%" justify="center" {...mtdFieldChrome}>
                    <SizableText fontSize={MTD_INPUT_FONT_SIZE} color={MTD_TOKENS.text}>
                      {previewClaim
                        ? formatMileageClaimPounds(previewClaim.claimPounds)
                        : '—'}
                    </SizableText>
                  </YStack>
                </YStack>
              </XStack>
            </YStack>
          )}

          {entry && !showRepeating ? (
            <MtdActionButton
              size="large"
              width="100%"
              variant="secondary"
              disabled={isSaving || isDeleting}
              loading={isDeleting}
              icon={
                !isDeleting ? (
                  <TrashIcon size={18} color={MTD_TOKENS.orange} />
                ) : undefined
              }
              onPress={() => void handleDelete()}
            >
              {isDeleting ? 'Deleting…' : 'Delete journey'}
            </MtdActionButton>
          ) : null}

          {error ? (
            <SizableText fontSize={13} color={MTD_TOKENS.orange}>
              {error}
            </SizableText>
          ) : null}
        </YStack>
      </RNScrollView>

      {excludeOpen ? (
        <MileageExcludeDatesScreen
          nested
          draft={repeatDraft}
          onChange={(excludedDates) =>
            setRepeatDraft((current) => ({ ...current, excludedDates }))
          }
          onClose={() => setExcludeOpen(false)}
        />
      ) : null}
    </YStack>
  )
}

export function MileageEditScreen({
  entry,
  series,
  scope,
  existingEntries,
  onClose,
  onSaved,
  onDeleted,
}: MileageEditScreenProps) {
  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <MileageEditContent
          entry={entry}
          series={series}
          scope={scope}
          existingEntries={existingEntries}
          onClose={requestClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </SlideFromRightPanel>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
})
