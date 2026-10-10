import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Pressable as GesturePressable } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SizableText } from 'tamagui'

import { getContrastingTextColor } from '../utils/contrastTextColor'
import { isTransactionCategorised } from '../utils/formatTransactionDisplay'
import { MTD_TOKENS } from '../mtdTokens'
import { lightImpact } from '~/interface/haptics/haptics'

import { MtdGroupedTransactionRow } from './MtdTransactionRowDetails'

const ACTION_WIDTH = 88
const DISMISS_FADE_MS = 180
const DISMISS_COLLAPSE_MS = 260
const ROW_GAP = 12

type MtdSwipeableTransactionGroupRowProps = ComponentProps<
  typeof MtdGroupedTransactionRow
> & {
  onAccept?: () => void | Promise<void>
  onAddRule?: () => void
}

function ActionButton({
  width,
  backgroundColor,
  textColor,
  label,
  onPress,
}: {
  width: number
  backgroundColor: string
  textColor: string
  label: string
  onPress: () => void
}) {
  return (
    <GesturePressable
      onPress={onPress}
      style={{
        width,
        height: '100%',
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SizableText fontSize={13} fontWeight="700" style={{ color: textColor }}>
        {label}
      </SizableText>
    </GesturePressable>
  )
}

export function MtdSwipeableTransactionGroupRow({
  transactions,
  onAccept,
  onAddRule,
  ...props
}: MtdSwipeableTransactionGroupRowProps) {
  const swipeableRef = useRef<Swipeable>(null)
  const isDismissingRef = useRef(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const measuredHeight = useSharedValue(0)
  const animatedHeight = useSharedValue(-1)
  const opacity = useSharedValue(1)
  const marginBottom = useSharedValue(ROW_GAP)
  const onAcceptRef = useRef(onAccept)
  onAcceptRef.current = onAccept

  const lead = transactions[0]
  const canAccept = Boolean(
    lead && isTransactionCategorised(lead.hmrcCategory) && onAccept,
  )
  const canAddRule = Boolean(lead && onAddRule)

  const restoreRow = useCallback(() => {
    isDismissingRef.current = false
    setIsDismissing(false)
    opacity.value = withTiming(1, { duration: DISMISS_FADE_MS })
    marginBottom.value = withTiming(ROW_GAP, { duration: DISMISS_COLLAPSE_MS })
    animatedHeight.value = withTiming(
      measuredHeight.value,
      { duration: DISMISS_COLLAPSE_MS },
      (finished) => {
        if (finished) {
          animatedHeight.value = -1
        }
      },
    )
  }, [animatedHeight, marginBottom, measuredHeight, opacity])

  const commitAccept = useCallback(() => {
    void (async () => {
      try {
        await onAcceptRef.current?.()
      } catch (error) {
        console.error('[transactions] swipe accept failed', error)
        restoreRow()
      }
    })()
  }, [restoreRow])

  const handleAccept = useCallback(() => {
    if (!onAccept || isDismissingRef.current) return

    isDismissingRef.current = true
    setIsDismissing(true)
    void lightImpact()

    // keep swipe open — fade + collapse so rows below slide up with the row
    const height = measuredHeight.value
    opacity.value = withTiming(0, { duration: DISMISS_FADE_MS })
    marginBottom.value = withTiming(0, { duration: DISMISS_COLLAPSE_MS })
    animatedHeight.value = height
    animatedHeight.value = withTiming(
      0,
      { duration: DISMISS_COLLAPSE_MS },
      (finished) => {
        if (finished) {
          runOnJS(commitAccept)()
        }
      },
    )
  }, [animatedHeight, commitAccept, marginBottom, measuredHeight, onAccept, opacity])

  const handleAddRule = useCallback(() => {
    if (!onAddRule || isDismissingRef.current) return

    void lightImpact()
    swipeableRef.current?.close()
    onAddRule()
  }, [onAddRule])

  const renderLeftActions = useCallback(() => {
    if (!lead || !canAccept) return null

    const backgroundColor = lead.color
    const textColor = getContrastingTextColor(backgroundColor)

    return (
      <View style={styles.actionSlot}>
        <ActionButton
          width={ACTION_WIDTH}
          backgroundColor={backgroundColor}
          textColor={textColor}
          label="Accept"
          onPress={handleAccept}
        />
      </View>
    )
  }, [canAccept, handleAccept, lead])

  const renderRightActions = useCallback(() => {
    if (!canAddRule) return null

    return (
      <View style={[styles.actionSlot, styles.rightActionSlot]}>
        <ActionButton
          width={ACTION_WIDTH}
          backgroundColor={MTD_TOKENS.cardInset}
          textColor="#FFFFFF"
          label="Add rule"
          onPress={handleAddRule}
        />
      </View>
    )
  }, [canAddRule, handleAddRule])

  const cardWrapper = useCallback(
    (cardBody: ReactNode) => (
      <Swipeable
        ref={swipeableRef}
        friction={1}
        dragOffsetFromLeftEdge={4}
        dragOffsetFromRightEdge={4}
        leftThreshold={ACTION_WIDTH * 0.35}
        rightThreshold={ACTION_WIDTH * 0.35}
        containerStyle={styles.container}
        overshootLeft={false}
        overshootRight={false}
        enabled={!isDismissing}
        renderLeftActions={canAccept ? renderLeftActions : undefined}
        renderRightActions={canAddRule ? renderRightActions : undefined}
      >
        {cardBody}
      </Swipeable>
    ),
    [canAccept, canAddRule, isDismissing, renderLeftActions, renderRightActions],
  )

  const animatedStyle = useAnimatedStyle(() => {
    const style: {
      opacity: number
      marginBottom: number
      overflow: 'hidden'
      height?: number
    } = {
      opacity: opacity.value,
      marginBottom: marginBottom.value,
      overflow: 'hidden',
    }

    if (animatedHeight.value >= 0) {
      style.height = animatedHeight.value
    }

    return style
  })

  const row =
    !canAccept && !canAddRule ? (
      <MtdGroupedTransactionRow transactions={transactions} {...props} />
    ) : (
      <MtdGroupedTransactionRow
        transactions={transactions}
        {...props}
        cardWrapper={cardWrapper}
      />
    )

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(event) => {
        if (isDismissingRef.current) return
        measuredHeight.value = event.nativeEvent.layout.height
      }}
      pointerEvents={isDismissing ? 'none' : 'auto'}
    >
      {row}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionSlot: {
    width: ACTION_WIDTH,
    height: '100%',
    flexDirection: 'row',
  },
  rightActionSlot: {
    alignSelf: 'flex-end',
  },
})
