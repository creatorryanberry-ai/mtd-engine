import type { ReactNode } from 'react'
import { XStack, YStack, type XStackProps, type YStackProps } from 'tamagui'

import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { composeHapticPressIn, type HapticStyle } from '~/interface/haptics/haptics'

import { MTD_TOKENS } from '../mtdTokens'

type MtdAccentMutedBgProps = {
  children?: ReactNode
  /** Tint behind content. When false, uses `fallbackBg` only. */
  accent?: boolean
  fallbackBg?: YStackProps['bg']
  /** Row layout for tabs/chips; default column for icon tiles. */
  row?: boolean
  /** press haptic when this surface is pressable — default light. */
  haptic?: HapticStyle
} & YStackProps

/** Brand-tinted background for icon tiles and selected tabs/chips. */
export function MtdAccentMutedBg({
  children,
  accent = true,
  fallbackBg = MTD_TOKENS.card,
  row = false,
  bg,
  width,
  height,
  items,
  justify,
  haptic = true,
  onPress,
  onPressIn,
  ...props
}: MtdAccentMutedBgProps) {
  const { brand } = useBrandTheme()
  const layoutProps = props as XStackProps
  const accentBg = brand.colors.accentMutedBg
  // fixed-size tiles (lock/shield/etc) default to centered content — several
  // call sites omitted items/justify and left icons stuck in the top-left.
  const isIconTile = !row && width != null && height != null
  const resolvedItems = items ?? (isIconTile ? 'center' : undefined)
  const resolvedJustify = justify ?? (isIconTile ? 'center' : undefined)
  const isPressable = onPress != null || onPressIn != null
  const resolvedPressIn = isPressable
    ? composeHapticPressIn(onPressIn, { haptic })
    : onPressIn

  if (row) {
    return (
      <XStack
        bg={accent ? accentBg : (bg ?? fallbackBg)}
        items={items}
        justify={justify}
        onPress={onPress}
        onPressIn={resolvedPressIn}
        pointerEvents={isPressable ? 'box-only' : undefined}
        {...layoutProps}
      >
        {children}
      </XStack>
    )
  }

  return (
    <YStack
      bg={accent ? accentBg : (bg ?? fallbackBg)}
      width={width}
      height={height}
      items={resolvedItems}
      justify={resolvedJustify}
      onPress={onPress}
      onPressIn={resolvedPressIn}
      pointerEvents={isPressable ? 'box-only' : undefined}
      {...props}
    >
      {children}
    </YStack>
  )
}
