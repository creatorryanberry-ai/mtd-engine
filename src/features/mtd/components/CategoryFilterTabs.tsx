import { SizableText, XStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import { useMtdSelectionColors } from '../useMtdSelectionColors'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'

export type CategoryFilterId = 'to-review' | 'all' | 'income' | 'expenses' | 'transfers'

const FILTERS: { id: CategoryFilterId; label: string; accent: string }[] = [
  { id: 'to-review', label: 'To review', accent: MTD_TOKENS.orange },
  { id: 'all', label: 'All', accent: MTD_TOKENS.textMuted },
  { id: 'income', label: 'Income', accent: MTD_TOKENS.green },
  { id: 'expenses', label: 'Expenses', accent: MTD_TOKENS.orange },
  { id: 'transfers', label: 'Transfers', accent: MTD_TOKENS.blue },
]

type CategoryFilterTabsProps = {
  activeFilter: CategoryFilterId
  counts: Record<string, number>
  onFilterChange: (filter: CategoryFilterId) => void
}

function FilterTab({
  filter,
  active,
  count,
  onPress,
}: {
  filter: (typeof FILTERS)[number]
  active: boolean
  count: number
  onPress: () => void
}) {
  const { borderColor } = useMtdSelectionColors(active)

  return (
    <MtdAccentMutedBg
      accent={active}
      row
      borderWidth={1}
      borderColor={borderColor}
      rounded="$10"
      px="$3"
      py="$2"
      gap="$2"
      items="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <SizableText
        fontSize={12}
        fontWeight={active ? '600' : '500'}
        color={active ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
      >
        {filter.label}
      </SizableText>
      <SizableText fontSize={11} fontWeight="600" style={{ color: filter.accent }}>
        {count}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

export function CategoryFilterTabs({
  activeFilter,
  counts,
  onFilterChange,
}: CategoryFilterTabsProps) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {FILTERS.map((filter) => (
        <FilterTab
          key={filter.id}
          filter={filter}
          active={activeFilter === filter.id}
          count={counts[filter.id] ?? 0}
          onPress={() => onFilterChange(filter.id)}
        />
      ))}
    </XStack>
  )
}
