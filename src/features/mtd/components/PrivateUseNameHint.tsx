import { type Ref } from 'react'
import { Keyboard, type View } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import type { PrivateUseSuggestion } from '~/features/mtd/categories/privateUseSuggestions'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

type PrivateUseNameHintProps = {
  suggestion: PrivateUseSuggestion
  /** measured under the "?" in "Shared cost?" for the guide arrow x */
  originRef?: Ref<View>
  /** outer hint box — arrow starts at its bottom edge so the line sits behind */
  boxRef?: Ref<View>
}

/** callout under name — arrow to Yes is drawn by PrivateUseHintArrow */
export function PrivateUseNameHint({
  suggestion,
  originRef,
  boxRef,
}: PrivateUseNameHintProps) {
  const { brand } = useBrandTheme()

  return (
    <YStack
      ref={boxRef}
      mt="$1.5"
      bg={brand.colors.accentMuted}
      borderWidth={1}
      borderColor={brand.colors.accent}
      rounded="$4"
      px="$3"
      py="$2.5"
      gap="$1"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={() => Keyboard.dismiss()}
    >
      <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.orange}>
        {suggestion.chipLabel}
      </SizableText>
      <XStack flexWrap="wrap" items="baseline">
        <YStack ref={originRef}>
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={16}>
            Shared cost?
          </SizableText>
        </YStack>
        <SizableText fontSize={12} color={MTD_TOKENS.textMuted} lineHeight={16}>
          {' '}
          Choose Yes below
        </SizableText>
      </XStack>
    </YStack>
  )
}
