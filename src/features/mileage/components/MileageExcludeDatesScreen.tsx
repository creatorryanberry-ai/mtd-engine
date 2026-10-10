import { useMemo, useState } from 'react'
import { ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { MileageMonthCalendar } from '~/features/mileage/components/MileageMonthCalendar'
import { isoWeekDates, monthDates, todayIsoDate } from '~/features/mileage/utils/isoDates'
import { formatMileageDisplayDate } from '~/features/mileage/utils/mileageClaim'
import {
  filterDatesToRecurrence,
  matchesRecurrence,
} from '~/features/mileage/utils/mileageOccurrences'
import {
  addExceptionDate,
  removeExceptionDate,
} from '~/features/mileage/utils/mileageSeriesReconcile'
import { getEnglandWalesBankHolidaysInRange } from '~/features/mileage/utils/ukBankHolidays'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { CalendarIcon } from '~/interface/icons/phosphor/CalendarIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'

import type { MileageRepeatDraft } from '~/features/mileage/components/MileageRepeatForm'

type MileageExcludeDatesScreenProps = {
  draft: MileageRepeatDraft
  onChange: (excludedDates: string[]) => void
  onClose: () => void
  nested?: boolean
}

export function MileageExcludeDatesScreen({
  nested,
  ...props
}: MileageExcludeDatesScreenProps) {
  const content = (onClose: () => void) => (
    <ExcludeDatesContent {...props} onClose={onClose} />
  )

  if (nested) {
    return (
      <YStack
        position="absolute"
        t={0}
        l={0}
        r={0}
        b={0}
        z={20}
        bg={MTD_TOKENS.background}
        pointerEvents="auto"
      >
        {content(props.onClose)}
      </YStack>
    )
  }

  return (
    <SlideFromRightPanel onClose={props.onClose}>
      {(requestClose) => content(requestClose)}
    </SlideFromRightPanel>
  )
}

function ExcludeDatesContent({
  draft,
  onChange,
  onClose,
}: MileageExcludeDatesScreenProps) {
  const insets = useSafeAreaInsets()
  const { brand } = useBrandTheme()
  const today = todayIsoDate()
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [selected, setSelected] = useState(() => [...draft.excludedDates])
  const initialMonth = draft.startDate || today
  const [year, setYear] = useState(Number.parseInt(initialMonth.slice(0, 4), 10))
  const [month, setMonth] = useState(Number.parseInt(initialMonth.slice(5, 7), 10))

  const recurrence = {
    recurrenceType: draft.recurrenceType,
    selectedWeekdays: draft.selectedWeekdays,
    startDate: draft.startDate,
    endDate: draft.endDate,
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const bankHolidays = useMemo(
    () =>
      filterDatesToRecurrence(
        getEnglandWalesBankHolidaysInRange(draft.startDate, draft.endDate),
        { ...recurrence, excludedDates: [] },
      ),
    [draft.endDate, draft.recurrenceType, draft.selectedWeekdays, draft.startDate],
  )

  const thisWeek = filterDatesToRecurrence(isoWeekDates(today), {
    ...recurrence,
    excludedDates: [],
  })
  const thisMonth = filterDatesToRecurrence(monthDates(year, month), {
    ...recurrence,
    excludedDates: [],
  })

  const shiftMonth = (delta: number) => {
    let nextMonth = month + delta
    let nextYear = year
    if (nextMonth < 1) {
      nextMonth = 12
      nextYear -= 1
    } else if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    setYear(nextYear)
    setMonth(nextMonth)
  }

  const toggleDate = (isoDate: string) => {
    if (!matchesRecurrence(isoDate, recurrence)) return
    setSelected((current) =>
      current.includes(isoDate)
        ? removeExceptionDate(current, isoDate)
        : addExceptionDate(current, isoDate),
    )
  }

  const addDates = (dates: string[]) => {
    setSelected((current) => {
      const next = dates.filter((date) => !current.includes(date))
      if (next.length === 0) return current
      return [...current, ...next].sort()
    })
  }

  const closeAfterPress = (commit: boolean) => {
    if (commit) onChange(selected)
    setTimeout(onClose, 50)
  }

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
        <YStack
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={() => closeAfterPress(false)}
          pointerEvents="box-only"
          py="$1"
          pr="$2"
        >
          <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.textMuted}>
            Back
          </SizableText>
        </YStack>
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Exclude dates
        </SizableText>
        <MtdActionButton size="compact" onPress={() => closeAfterPress(true)}>
          Apply
        </MtdActionButton>
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
          <XStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$4"
            p="$0.5"
          >
            {(['calendar', 'list'] as const).map((id) => {
              const selectedView = view === id
              return (
                <XStack
                  key={id}
                  flex={1}
                  items="center"
                  justify="center"
                  py="$2"
                  rounded="$3"
                  bg={selectedView ? brand.colors.accent : 'transparent'}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.9 }}
                  onPress={() => setView(id)}
                >
                  <SizableText
                    fontSize={13}
                    fontWeight="600"
                    color={selectedView ? brand.colors.onAccent : MTD_TOKENS.textMuted}
                  >
                    {id === 'calendar' ? 'Calendar' : 'List'}
                  </SizableText>
                </XStack>
              )
            })}
          </XStack>

          {view === 'calendar' ? (
            <YStack
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              p="$4"
              gap="$3"
            >
              <XStack items="center" justify="space-between">
                <SizableText
                  fontSize={15}
                  color={MTD_TOKENS.textMuted}
                  cursor="pointer"
                  onPress={() => shiftMonth(-1)}
                >
                  ‹
                </SizableText>
                <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                  {monthLabel}
                </SizableText>
                <SizableText
                  fontSize={15}
                  color={MTD_TOKENS.textMuted}
                  cursor="pointer"
                  onPress={() => shiftMonth(1)}
                >
                  ›
                </SizableText>
              </XStack>
              <MileageMonthCalendar
                year={year}
                month={month}
                selectedDates={selected}
                recurrence={{ ...recurrence, excludedDates: [] }}
                onToggleDate={toggleDate}
              />
            </YStack>
          ) : (
            <YStack
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              overflow="hidden"
            >
              {selected.length === 0 ? (
                <YStack p="$4">
                  <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
                    No excluded dates yet. Switch to calendar to pick days.
                  </SizableText>
                </YStack>
              ) : (
                selected.map((date) => (
                  <XStack
                    key={date}
                    px="$4"
                    py="$3"
                    items="center"
                    justify="space-between"
                    borderBottomWidth={1}
                    borderColor={MTD_TOKENS.cardBorder}
                  >
                    <SizableText fontSize={15} color={MTD_TOKENS.text}>
                      {formatMileageDisplayDate(date)}
                    </SizableText>
                    <YStack
                      cursor="pointer"
                      pressStyle={{ opacity: 0.8 }}
                      onPress={() => setSelected(removeExceptionDate(selected, date))}
                    >
                      <XIcon size={16} color={MTD_TOKENS.textMuted} />
                    </YStack>
                  </XStack>
                ))
              )}
            </YStack>
          )}

          <YStack gap="$2">
            <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
              Quick options
            </SizableText>
            <QuickOption
              label={`UK bank holidays (${bankHolidays.length} ${bankHolidays.length === 1 ? 'date' : 'dates'})`}
              disabled={bankHolidays.length === 0}
              onPress={() => addDates(bankHolidays)}
            />
            <QuickOption
              label={`This week (${thisWeek.length} ${thisWeek.length === 1 ? 'date' : 'dates'})`}
              disabled={thisWeek.length === 0}
              onPress={() => addDates(thisWeek)}
            />
            <QuickOption
              label={`This month (${thisMonth.length} ${thisMonth.length === 1 ? 'date' : 'dates'})`}
              disabled={thisMonth.length === 0}
              onPress={() => addDates(thisMonth)}
            />
          </YStack>

          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                Selected dates ({selected.length})
              </SizableText>
              {selected.length > 0 ? (
                <SizableText
                  fontSize={13}
                  fontWeight="600"
                  color={brand.colors.accentIcon}
                  cursor="pointer"
                  onPress={() => setSelected([])}
                >
                  Clear all
                </SizableText>
              ) : null}
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              {selected.map((date) => (
                <XStack
                  key={date}
                  bg={MTD_TOKENS.card}
                  borderWidth={1}
                  borderColor={MTD_TOKENS.cardBorder}
                  rounded="$10"
                  px="$3"
                  py="$1.5"
                  gap="$2"
                  items="center"
                >
                  <SizableText fontSize={13} color={MTD_TOKENS.text}>
                    {formatMileageDisplayDate(date)}
                  </SizableText>
                  <YStack
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => setSelected(removeExceptionDate(selected, date))}
                  >
                    <XIcon size={12} color={MTD_TOKENS.textMuted} />
                  </YStack>
                </XStack>
              ))}
            </XStack>
          </YStack>

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$4"
            p="$3"
          >
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={18}>
              Excluded dates will not generate journeys, but the series stays linked so
              they are not recreated later.
            </SizableText>
          </YStack>
        </YStack>
      </RNScrollView>
    </YStack>
  )
}

function QuickOption({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  const { brand } = useBrandTheme()

  return (
    <MtdAccentMutedBg
      accent={false}
      row
      items="center"
      justify="space-between"
      px="$3"
      py="$3"
      rounded="$4"
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      opacity={disabled ? 0.45 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      pressStyle={disabled ? undefined : { opacity: 0.9 }}
      onPress={disabled ? undefined : onPress}
    >
      <XStack items="center" gap="$3">
        <CalendarIcon size={18} color={MTD_TOKENS.textMuted} />
        <SizableText fontSize={14} color={MTD_TOKENS.text}>
          {label}
        </SizableText>
      </XStack>
      <PlusIcon size={16} color={brand.colors.accentIcon} />
    </MtdAccentMutedBg>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
})
