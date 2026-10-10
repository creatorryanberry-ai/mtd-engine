import { SizableText, XStack } from 'tamagui'

import { ISO_WEEKDAY_OPTIONS } from '~/features/mileage/utils/mileageOccurrences'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'

export function MileageWeekdayChips({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (weekdays: number[]) => void
}) {
  const selectedSet = new Set(selected)

  return (
    <XStack gap="$1.5" flexWrap="wrap">
      {ISO_WEEKDAY_OPTIONS.map((option) => {
        const active = selectedSet.has(option.value)
        return (
          <WeekdayChip
            key={option.value}
            label={option.label}
            selected={active}
            onPress={() => {
              if (active) {
                onChange(selected.filter((weekday) => weekday !== option.value))
                return
              }
              onChange([...selected, option.value].sort((left, right) => left - right))
            }}
          />
        )
      })}
    </XStack>
  )
}

function WeekdayChip({
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
      width={40}
      height={36}
      items="center"
      justify="center"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <SizableText
        fontSize={12}
        fontWeight={selected ? '700' : '500'}
        color={selected ? textColor : MTD_TOKENS.textSubtle}
      >
        {label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}
