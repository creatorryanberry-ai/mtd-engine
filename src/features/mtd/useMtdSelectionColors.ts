import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

import { MTD_TOKENS } from './mtdTokens'

export function useMtdSelectionColors(selected: boolean) {
  const { brand } = useBrandTheme()

  return {
    borderColor: selected ? brand.colors.accentBorder : MTD_TOKENS.cardBorder,
    iconColor: selected ? brand.colors.accentIcon : MTD_TOKENS.textMuted,
    textColor: selected ? MTD_TOKENS.text : MTD_TOKENS.textMuted,
  }
}
