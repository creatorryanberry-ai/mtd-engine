import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { isWeb, Portal, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'

const SLIDE_DURATION_MS = 300

type SlideFromRightPanelProps = {
  children: (requestClose: () => void) => ReactNode
  onClose: () => void
}

export function SlideFromRightPanel({ children, onClose }: SlideFromRightPanelProps) {
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
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const requestClose = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => {
      onCloseRef.current()
    }, SLIDE_DURATION_MS)
  }, [])

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
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closedRef = useRef(false)

  useEffect(() => {
    translateX.value = withTiming(0, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [translateX, width])

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onCloseRef.current()
  }, [])

  const requestClose = useCallback(() => {
    // always unmount even if the reanimated callback never fires
    const fallback = setTimeout(() => {
      finishClose()
    }, SLIDE_DURATION_MS + 80)

    translateX.value = withTiming(
      width,
      { duration: SLIDE_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        clearTimeout(fallback)
        if (finished) runOnJS(finishClose)()
        else runOnJS(finishClose)()
      },
    )
  }, [finishClose, translateX, width])

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
