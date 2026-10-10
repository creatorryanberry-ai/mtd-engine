import { SizableText, XStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

import { MtdAccentMutedBg } from '../MtdAccentMutedBg'

type ReviewWizardChoiceProps = {
  label: string
  onPress: () => void
  selected?: boolean
}

export function ReviewWizardChoice({
  label,
  onPress,
  selected = false,
}: ReviewWizardChoiceProps) {
  const { brand } = useBrandTheme()

  if (selected) {
    return (
      <XStack
        width="100%"
        px="$4"
        py="$3.5"
        gap="$3"
        rounded="$4"
        bg={brand.colors.accent}
        items="center"
        justify="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
        pointerEvents="box-only"
      >
        <SizableText
          fontSize={15}
          fontWeight="600"
          color={brand.colors.onAccent}
          lineHeight={22}
          text="center"
        >
          {label}
        </SizableText>
        <CheckIcon size={18} color={brand.colors.onAccent} />
      </XStack>
    )
  }

  return (
    <MtdAccentMutedBg
      accent={false}
      row
      width="100%"
      px="$4"
      py="$3.5"
      gap="$3"
      rounded="$4"
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      items="center"
      justify="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <SizableText
        fontSize={15}
        fontWeight="500"
        color={MTD_TOKENS.textMuted}
        lineHeight={22}
        text="center"
      >
        {label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}
