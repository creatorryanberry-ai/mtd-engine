'use no memo'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { isWeb, Portal, YStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import { useMtdThemeColors } from '../useMtdThemeColors'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'

const SLIDE_DURATION_MS = 300

type MtdSlideFromRightPanelProps = {
  children: (requestClose: () => void) => ReactNode
  onClose: () => void
}

function SlideFromRightPanelWeb({
  width,
  onClose,
  children,
}: {
  width: number
  onClose: () => void
  children: (requestClose: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const requestClose = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => {
      onClose()
    }, SLIDE_DURATION_MS)
  }, [onClose])

  return (
    <Portal stackZIndex={1000}>
      <BrandThemeProvider>
        <YStack
          position="fixed"
          t={0}
          l={0}
          r={0}
          b={0}
          z={1000}
          overflow="hidden"
          bg={MTD_TOKENS.background}
          style={{
            transform: `translateX(${open ? 0 : width}px)`,
            transition: `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          }}
        >
          {children(requestClose)}
        </YStack>
      </BrandThemeProvider>
    </Portal>
  )
}

function SlideFromRightPanelNative({
  width,
  onClose,
  children,
}: {
  width: number
  onClose: () => void
  children: (requestClose: () => void) => ReactNode
}) {
  const colors = useMtdThemeColors()
  const translateX = useSharedValue(width)

  useEffect(() => {
    translateX.value = withTiming(0, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [translateX, width])

  const requestClose = useCallback(() => {
    translateX.value = withTiming(
      width,
      { duration: SLIDE_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)()
      },
    )
  }, [onClose, translateX, width])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <Portal stackZIndex={1000}>
      <BrandThemeProvider>
        <YStack position="absolute" t={0} l={0} r={0} b={0} z={1000} overflow="hidden">
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.background },
              animatedStyle,
            ]}
          >
            {children(requestClose)}
          </Animated.View>
        </YStack>
      </BrandThemeProvider>
    </Portal>
  )
}

export function MtdSlideFromRightPanel({
  children,
  onClose,
}: MtdSlideFromRightPanelProps) {
  const { width } = useWindowDimensions()

  if (isWeb) {
    return (
      <SlideFromRightPanelWeb width={width} onClose={onClose}>
        {children}
      </SlideFromRightPanelWeb>
    )
  }

  return (
    <SlideFromRightPanelNative width={width} onClose={onClose}>
      {children}
    </SlideFromRightPanelNative>
  )
}
