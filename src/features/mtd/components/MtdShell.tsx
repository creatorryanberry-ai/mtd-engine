import type { ReactNode } from 'react'
import { isWeb, YStack } from 'tamagui'

import { TaxYearProvider } from '~/features/mtd/context/TaxYearProvider'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'

import { MtdBottomNav } from './MtdBottomNav'
import { MtdSidebar } from './MtdNavigation'
import { QuickAddSheet } from './QuickAddSheet'

type MtdShellProps = {
  children: ReactNode
}

export function MtdShell({ children }: MtdShellProps) {
  return (
    <BrandThemeProvider>
      <TaxYearProvider>
        <YStack
          flex={1}
          bg="$background"
          flexDirection="column"
          $lg={{ flexDirection: 'row' }}
          {...(isWeb && {
            minHeight: '100vh' as any,
            width: '100%' as any,
          })}
        >
          <MtdSidebar />
          <YStack flex={1} minW={0} grow={1} shrink={1} position="relative">
            {children}
            <MtdBottomNav />
            <QuickAddSheet />
          </YStack>
        </YStack>
      </TaxYearProvider>
    </BrandThemeProvider>
  )
}
