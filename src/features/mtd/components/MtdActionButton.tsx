import type { ReactNode } from 'react'
import { Spinner, SizableText, XStack, YStack, type YStackProps } from 'tamagui'

import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { composeHapticPressIn, type HapticStyle } from '~/interface/haptics/haptics'

type MtdActionButtonSize = 'compact' | 'default' | 'large'

type MtdActionButtonProps = YStackProps & {
  children?: ReactNode
  variant?: 'primary' | 'secondary'
  size?: MtdActionButtonSize
  fontSize?: number
  icon?: ReactNode
  loading?: boolean
  /** press haptic — default light. `false` to disable. */
  haptic?: HapticStyle
}

/** Flat MTD button — uses concrete brand colors (works in Sheet portals). */
export function MtdActionButton({
  children,
  variant = 'primary',
  size = 'default',
  fontSize: fontSizeProp,
  icon,
  loading,
  disabled,
  height: heightProp,
  haptic = true,
  onPressIn,
  ...props
}: MtdActionButtonProps) {
  const { brand } = useBrandTheme()
  const { colors } = brand
  const isPrimary = variant === 'primary'
  const isDisabled = Boolean(disabled || loading)

  const fontSize = fontSizeProp ?? (size === 'compact' ? 12 : size === 'large' ? 15 : 14)
  const height = heightProp ?? (size === 'compact' ? 32 : size === 'large' ? 48 : 44)
  const px = size === 'compact' ? '$3' : '$4'
  const rounded = size === 'compact' ? '$2' : size === 'large' ? '$4' : '$3'
  const minW = size === 'compact' ? 72 : 100

  const bg = isDisabled ? colors.cardInset : isPrimary ? colors.accent : colors.cardInset

  const textColor = isDisabled
    ? colors.textSubtle
    : isPrimary
      ? colors.onAccent
      : colors.text
  const borderColor = isPrimary && !isDisabled ? 'transparent' : colors.cardBorder

  return (
    <YStack
      height={height}
      px={px}
      minW={minW}
      rounded={rounded}
      items="center"
      justify="center"
      cursor={isDisabled ? 'not-allowed' : 'pointer'}
      pointerEvents={isDisabled ? 'none' : 'box-only'}
      borderWidth={isPrimary && !isDisabled ? 0 : 1}
      borderColor={borderColor}
      bg={bg}
      hoverStyle={
        isDisabled ? undefined : isPrimary ? { opacity: 0.95 } : { bg: colors.card }
      }
      pressStyle={isDisabled ? undefined : { opacity: 0.85 }}
      onPressIn={composeHapticPressIn(onPressIn, { haptic, disabled: isDisabled })}
      {...props}
    >
      <XStack gap="$2" items="center" justify="center">
        {loading ? <Spinner size="small" color={textColor} /> : icon}
        {children != null && children !== '' ? (
          typeof children === 'string' ? (
            <SizableText
              fontSize={fontSize}
              fontWeight="600"
              color={textColor}
              numberOfLines={1}
            >
              {children}
            </SizableText>
          ) : (
            children
          )
        ) : null}
      </XStack>
    </YStack>
  )
}
