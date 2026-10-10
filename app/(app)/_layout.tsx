import { Slot, Stack } from 'one'
import { useRef } from 'react'
import { Configuration, Spinner, YStack } from 'tamagui'

import { ProvideQuery } from '~/features/api/client/ProvideQuery'
import { useAuth } from '~/features/auth/client/authClient'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { useWidgetDeepLink } from '~/features/widgets/useWidgetDeepLink'
import { useWidgets } from '~/features/widgets/useWidgets'
import { Dialogs } from '~/interface/dialogs/Dialogs'
import { ToastProvider } from '~/interface/toast/Toast'
import { animationsApp } from '~/tamagui/animationsApp'

function WidgetSetup() {
  useWidgetDeepLink()
  useWidgets()
  return null
}

function AuthLoadingOverlay() {
  return (
    <YStack flex={1} items="center" justify="center" bg="$background">
      <Spinner size="large" color="$color10" />
    </YStack>
  )
}

export function AppLayout() {
  const { state, user } = useAuth()
  // once auth has resolved once, never unmount the tree for a background refetch
  const authReadyRef = useRef(state !== 'loading')
  if (state !== 'loading') {
    authReadyRef.current = true
  }

  if (state === 'loading' && !user && !authReadyRef.current) {
    return (
      <Configuration disableSSR animationDriver={animationsApp}>
        <BrandThemeProvider>
          <AuthLoadingOverlay />
        </BrandThemeProvider>
      </Configuration>
    )
  }

  return (
    <Configuration disableSSR animationDriver={animationsApp}>
      <ProvideQuery>
        <BrandThemeProvider>
          <WidgetSetup />
          <ToastProvider>
            {process.env.VITE_NATIVE ? (
              <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
                <Stack.Screen name="auth" />
                <Stack.Screen name="home" />
              </Stack>
            ) : (
              <Slot />
            )}
            <Dialogs />
          </ToastProvider>
        </BrandThemeProvider>
      </ProvideQuery>
    </Configuration>
  )
}
