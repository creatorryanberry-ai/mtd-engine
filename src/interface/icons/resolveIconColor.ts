import { IS_WEB } from '@mtd/helpers'
import { useTheme, type ColorTokens } from 'tamagui'

type ThemeColorVar = { val: string; get: () => string }

/** Resolve a Tamagui color token or hex string to a value SVG fill accepts on web. */
export function useResolvedIconColor(
  color?: ColorTokens | string,
  fallback: ColorTokens = '$color11',
): string {
  const theme = useTheme()
  const token = color ?? fallback

  if (typeof token === 'string' && token.startsWith('#')) {
    return token
  }

  const key = token.startsWith('$') ? token.slice(1) : token
  const themeVar = theme[key as keyof typeof theme] as ThemeColorVar | undefined

  if (themeVar && typeof themeVar === 'object') {
    // svg fill attributes need concrete colors on web — .get() returns css var() refs
    const resolved = IS_WEB ? themeVar.val : themeVar.get()
    if (resolved) return resolved
  }

  return IS_WEB ? (theme.color11?.val ?? '#9CA3AF') : (theme.color11?.get() ?? '#9CA3AF')
}
