import { useThemeName } from 'tamagui'

export function useIsMtdTheme() {
  const themeName = useThemeName()
  return (
    themeName.includes('mtd') ||
    themeName.includes('actor') ||
    themeName.includes('parkins')
  )
}
