import { usePathname } from 'one'
import { YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { isMtdMarketingPath } from '~/features/mtd/isMtdMarketingPath'

import type { ReactNode } from 'react'

export function SiteRootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isLoggedIn = pathname.startsWith('/home') || pathname.startsWith('/engine')
  const isMtdPublicPage = isMtdMarketingPath(pathname)

  return (
    <YStack
      flex={1}
      width="100%"
      minH="100vh"
      bg={isMtdPublicPage ? MTD_TOKENS.background : undefined}
    >
      {isLoggedIn || isMtdPublicPage ? (
        <YStack
          flex={isLoggedIn ? 1 : undefined}
          width="100%"
          bg={isMtdPublicPage ? MTD_TOKENS.background : undefined}
          render="main"
          role="main"
        >
          {children}
        </YStack>
      ) : (
        <YStack flex={1} width="100%" render="main" role="main" py="$12" px="$4">
          {children}
        </YStack>
      )}
    </YStack>
  )
}
