import { useState } from 'react'
import { Platform } from 'react-native'
import {
  KeyboardStickyView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack } from 'tamagui'

import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { BlurView } from '~/interface/effects/BlurView'

import type { KeyboardStickyFooterProps } from './KeyboardStickyFooter'

const FOOTER_HEIGHT = 80

function withAlpha(hexColor: string, alpha: number) {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return hexColor
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export const KeyboardStickyFooter = ({
  children,
  offset,
  openedOffset = 0,
}: KeyboardStickyFooterProps) => {
  const { bottom } = useSafeAreaInsets()
  const { brand } = useBrandTheme()
  const { height, progress } = useReanimatedKeyboardAnimation()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const wash = withAlpha(String(brand.colors.background), 0.78)

  useAnimatedReaction(
    () => progress.value > 0.5,
    (open) => {
      runOnJS(setKeyboardOpen)(open)
    },
  )

  const fillStyle = useAnimatedStyle(() => {
    const keyboardHeight = Math.max(0, -height.value)
    return {
      height: keyboardHeight + FOOTER_HEIGHT + (keyboardHeight > 0 ? 0 : bottom),
    }
  })

  const content = (
    <YStack width="100%">
      <YStack width="100%" px="$4" height={FOOTER_HEIGHT} justify="center">
        {children}
      </YStack>
      {keyboardOpen ? null : <YStack height={bottom} />}
    </YStack>
  )

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            backgroundColor: Platform.OS === 'android' ? wash : 'transparent',
          },
          fillStyle,
        ]}
      >
        {Platform.OS === 'ios' ? (
          <>
            <BlurView intensity={40} style={{ flex: 1 }} />
            <YStack position="absolute" inset={0} bg={wash} pointerEvents="none" />
          </>
        ) : null}
      </Animated.View>
      <KeyboardStickyView
        offset={{ closed: offset ?? 0, opened: openedOffset }}
        style={{ width: '100%', backgroundColor: 'transparent' }}
      >
        {Platform.OS === 'ios' ? <BlurView intensity={40}>{content}</BlurView> : content}
      </KeyboardStickyView>
    </>
  )
}
