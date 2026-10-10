import type { ColorTokens } from 'tamagui'

import { mtdBrandColors } from '~/tamagui/themes'

/**
 * Semantic Tamagui color tokens for MTD UI.
 * Use under the active brand theme (`dark_mtd` / `light_actor`).
 * Stacked/transaction borders use concrete hex from the active brand via useBrandTheme.
 */
export const MTD_TOKENS = {
  background: '$background',
  card: '$color5',
  cardBorder: '$color9',
  cardInset: '$color7',
  /** @deprecated prefer useBrandTheme().brand.colors — dark fallback only */
  transactionCardBorder: mtdBrandColors.transactionCardBorder as ColorTokens,
  /** @deprecated prefer useBrandTheme().brand.colors — dark fallback only */
  stackedCardBorder: mtdBrandColors.stackedCardBorder as ColorTokens,
  orange: '$orange10',
  orangeMuted: '$orange4',
  onOrange: '$accentColor',
  text: '$color12',
  textMuted: '$color11',
  textSubtle: '$color10',
  green: '$green10',
  blue: '$blue10',
  purple: '$purple10',
} as const satisfies Record<string, ColorTokens>

/** @deprecated use MTD_TOKENS.orange */
export const MTD_ORANGE = MTD_TOKENS.orange
