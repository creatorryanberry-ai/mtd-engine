import { SizableText, XStack, YStack } from 'tamagui'

import { monthCalendarCells } from '~/features/mileage/utils/isoDates'
import { matchesRecurrence } from '~/features/mileage/utils/mileageOccurrences'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

import type { MileageSeriesOccurrenceInput } from '~/features/mileage/utils/mileageOccurrences'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MileageMonthCalendar({
  year,
  month,
  selectedDates,
  recurrence,
  onToggleDate,
}: {
  year: number
  month: number
  selectedDates: string[]
  recurrence: MileageSeriesOccurrenceInput
  onToggleDate: (isoDate: string) => void
}) {
  const { brand } = useBrandTheme()
  const selected = new Set(selectedDates)
  const cells = monthCalendarCells(year, month)

  return (
    <YStack gap="$2">
      <XStack>
        {WEEKDAY_HEADERS.map((label) => (
          <SizableText
            key={label}
            flex={1}
            fontSize={11}
            fontWeight="500"
            color={MTD_TOKENS.textSubtle}
            text="center"
          >
            {label}
          </SizableText>
        ))}
      </XStack>
      <YStack gap="$1">
        {chunk(cells, 7).map((week, weekIndex) => (
          <XStack key={weekIndex}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return (
                  <YStack key={`empty-${weekIndex}-${dayIndex}`} flex={1} height={40} />
                )
              }

              const isSelected = selected.has(date)
              const onPattern = matchesRecurrence(date, recurrence)

              return (
                <YStack
                  key={date}
                  flex={1}
                  height={40}
                  items="center"
                  justify="center"
                  cursor={onPattern ? 'pointer' : 'default'}
                  opacity={onPattern ? 1 : 0.35}
                  pointerEvents={onPattern ? 'box-only' : 'none'}
                  pressStyle={onPattern ? { opacity: 0.8 } : undefined}
                  onPress={onPattern ? () => onToggleDate(date) : undefined}
                >
                  <YStack
                    width={32}
                    height={32}
                    rounded="$10"
                    items="center"
                    justify="center"
                    bg={isSelected ? brand.colors.accent : 'transparent'}
                    borderWidth={isSelected ? 0 : 0}
                  >
                    <SizableText
                      fontSize={14}
                      fontWeight={isSelected ? '700' : '500'}
                      color={isSelected ? brand.colors.onAccent : MTD_TOKENS.text}
                    >
                      {Number.parseInt(date.slice(8, 10), 10)}
                    </SizableText>
                  </YStack>
                </YStack>
              )
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size))
  }
  return rows
}
