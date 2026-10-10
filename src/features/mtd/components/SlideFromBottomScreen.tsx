import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { isWeb, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'

const SLIDE_DURATION_MS = 320

type SlideFromBottomScreenProps = {
  children: (requestClose: (afterClose: () => void) => void) => ReactNode
}

export function SlideFromBottomScreen({ children }: SlideFromBottomScreenProps) {
  const { height } = useWindowDimensions()

  if (isWeb) {
    return <SlideFromBottomScreenWeb height={height}>{children}</SlideFromBottomScreenWeb>
  }

  return (
    <SlideFromBottomScreenNative height={height}>{children}</SlideFromBottomScreenNative>
  )
}

function SlideFromBottomScreenWeb({
  height,
  children,
}: {
  height: number
  children: (requestClose: (afterClose: () => void) => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const requestClose = useCallback((afterClose: () => void) => {
    setOpen(false)
    window.setTimeout(afterClose, SLIDE_DURATION_MS)
  }, [])

  return (
    <YStack flex={1} overflow="hidden" bg={MTD_TOKENS.background}>
      <YStack
        flex={1}
        bg={MTD_TOKENS.background}
        style={{
          transform: `translateY(${open ? 0 : height}px)`,
          opacity: open ? 1 : 0.85,
          transition: `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${SLIDE_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        {children(requestClose)}
      </YStack>
    </YStack>
  )
}

function SlideFromBottomScreenNative({
  height,
  children,
}: {
  height: number
  children: (requestClose: (afterClose: () => void) => void) => ReactNode
}) {
  const progress = useSharedValue(0)
  const colors = useMtdThemeColors()

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [progress])

  const requestClose = useCallback(
    (afterClose: () => void) => {
      progress.value = withTiming(
        0,
        { duration: SLIDE_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(afterClose)()
        },
      )
    },
    [progress],
  )

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [height, 0]),
      },
    ],
    opacity: interpolate(progress.value, [0, 0.35, 1], [0.4, 0.85, 1]),
  }))

  return (
    <YStack flex={1} overflow="hidden" bg={MTD_TOKENS.background}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: colors.background }, panelStyle]}
      >
        {children(requestClose)}
      </Animated.View>
    </YStack>
  )
}
