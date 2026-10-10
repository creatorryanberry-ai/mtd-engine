import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState, type ReactNode } from 'react'
import { LogBox } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { PortalProvider } from 'react-native-teleport'

import { Splash } from '../splash/splash'

// TODO properly clean these up
LogBox.ignoreLogs([
  'clientID=',
  'Got unexpected socket close event',
  'Failed to connect',
  'WebSocket connection closed abruptly',
  'findNodeHandle is deprecated',
  'findHostInstance_DEPRECATED is deprecated',
  `Can't perform a React state update`,
])

let splashHasBeenShown = false

export function PlatformSpecificRootProvider({ children }: { children: ReactNode }) {
  const [showSplash, setShowSplash] = useState<boolean>(!splashHasBeenShown)

  // never leave the native splash up forever if the react splash fails to mount
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync()
    }, 12_000)
    return () => clearTimeout(t)
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <PortalProvider>
          {showSplash && (
            <Splash
              isReady={true}
              onAnimationEnd={() => {
                splashHasBeenShown = true
                setShowSplash(false)
              }}
            />
          )}
          {children}
        </PortalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
