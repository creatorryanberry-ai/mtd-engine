import { describe, expect, it } from 'vitest'

import type { ColorTokens } from 'tamagui'

import {
  brandThemes,
  getBrandScheme,
  getBrandTheme,
  type BrandThemeId,
} from '~/features/theme/brandThemes'

function assertColorToken(_color: ColorTokens) {}

const brandIds = ['curator', 'actor', 'parkins'] as const satisfies BrandThemeId[]

describe('brand appearance', () => {
  it('maps each brand to a single light or dark scheme', () => {
    expect(getBrandScheme('curator')).toBe('dark')
    expect(getBrandScheme('actor')).toBe('light')
    expect(getBrandScheme('parkins')).toBe('light')
  })

  it('uses a tamagui theme name that starts with that scheme', () => {
    for (const id of brandIds) {
      const brand = getBrandTheme(id)
      expect(brand.scheme).toBe(getBrandScheme(id))
      expect(brand.tamaguiThemeName.startsWith(`${brand.scheme}_`)).toBe(true)
    }
  })

  it('keeps scheme aligned on every listed brand', () => {
    for (const brand of Object.values(brandThemes)) {
      expect(brand.scheme === 'light' || brand.scheme === 'dark').toBe(true)
      expect(brand.tamaguiThemeName.startsWith(`${brand.scheme}_`)).toBe(true)
    }
  })

  it('exposes brand colors as tamagui color tokens', () => {
    for (const brand of Object.values(brandThemes)) {
      assertColorToken(brand.colors.cardBorder)
      assertColorToken(brand.colors.accent)
      assertColorToken(brand.colors.text)
    }
  })
})
