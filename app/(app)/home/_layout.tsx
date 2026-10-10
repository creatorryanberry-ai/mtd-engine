import { Redirect, Slot, usePathname } from 'one'
import { SizableText, Spinner, YStack } from 'tamagui'

import { ProvideQuery } from '~/features/api/client/ProvideQuery'
import { useAuth } from '~/features/auth/client/authClient'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { shouldBlockNativeSettingsLanding } from '~/features/mtd/mtdNavigationSession'
import { useUser } from '~/features/user/useUser'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'

function HomeGate() {
  const pathname = usePathname()
  const { hasOnboarded, isLoading, isError, refresh } = useUser()
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (shouldBlockNativeSettingsLanding(normalizedPath)) {
    return <Redirect href={MTD_ROUTES.overview} />
  }

  if (isLoading) {
    return (
      <YStack flex={1} bg={MTD_TOKENS.background} items="center" justify="center">
        <Spinner size="large" color={MTD_TOKENS.orange} />
      </YStack>
    )
  }

  if (isError) {
    return (
      <YStack
        flex={1}
        bg={MTD_TOKENS.background}
        items="center"
        justify="center"
        gap="$3"
        px="$4"
      >
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Could not reach the server
        </SizableText>
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          Check you are online, then try again. If you just pointed this app at staging,
          sign in again.
        </SizableText>
        <MtdActionButton onPress={() => void refresh()}>Try again</MtdActionButton>
      </YStack>
    )
  }

  if (!hasOnboarded && normalizedPath !== MTD_ROUTES.businessSetup) {
    return <Redirect href={MTD_ROUTES.businessSetup} />
  }

  if (hasOnboarded && normalizedPath === MTD_ROUTES.businessSetup) {
    return <Redirect href={MTD_ROUTES.overview} />
  }

  return <Slot />
}

export const AppLayout = () => {
  const { state } = useAuth()

  if (state === 'logged-out') {
    // native has no marketing `/` route — always send logged-out users to login.
    if (process.env.VITE_NATIVE || isPublicAuthEnabled) {
      return <Redirect href="/auth/login" />
    }
    return <Redirect href="/" />
  }

  return (
    <ProvideQuery>
      <HomeGate />
    </ProvideQuery>
  )
}
