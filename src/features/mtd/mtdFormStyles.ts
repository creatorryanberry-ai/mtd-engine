import { MTD_TOKENS } from './mtdTokens'

import type { BrandThemeColors } from '~/features/theme/brandThemes'
import type { ColorTokens } from 'tamagui'

export const MTD_INPUT_HEIGHT = 44
export const MTD_INPUT_FONT_SIZE = 15

type FieldColors = Pick<
  BrandThemeColors,
  'cardInset' | 'cardBorder' | 'textSubtle' | 'text'
>

export function resolveMtdColor(
  override: unknown,
  token: string,
  themed: ColorTokens,
): ColorTokens {
  return (override == null || override === token ? themed : override) as ColorTokens
}

/** Shared field chrome for MTD inputs, date pickers, and read-only values. */
export function getMtdFieldChrome(colors: FieldColors) {
  return {
    height: MTD_INPUT_HEIGHT,
    px: '$3.5',
    rounded: '$4',
    borderWidth: 0.5,
    bg: colors.cardInset,
    borderColor: colors.cardBorder,
  } as const
}

export function getMtdInputProps(colors: FieldColors) {
  return {
    ...getMtdFieldChrome(colors),
    fontSize: MTD_INPUT_FONT_SIZE,
    placeholderTextColor: colors.textSubtle,
    color: colors.text,
    outlineWidth: 0,
    underlineColorAndroid: 'transparent',
  } as const
}

export const mtdFieldChrome = {
  height: MTD_INPUT_HEIGHT,
  px: '$3.5',
  rounded: '$4',
  borderWidth: 0.5,
  bg: MTD_TOKENS.cardInset,
  borderColor: MTD_TOKENS.cardBorder,
} as const

export const mtdInputProps = {
  px: '$3.5',
  rounded: '$4',
  borderWidth: 0.5,
  bg: MTD_TOKENS.cardInset,
  borderColor: MTD_TOKENS.cardBorder,
  placeholderTextColor: MTD_TOKENS.textSubtle,
  color: MTD_TOKENS.text,
} as const
