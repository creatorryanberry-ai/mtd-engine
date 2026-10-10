import { mtdBrandColors, mtdPalette, parkinsBrandColors } from '~/tamagui/themes'

import type { ColorTokens, ThemeName } from 'tamagui'

export type BrandThemeId = 'curator' | 'actor' | 'parkins'
export type BrandScheme = 'light' | 'dark'

export type BrandThemeColors = {
  accent: ColorTokens
  accentMuted: ColorTokens
  accentMutedBg: ColorTokens
  accentIcon: ColorTokens
  accentBorder: ColorTokens
  onAccent: ColorTokens
  green: ColorTokens
  blue: ColorTokens
  purple: ColorTokens
  background: ColorTokens
  card: ColorTokens
  cardInset: ColorTokens
  cardBorder: ColorTokens
  transactionCardBorder: ColorTokens
  stackedCardBorder: ColorTokens
  text: ColorTokens
  textMuted: ColorTokens
  textSubtle: ColorTokens
  stepCircleActive: ColorTokens
  stepCircleActiveText: ColorTokens
  logoMtdBg: ColorTokens
  logoMtdText: ColorTokens
}

function brandColors(colors: Record<keyof BrandThemeColors, string>): BrandThemeColors {
  return colors as BrandThemeColors
}

export type BrandThemeConfig = {
  id: BrandThemeId
  name: string
  description: string
  scheme: BrandScheme
  tamaguiThemeName: ThemeName
  colors: BrandThemeColors
}

export const curatorBrandTheme = {
  id: 'curator',
  name: 'Curator dark',
  description: 'Dark charcoal UI with orange accents',
  scheme: 'dark',
  tamaguiThemeName: 'dark_mtd',
  colors: brandColors({
    accent: mtdBrandColors.accent,
    accentMuted: mtdBrandColors.accentMuted,
    accentMutedBg: mtdBrandColors.accentMuted,
    accentIcon: mtdBrandColors.accent,
    accentBorder: mtdBrandColors.accent,
    onAccent: mtdBrandColors.onAccent,
    green: mtdBrandColors.green,
    blue: mtdBrandColors.blue,
    purple: mtdBrandColors.purple,
    background: mtdPalette.mtd2,
    card: mtdPalette.mtd5,
    cardInset: mtdPalette.mtd7,
    cardBorder: mtdPalette.mtd9,
    transactionCardBorder: mtdBrandColors.transactionCardBorder,
    stackedCardBorder: mtdBrandColors.stackedCardBorder,
    text: mtdPalette.mtd12,
    textMuted: mtdPalette.mtd11,
    textSubtle: mtdPalette.mtd10,
    stepCircleActive: mtdBrandColors.accent,
    stepCircleActiveText: mtdBrandColors.onAccent,
    logoMtdBg: mtdBrandColors.accent,
    logoMtdText: mtdBrandColors.onAccent,
  }),
} as const satisfies BrandThemeConfig

/** Warm light template for performers — white surfaces, charcoal type, orange CTA. */
export const actorBrandTheme = {
  id: 'actor',
  name: 'Actor light',
  description: 'Light warm UI tailored for performers',
  scheme: 'light',
  tamaguiThemeName: 'light_actor',
  colors: brandColors({
    accent: '#F97316',
    accentMuted: '#F9731626',
    accentMutedBg: '#F9731626',
    accentIcon: '#F97316',
    accentBorder: '#F97316',
    onAccent: '#FFFFFF',
    green: '#16A34A',
    blue: '#2563EB',
    purple: '#9333EA',
    background: '#FAFAF8',
    card: '#FFFFFF',
    cardInset: '#F0EDE8',
    cardBorder: '#E5E0D8',
    transactionCardBorder: '#E5E0D8',
    stackedCardBorder: '#DDD8D0',
    text: '#1C1917',
    textMuted: '#5C574E',
    textSubtle: '#8A8478',
    stepCircleActive: '#F97316',
    stepCircleActiveText: '#FFFFFF',
    logoMtdBg: '#F97316',
    logoMtdText: '#FFFFFF',
  }),
} as const satisfies BrandThemeConfig

/** Parkins corporate light — navy type, red CTAs, cool gray sections. */
export const parkinsBrandTheme = {
  id: 'parkins',
  name: 'Parkins light',
  description: 'Professional navy and red corporate styling',
  scheme: 'light',
  tamaguiThemeName: 'light_parkins',
  colors: brandColors({
    accent: parkinsBrandColors.accent,
    accentMuted: '#E8EEF8',
    accentMutedBg: '#E8EEF8',
    accentIcon: parkinsBrandColors.blue,
    accentBorder: parkinsBrandColors.blue,
    onAccent: parkinsBrandColors.onAccent,
    green: parkinsBrandColors.green,
    blue: parkinsBrandColors.blue,
    purple: parkinsBrandColors.purple,
    background: '#F5F7F9',
    card: '#FFFFFF',
    cardInset: '#F5F7F9',
    cardBorder: '#D8DEE6',
    transactionCardBorder: parkinsBrandColors.transactionCardBorder,
    stackedCardBorder: parkinsBrandColors.stackedCardBorder,
    text: '#1D4176',
    textMuted: '#4A5F7A',
    textSubtle: '#6B7A8F',
    stepCircleActive: parkinsBrandColors.blue,
    stepCircleActiveText: parkinsBrandColors.onAccent,
    logoMtdBg: parkinsBrandColors.blue,
    logoMtdText: parkinsBrandColors.onAccent,
  }),
} as const satisfies BrandThemeConfig

export const brandThemes = {
  curator: curatorBrandTheme,
  actor: actorBrandTheme,
  parkins: parkinsBrandTheme,
} as const satisfies Record<BrandThemeId, BrandThemeConfig>

export const brandThemeList = Object.values(brandThemes).sort((left, right) =>
  left.name.localeCompare(right.name),
)

export const defaultBrandTheme = curatorBrandTheme

export const BRAND_THEME_STORAGE_KEY = 'mtd-brand-theme'

export function getBrandTheme(id: string | null | undefined): BrandThemeConfig {
  if (id === 'actor') return actorBrandTheme
  if (id === 'parkins') return parkinsBrandTheme
  return curatorBrandTheme
}

/** Light/dark scheme implied by the selected brand — used for Tamagui defaultTheme and html class. */
export function getBrandScheme(
  brand: BrandThemeConfig | BrandThemeId | string | null | undefined,
): BrandScheme {
  if (typeof brand === 'object' && brand) return brand.scheme
  return getBrandTheme(brand).scheme
}
