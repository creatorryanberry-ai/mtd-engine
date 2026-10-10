import { Stack } from 'one'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { PlatformSpecificRootProvider } from '~/interface/platform/PlatformSpecificRootProvider'
import { GlobalTooltipProvider } from '~/interface/tooltip/Tooltip'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'

/**
 * native-only root layout — mobile app routes only (`(app)`).
 * web site/help/legal live in `_layout.tsx`.
 */
export function Layout() {
  return (
    <PlatformSpecificRootProvider>
      <TamaguiRootProvider>
        <GlobalTooltipProvider>
          <SafeAreaProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'none',
              }}
            >
              <Stack.Screen name="(app)" />
            </Stack>
          </SafeAreaProvider>
        </GlobalTooltipProvider>
      </TamaguiRootProvider>
    </PlatformSpecificRootProvider>
  )
}
