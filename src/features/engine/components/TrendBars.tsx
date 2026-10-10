import { useState } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'

import type { ColorTokens } from 'tamagui'

export type TrendPoint = { key: string; label: string; value: number }

const BAR_MAX_WIDTH = 24
const BAR_COLOR: ColorTokens = '$blue10'
const BAR_ACTIVE: ColorTokens = '$blue12'

/**
 * single-series column chart from stacks: one hue, a zero baseline, 2px gaps,
 * 4px rounded data ends. hover or tap a column for its value; a table view is
 * one tap away so nothing is colour or shape alone.
 */
export function TrendBars({
  points,
  format,
  title,
  height = 120,
}: {
  points: TrendPoint[]
  format: (value: number) => string
  title: string
  height?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  if (points.length === 0) {
    return (
      <SizableText fontSize={13} color={MTD_TOKENS.textSubtle}>
        No days to show yet.
      </SizableText>
    )
  }

  const values = points.map((point) => point.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const zeroY = (max / range) * height
  const total = values.reduce((sum, value) => sum + value, 0)
  const peakIndex = values.indexOf(Math.max(...values))
  const lastIndex = points.length - 1
  const shownIndex = active ?? lastIndex
  const shown = points[shownIndex]!
  const description = `${title}: ${points.length} days from ${points[0]!.label} to ${
    points[lastIndex]!.label
  }. Total ${format(total)}. Highest ${format(values[peakIndex]!)} on ${
    points[peakIndex]!.label
  }. Latest ${format(values[lastIndex]!)}.`

  return (
    <YStack gap="$2">
      <XStack justify="space-between" items="baseline" gap="$3" flexWrap="wrap">
        <SizableText fontSize={13} color={MTD_TOKENS.text} fontWeight="600">
          {active == null ? 'Latest' : shown.label}
          {active == null ? ` (${shown.label})` : ''}: {format(shown.value)}
        </SizableText>
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
          Total {format(total)}
        </SizableText>
      </XStack>

      <YStack role="img" aria-label={description} gap="$1">
        <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
          {format(max)}
        </SizableText>
        <XStack
          height={height}
          gap={2}
          position="relative"
          onMouseLeave={() => setActive(null)}
        >
          <YStack
            position="absolute"
            l={0}
            r={0}
            t={zeroY}
            height={1}
            bg={MTD_TOKENS.textSubtle}
            opacity={0.5}
          />
          {points.map((point, index) => {
            const isActive = index === active
            const barHeight = Math.max((Math.abs(point.value) / range) * height, 1)
            const positive = point.value >= 0
            return (
              <YStack
                key={point.key}
                flex={1}
                maxW={BAR_MAX_WIDTH}
                height={height}
                position="relative"
                cursor="pointer"
                onMouseEnter={() => setActive(index)}
                onPress={() => setActive(isActive ? null : index)}
                aria-label={`${point.label}: ${format(point.value)}`}
              >
                <YStack
                  position="absolute"
                  l={0}
                  r={0}
                  t={positive ? zeroY - barHeight : zeroY}
                  height={barHeight}
                  bg={isActive ? BAR_ACTIVE : BAR_COLOR}
                  borderTopLeftRadius={positive ? 4 : 0}
                  borderTopRightRadius={positive ? 4 : 0}
                  borderBottomLeftRadius={positive ? 0 : 4}
                  borderBottomRightRadius={positive ? 0 : 4}
                />
              </YStack>
            )
          })}
        </XStack>
        {min < 0 ? (
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
            {format(min)}
          </SizableText>
        ) : null}
        <XStack justify="space-between">
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
            {points[0]!.label}
          </SizableText>
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
            {points[lastIndex]!.label}
          </SizableText>
        </XStack>
      </YStack>

      <SizableText
        fontSize={12}
        color={MTD_TOKENS.textMuted}
        cursor="pointer"
        self="flex-start"
        onPress={() => setShowTable((value) => !value)}
        aria-label={showTable ? 'Hide data table' : 'Show data table'}
      >
        {showTable ? 'Hide table' : 'Show as table'}
      </SizableText>
      {showTable ? (
        <YStack borderTopWidth={1} borderTopColor={MTD_TOKENS.cardBorder}>
          {points.map((point) => (
            <XStack
              key={point.key}
              justify="space-between"
              py="$1"
              borderBottomWidth={1}
              borderBottomColor={MTD_TOKENS.cardInset}
            >
              <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
                {point.label}
              </SizableText>
              <SizableText fontSize={12} color={MTD_TOKENS.text} fontFamily="$mono">
                {format(point.value)}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}
