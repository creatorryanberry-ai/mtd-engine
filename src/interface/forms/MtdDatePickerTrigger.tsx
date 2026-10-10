import { SizableText, XStack } from 'tamagui'

import { MTD_INPUT_FONT_SIZE, getMtdFieldChrome } from '~/features/mtd/mtdFormStyles'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { CalendarIcon } from '~/interface/icons/phosphor/CalendarIcon'

import type { ReactNode } from 'react'

export type MtdDatePickerProps = {
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
  testID?: string
  title?: string
  minDate?: string
  /** omit for today; pass false to allow future dates */
  maxDate?: string | false
  onOpen?: () => void
  onClose?: () => void
}

export function MtdDatePickerTrigger({
  displayValue,
  placeholder,
  onPress,
  testID,
  children,
}: {
  displayValue: string
  placeholder: string
  onPress: () => void
  testID?: string
  children?: ReactNode
}) {
  const { brand } = useBrandTheme()
  const chrome = getMtdFieldChrome(brand.colors)

  return (
    <XStack
      width="100%"
      items="center"
      justify="space-between"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
      pointerEvents="box-only"
      testID={testID}
      {...chrome}
      position="relative"
    >
      <SizableText
        fontSize={MTD_INPUT_FONT_SIZE}
        color={displayValue ? brand.colors.text : brand.colors.textMuted}
        lineHeight={20}
      >
        {displayValue || placeholder}
      </SizableText>
      <CalendarIcon size={16} color={brand.colors.textSubtle} />
      {children}
    </XStack>
  )
}
