import { useTheme } from 'tamagui'

import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

type ThemeColorVar = { val: string; get: () => string }

function readThemeColor(
  theme: ReturnType<typeof useTheme>,
  key: string,
  fallback: string,
) {
  const themeVar = theme[key as keyof typeof theme] as ThemeColorVar | undefined
  if (themeVar && typeof themeVar === 'object') {
    return themeVar.val || themeVar.get()
  }
  return fallback
}

/** Resolved hex/rgba values for raw CSS, RN StyleSheet, and SVG fills. */
export function useMtdThemeColors() {
  const theme = useTheme()
  const { brand } = useBrandTheme()
  const { colors } = brand

  return {
    background: readThemeColor(theme, 'background', colors.background),
    card: readThemeColor(theme, 'color5', colors.card),
    cardBorder: readThemeColor(theme, 'color9', colors.cardBorder),
    cardInset: readThemeColor(theme, 'color7', colors.cardInset),
    transactionCardBorder: colors.transactionCardBorder,
    stackedCardBorder: colors.stackedCardBorder,
    text: readThemeColor(theme, 'color12', colors.text),
    textMuted: readThemeColor(theme, 'color11', colors.textMuted),
    textSubtle: readThemeColor(theme, 'color10', colors.textSubtle),
    accent: readThemeColor(theme, 'orange10', colors.accent),
    accentMuted: readThemeColor(theme, 'orange4', colors.accentMuted),
    onAccent: colors.onAccent,
    green: readThemeColor(theme, 'green10', colors.green),
    blue: readThemeColor(theme, 'blue10', colors.blue),
    purple: readThemeColor(theme, 'purple10', colors.purple),
  } as const
}
