import { LinearGradient } from '@tamagui/linear-gradient'
import { ImageBackground } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWindowDimensions, View } from 'tamagui'

import { useIsDark } from '~/features/theme/useIsDark'
import { useIsMtdTheme } from '~/features/theme/useIsMtdTheme'

import { GradientBlurView } from '../effects/GradientBlurView'

interface GradientBackgroundProps {
  useImage?: boolean
  useInsets?: boolean
  bottomOffset?: number
  /** android pads for a stack header; auth step pages draw their own. */
  androidHeaderOffset?: boolean
  children?: React.ReactNode
}

export const GradientBackground = ({
  useImage = false,
  useInsets = true,
  androidHeaderOffset = true,
  children,
  bottomOffset,
}: GradientBackgroundProps) => {
  const inset = useSafeAreaInsets()
  const isDark = useIsDark()
  const isMtd = useIsMtdTheme()
  const { width, height } = useWindowDimensions()
  const offset = bottomOffset || inset.top + 60
  const androidPad = androidHeaderOffset ? { pt: offset } : undefined

  const lightColors = ['$color1', '$color2', '$color4', '$color5']
  const darkColors = ['$color1', '$color3', '$color2', '$color1']

  if (isMtd) {
    return (
      <View
        flex={1}
        bg="$background"
        pb={useInsets ? inset.bottom : 0}
        $platform-android={androidPad}
      >
        {children}
      </View>
    )
  }

  if (useImage) {
    return (
      <>
        <View flex={1} pb={useInsets ? inset.bottom : 0} $platform-android={androidPad}>
          {/* Content */}
          {children}
        </View>
        <ImageBackground
          source={
            isDark
              ? require('../../../assets/background-dark.png')
              : require('../../../assets/background-light.png')
          }
          style={[
            { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
            { zIndex: -2 },
          ]}
          resizeMode="cover"
        />
        <GradientBlurView width={width} height={height / 1.5} />
      </>
    )
  }

  return (
    <View flex={1} pb={useInsets ? inset.bottom : 0} $platform-android={androidPad}>
      {/* Base gradient - using theme colors */}
      <LinearGradient
        colors={isDark ? darkColors : lightColors}
        locations={[0, 0.3, 0.6, 1]}
        start={[0, 0]}
        end={[1, 1]}
        style={[
          { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
          { zIndex: -2 },
        ]}
      />

      {/* Content */}
      {children}
    </View>
  )
}
