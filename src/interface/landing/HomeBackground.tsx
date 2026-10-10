import { usePathname } from 'one'
import { YStack, styled } from 'tamagui'

import { isMtdMarketingPath } from '~/features/mtd/isMtdMarketingPath'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'

const GradientOrb = styled(YStack, {
  position: 'absolute',
  rounded: 1000,
  pointerEvents: 'none',
  style: {
    willChange: 'transform',
    transform: 'translateZ(0)',
  },
})

export function HomeBackground() {
  const pathname = usePathname()
  const colors = useMtdThemeColors()

  if (process.env.VITE_NATIVE || !isMtdMarketingPath(pathname)) {
    return null
  }

  return (
    <YStack position="absolute" inset={0} z={0} pointerEvents="none" overflow="hidden">
      <GradientOrb
        width={900}
        height={900}
        t={-200}
        l="50%"
        style={{
          marginLeft: -450,
          background: `radial-gradient(circle, ${colors.accent}22 0%, transparent 70%)`,
        }}
      />
      <GradientOrb
        width={600}
        height={600}
        b={-100}
        r={-100}
        style={{
          background: `radial-gradient(circle, ${colors.accent}14 0%, transparent 70%)`,
        }}
      />
    </YStack>
  )
}
