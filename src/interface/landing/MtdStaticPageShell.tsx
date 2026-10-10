import { YStack } from 'tamagui'

import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import { MtdLandingFooter } from './MtdLandingFooter'
import { MtdLandingHeader } from './MtdLandingHeader'

import type { ReactNode } from 'react'

type MtdStaticPageShellProps = {
  children: ReactNode
  wide?: boolean
}

export function MtdStaticPageShell({ children, wide }: MtdStaticPageShellProps) {
  return (
    <BrandThemeProvider>
      <YStack position="relative" bg={MTD_TOKENS.background} minH="100vh" width="100%">
        <MtdLandingHeader />
        <YStack width="100%" maxW={wide ? 850 : 720} mx="auto" px="$4" py="$4" gap="$4">
          {children}
        </YStack>
        <MtdLandingFooter />
      </YStack>
    </BrandThemeProvider>
  )
}
