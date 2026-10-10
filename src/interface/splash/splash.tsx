import { memo, useEffect } from 'react'
import { Dimensions, Image, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as SplashScreen from 'expo-splash-screen'

import { mtdPalette } from '~/tamagui/themes'

type SplashProps = {
  isReady: boolean
  onAnimationEnd: () => void
}

const SPLASH_LOGO_RATIO = 337 / 51
const SPLASH_LOGO_WIDTH = Math.min(320, Dimensions.get('window').width - 48)
const SPLASH_LOGO_HEIGHT = SPLASH_LOGO_WIDTH / SPLASH_LOGO_RATIO

export const Splash = memo(({ onAnimationEnd, isReady }: SplashProps) => {
  const scale = useSharedValue(0)
  const translateY = useSharedValue(0)
  const rotateZ = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { rotateZ: `${rotateZ.value}deg` },
        { scale: scale.value },
      ],
    }
  })

  useEffect(() => {
    // reveal react splash so the zoom-in is visible over the native one
    void SplashScreen.hideAsync()

    scale.set(
      withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      }),
    )

    if (isReady) {
      rotateZ.set(
        withDelay(
          900,
          withSequence(
            withTiming(-15, { duration: 80 }),
            withTiming(15, { duration: 80 }),
            withTiming(-10, { duration: 70 }),
            withTiming(10, { duration: 70 }),
            withTiming(-5, { duration: 60 }),
            withTiming(0, { duration: 60 }),
          ),
        ),
      )
      translateY.set(
        withDelay(
          1400,
          withSequence(withTiming(-50), withTiming(Dimensions.get('window').height)),
        ),
      )
    }

    const timeout = setTimeout(() => {
      onAnimationEnd()
    }, 2250)

    return () => clearTimeout(timeout)
  }, [rotateZ, translateY, scale, isReady, onAnimationEnd])

  return (
    <Animated.View
      exiting={FadeOut}
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 1000,
          backgroundColor: mtdPalette.mtd2,
          justifyContent: 'center',
          alignItems: 'center',
        },
      ]}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            width: SPLASH_LOGO_WIDTH,
            height: SPLASH_LOGO_HEIGHT,
            overflow: 'visible',
          },
        ]}
      >
        <Image
          source={require('../../../assets/splash-logo.png')}
          style={{ width: SPLASH_LOGO_WIDTH, height: SPLASH_LOGO_HEIGHT }}
          resizeMode="contain"
          accessibilityLabel="Straight Up Tax"
        />
      </Animated.View>
    </Animated.View>
  )
})
