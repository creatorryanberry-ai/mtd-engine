import { createV5Theme, defaultChildrenThemes } from '@tamagui/themes/v5'

/** Curator dark gray scale — maps to $color1–$color12 under `dark_mtd` */
export const mtdPalette = {
  mtd1: '#050505',
  mtd2: '#0A0A0A',
  mtd3: '#0F0F0F',
  mtd4: '#121212',
  mtd5: '#161616',
  mtd6: '#1A1A1A',
  mtd7: '#1E1E1E',
  mtd8: '#222222',
  mtd9: '#2A2A2A',
  mtd10: '#6B7280',
  mtd11: '#9CA3AF',
  mtd12: '#FFFFFF',
} as const

/** Actor light warm scale — maps to $color1–$color12 under `light_actor` */
export const actorPalette = {
  actor1: '#FFFFFF',
  actor2: '#FAFAF8',
  actor3: '#F5F3EF',
  actor4: '#EFEBE6',
  actor5: '#FFFFFF',
  actor6: '#E8E4DF',
  actor7: '#F0EDE8',
  actor8: '#DDD8D0',
  actor9: '#E5E0D8',
  actor10: '#8A8478',
  actor11: '#5C574E',
  actor12: '#1C1917',
} as const

/** Parkins light — navy, red accent, cool gray surfaces */
export const parkinsPalette = {
  parkins1: '#FFFFFF',
  parkins2: '#F5F7F9',
  parkins3: '#EEF2F6',
  parkins4: '#E8EDF2',
  parkins5: '#FFFFFF',
  parkins6: '#E2E8F0',
  parkins7: '#F5F7F9',
  parkins8: '#D8DEE6',
  parkins9: '#CBD5E1',
  parkins10: '#6B7A8F',
  parkins11: '#4A5F7A',
  parkins12: '#1D4176',
} as const

/** Default MTD brand accent + status colors (overridable per partner theme). */
export const mtdBrandColors = {
  accent: '#F97316',
  accentMuted: '#F9731633',
  onAccent: '#000000',
  green: '#22C55E',
  blue: '#3B82F6',
  purple: '#A855F7',
  transactionCardBorder: '#353535',
  stackedCardBorder: '#3D3D3D',
} as const

export const parkinsBrandColors = {
  accent: '#D21F32',
  accentMuted: '#E8EEF8',
  onAccent: '#FFFFFF',
  green: '#16A34A',
  blue: '#1D4176',
  purple: '#9333EA',
  transactionCardBorder: '#D8DEE6',
  stackedCardBorder: '#CBD5E1',
} as const

export const MTD_THEME_NAME = 'dark_mtd' as const
export const ACTOR_THEME_NAME = 'light_actor' as const
export const PARKINS_THEME_NAME = 'light_parkins' as const

function isActorTheme(name: string | undefined) {
  return name?.includes('actor') ?? false
}

function isParkinsTheme(name: string | undefined) {
  return name?.includes('parkins') ?? false
}

export const themes = createV5Theme({
  childrenThemes: {
    ...defaultChildrenThemes,
    mtd: { light: mtdPalette, dark: mtdPalette },
    actor: { light: actorPalette, dark: actorPalette },
    parkins: { light: parkinsPalette, dark: parkinsPalette },
  },
  getTheme: ({ name }) => {
    if (isParkinsTheme(name)) {
      return {
        orange10: parkinsBrandColors.accent,
        orange4: parkinsBrandColors.accentMuted,
        accentBackground: parkinsBrandColors.accent,
        accentColor: parkinsBrandColors.onAccent,
      }
    }

    if (isActorTheme(name)) {
      return {
        orange10: mtdBrandColors.accent,
        orange4: mtdBrandColors.accentMuted,
        accentBackground: mtdBrandColors.accent,
        accentColor: '#FFFFFF',
      }
    }

    return {
      orange10: mtdBrandColors.accent,
      orange4: mtdBrandColors.accentMuted,
      accentBackground: mtdBrandColors.accent,
      accentColor: mtdBrandColors.onAccent,
    }
  },
})
