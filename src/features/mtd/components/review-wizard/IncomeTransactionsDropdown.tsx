import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { CaretUpIcon } from '~/interface/icons/phosphor/CaretUpIcon'

import type { ReviewPeriodTransaction } from '~/features/submission/reviewFinancialEstimates'

const SLIDE_MS = 250

type RecordedTransactionsDropdownProps = {
  transactions: ReviewPeriodTransaction[]
  emptyMessage?: string
}

function SlidingDisclosure({ open, children }: { open: boolean; children: ReactNode }) {
  const [measuredHeight, setMeasuredHeight] = useState(0)
  const height = useSharedValue(0)

  useEffect(() => {
    height.value = withTiming(open ? measuredHeight : 0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [height, measuredHeight, open])

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: measuredHeight === 0 ? 0 : height.value / Math.max(measuredHeight, 1),
  }))

  if (isWeb) {
    return (
      <YStack
        overflow="hidden"
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: `grid-template-rows ${SLIDE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        <YStack overflow="hidden" minH={0}>
          {children}
        </YStack>
      </YStack>
    )
  }

  return (
    <Animated.View style={[styles.clip, animatedStyle]}>
      <YStack
        position={measuredHeight > 0 ? 'relative' : 'absolute'}
        width="100%"
        onLayout={(event) => {
          const next = Math.ceil(event.nativeEvent.layout.height)
          if (next > 0 && next !== measuredHeight) {
            setMeasuredHeight(next)
          }
        }}
      >
        {children}
      </YStack>
    </Animated.View>
  )
}

function withAlpha(hexColor: string, alpha: number) {
  const hex = hexColor.replace('#', '')
  if (hex.length !== 6) return hexColor
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function DropdownHeader({
  expanded,
  total,
  onPress,
}: {
  expanded: boolean
  total: number
  onPress: () => void
}) {
  const colors = useMtdThemeColors()
  const accentSoft = withAlpha(colors.accent, 0.5)
  const progress = useSharedValue(expanded ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    })
  }, [expanded, progress])

  const headerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.card, accentSoft]),
  }))

  const iconColor = expanded ? colors.text : colors.textMuted

  if (isWeb) {
    return (
      <XStack
        px="$4"
        py="$3.5"
        items="center"
        justify="space-between"
        gap="$3"
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
        style={{
          backgroundColor: expanded ? accentSoft : colors.card,
          transition: `background-color ${SLIDE_MS}ms ease`,
        }}
      >
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Already recorded
        </SizableText>
        <XStack gap="$2" items="center" shrink={0}>
          <SizableText fontSize={14} fontWeight="700" color={MTD_TOKENS.text}>
            {formatSubmissionAmount(total)}
          </SizableText>
          {expanded ? (
            <CaretUpIcon size={16} color={iconColor} />
          ) : (
            <CaretDownIcon size={16} color={iconColor} />
          )}
        </XStack>
      </XStack>
    )
  }

  return (
    <Animated.View style={headerStyle}>
      <XStack
        px="$4"
        py="$3.5"
        items="center"
        justify="space-between"
        gap="$3"
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
      >
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Already recorded
        </SizableText>
        <XStack gap="$2" items="center" shrink={0}>
          <SizableText fontSize={14} fontWeight="700" color={MTD_TOKENS.text}>
            {formatSubmissionAmount(total)}
          </SizableText>
          {expanded ? (
            <CaretUpIcon size={16} color={iconColor} />
          ) : (
            <CaretDownIcon size={16} color={iconColor} />
          )}
        </XStack>
      </XStack>
    </Animated.View>
  )
}

export function RecordedTransactionsDropdown({
  transactions,
  emptyMessage = 'No transactions recorded for this period yet.',
}: RecordedTransactionsDropdownProps) {
  const [expanded, setExpanded] = useState(false)
  const total = transactions.reduce((sum, item) => sum + item.amount, 0)

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      overflow="hidden"
    >
      <DropdownHeader
        expanded={expanded}
        total={total}
        onPress={() => setExpanded((value) => !value)}
      />

      <SlidingDisclosure open={expanded}>
        {transactions.length === 0 ? (
          <SizableText
            fontSize={13}
            color={MTD_TOKENS.textMuted}
            px="$4"
            pb="$3.5"
            lineHeight={18}
          >
            {emptyMessage}
          </SizableText>
        ) : (
          <YStack borderTopWidth={1} borderColor={MTD_TOKENS.cardBorder}>
            {transactions.map((transaction, index) => (
              <XStack
                key={transaction.id}
                px="$4"
                py="$3"
                items="flex-start"
                justify="space-between"
                gap="$3"
                borderBottomWidth={index === transactions.length - 1 ? 0 : 1}
                borderColor={MTD_TOKENS.cardBorder}
              >
                <YStack flex={1} minW={0} gap="$0.5">
                  <SizableText
                    fontSize={14}
                    fontWeight="500"
                    color={MTD_TOKENS.text}
                    numberOfLines={1}
                  >
                    {transaction.label}
                  </SizableText>
                  <SizableText
                    fontSize={12}
                    color={MTD_TOKENS.textMuted}
                    numberOfLines={1}
                  >
                    {transaction.accountLabel}
                  </SizableText>
                </YStack>
                <SizableText
                  fontSize={14}
                  fontWeight="600"
                  color={MTD_TOKENS.text}
                  shrink={0}
                >
                  {formatSubmissionAmount(transaction.amount)}
                </SizableText>
              </XStack>
            ))}
          </YStack>
        )}
      </SlidingDisclosure>
    </YStack>
  )
}

/** @deprecated use RecordedTransactionsDropdown */
export function IncomeTransactionsDropdown(props: RecordedTransactionsDropdownProps) {
  return (
    <RecordedTransactionsDropdown
      {...props}
      emptyMessage={
        props.emptyMessage ?? 'No income transactions recorded for this period yet.'
      }
    />
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    width: '100%',
  },
})
