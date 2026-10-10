import { SizableText, XStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

export type MileageJourneyMode = 'single' | 'repeating'

export function MileageJourneyModeToggle({
  value,
  onChange,
}: {
  value: MileageJourneyMode
  onChange: (mode: MileageJourneyMode) => void
}) {
  const { brand } = useBrandTheme()
  const options: { id: MileageJourneyMode; label: string }[] = [
    { id: 'single', label: 'Single journey' },
    { id: 'repeating', label: 'Repeating journey' },
  ]

  return (
    <XStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$0.5"
    >
      {options.map((option) => {
        const selected = value === option.id
        return (
          <XStack
            key={option.id}
            flex={1}
            items="center"
            justify="center"
            py="$2.5"
            px="$2"
            rounded="$3"
            bg={selected ? brand.colors.accent : 'transparent'}
            cursor="pointer"
            pressStyle={{ opacity: 0.9 }}
            onPress={() => onChange(option.id)}
          >
            <SizableText
              fontSize={13}
              fontWeight="600"
              color={selected ? brand.colors.onAccent : MTD_TOKENS.textMuted}
              text="center"
            >
              {option.label}
            </SizableText>
          </XStack>
        )
      })}
    </XStack>
  )
}
