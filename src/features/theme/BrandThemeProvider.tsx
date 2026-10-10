import { useEmitterValue } from '@mtd/helpers'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { Theme } from 'tamagui'

import { brandThemeIdEmitter, persistBrandThemeId } from './brandThemeId'
import {
  brandThemes,
  defaultBrandTheme,
  getBrandTheme,
  type BrandThemeConfig,
  type BrandThemeId,
} from './brandThemes'

type BrandThemeContextValue = {
  brand: BrandThemeConfig
  brandId: BrandThemeId
  setBrandId: (id: BrandThemeId) => void
  brands: typeof brandThemes
}

const BrandThemeContext = createContext<BrandThemeContextValue | null>(null)

type BrandThemeProviderProps = {
  /** Force a brand (skips persisted preference). */
  brand?: BrandThemeConfig
  children: ReactNode
}

/** Applies the selected partner / product Tamagui theme and exposes brand colors. */
export function BrandThemeProvider({ brand, children }: BrandThemeProviderProps) {
  const parent = useContext(BrandThemeContext)

  // portal / sheet re-wrap: keep parent brand selection in sync
  if (parent && !brand) {
    return <Theme name={parent.brand.tamaguiThemeName}>{children}</Theme>
  }

  return <BrandThemeProviderRoot brand={brand}>{children}</BrandThemeProviderRoot>
}

function BrandThemeProviderRoot({
  brand,
  children,
}: {
  brand?: BrandThemeConfig
  children: ReactNode
}) {
  const storedBrandId = useEmitterValue(brandThemeIdEmitter)
  const brandId = brand ? brand.id : storedBrandId

  const setBrandId = useCallback((id: BrandThemeId) => {
    persistBrandThemeId(id)
  }, [])

  const resolvedBrand = brand ?? getBrandTheme(brandId)

  const value = useMemo<BrandThemeContextValue>(
    () => ({
      brand: resolvedBrand,
      brandId: resolvedBrand.id,
      setBrandId: brand ? () => undefined : setBrandId,
      brands: brandThemes,
    }),
    [brand, resolvedBrand, setBrandId],
  )

  return (
    <BrandThemeContext.Provider value={value}>
      <Theme name={resolvedBrand.tamaguiThemeName}>{children}</Theme>
    </BrandThemeContext.Provider>
  )
}

export function useBrandTheme() {
  const context = useContext(BrandThemeContext)
  if (!context) {
    return {
      brand: defaultBrandTheme,
      brandId: defaultBrandTheme.id,
      setBrandId: (_id: BrandThemeId) => undefined,
      brands: brandThemes,
    } satisfies BrandThemeContextValue
  }
  return context
}

export { defaultBrandTheme }
export { readStoredBrandId } from './brandThemeId'
export type { BrandThemeConfig, BrandThemeId }
