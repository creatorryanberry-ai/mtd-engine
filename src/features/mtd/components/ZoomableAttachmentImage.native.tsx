import { useEffect } from 'react'
import { View } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { haptics } from '~/interface/haptics/haptics'

type ZoomableAttachmentImageProps = {
  uri: string
  width: number
  height: number
  maxHeight: number
  contentPosition?: 'center' | 'top' | 'bottom'
  recyclingKey?: string
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const RUBBER_MIN_SCALE = 0.7
const FIT_SNAP_SCALE = 1.08
const DOUBLE_TAP_SCALE = 2.5

function bumpZoomHaptic() {
  haptics.pinchZoom()
}

/** pinch / pan / double-tap zoom for receipt and statement previews */
export function ZoomableAttachmentImage({
  uri,
  width,
  height,
  maxHeight,
  contentPosition = 'center',
  recyclingKey,
}: ZoomableAttachmentImageProps) {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const viewportW = useSharedValue(width)
  const viewportH = useSharedValue(Math.min(height, maxHeight))

  const displayHeight = Math.min(height, maxHeight)

  useEffect(() => {
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    savedTranslateX.value = 0
    savedTranslateY.value = 0
    viewportH.value = displayHeight
  }, [
    uri,
    displayHeight,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    viewportH,
  ])

  const snapToFit = () => {
    'worklet'
    scale.value = withTiming(MIN_SCALE)
    savedScale.value = MIN_SCALE
    translateX.value = withTiming(0)
    translateY.value = withTiming(0)
    savedTranslateX.value = 0
    savedTranslateY.value = 0
  }

  const clampTranslation = (nextScale: number, persist = false) => {
    'worklet'
    const maxX = Math.max(0, (viewportW.value * (nextScale - 1)) / 2)
    const maxY = Math.max(0, (viewportH.value * (nextScale - 1)) / 2)
    const nextX = Math.min(maxX, Math.max(-maxX, translateX.value))
    const nextY = Math.min(maxY, Math.max(-maxY, translateY.value))
    translateX.value = nextX
    translateY.value = nextY
    if (persist) {
      savedTranslateX.value = nextX
      savedTranslateY.value = nextY
    }
  }

  /** after pinch/pan: fit if zoomed out, otherwise keep image in the window */
  const snapOrClamp = () => {
    'worklet'
    if (scale.value <= FIT_SNAP_SCALE) {
      snapToFit()
      return
    }
    savedScale.value = scale.value
    clampTranslation(scale.value, true)
    translateX.value = withTiming(savedTranslateX.value)
    translateY.value = withTiming(savedTranslateY.value)
  }

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(RUBBER_MIN_SCALE, savedScale.value * event.scale),
      )
      scale.value = next
      if (next <= MIN_SCALE) {
        translateX.value = 0
        translateY.value = 0
        return
      }
      clampTranslation(next)
    })
    .onFinalize(() => {
      snapOrClamp()
    })

  const pan = Gesture.Pan()
    .averageTouches(true)
    .maxPointers(2)
    .manualActivation(true)
    .onTouchesMove((_event, state) => {
      if (scale.value > MIN_SCALE) {
        state.activate()
      } else {
        state.fail()
      }
    })
    .onUpdate((event) => {
      if (scale.value <= MIN_SCALE) return
      translateX.value = savedTranslateX.value + event.translationX
      translateY.value = savedTranslateY.value + event.translationY
      clampTranslation(scale.value)
    })
    .onFinalize(() => {
      snapOrClamp()
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scheduleOnRN(bumpZoomHaptic)
      if (savedScale.value > MIN_SCALE) {
        snapToFit()
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE)
        savedScale.value = DOUBLE_TAP_SCALE
      }
    })

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View
      style={{ width: '100%', height: displayHeight, overflow: 'hidden' }}
      onLayout={(event) => {
        viewportW.value = event.nativeEvent.layout.width
        viewportH.value = event.nativeEvent.layout.height
      }}
    >
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            {
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedStyle,
          ]}
        >
          <ExpoImage
            source={{ uri }}
            style={{ width, height: displayHeight }}
            contentFit="contain"
            contentPosition={contentPosition}
            recyclingKey={recyclingKey ?? uri}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
