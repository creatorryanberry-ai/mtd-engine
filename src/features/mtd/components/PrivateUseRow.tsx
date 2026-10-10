import { useEffect, type Ref } from 'react'
import { type View } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Slider, SizableText, XStack, YStack } from 'tamagui'

import type { PrivateUseSuggestion } from '~/features/mtd/categories/privateUseSuggestions'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'

const PRIVATE_USE_FONT_SIZE = 16
const PRIVATE_USE_LINE_HEIGHT = 22
const PRIVATE_USE_ROW_HEIGHT = 40
const PRIVATE_USE_PERCENT_MIN = 1
const PRIVATE_USE_PERCENT_MAX = 99

function PrivateUseText({
  children,
  selected = false,
}: {
  children: string
  selected?: boolean
}) {
  return (
    <SizableText
      fontSize={PRIVATE_USE_FONT_SIZE}
      lineHeight={PRIVATE_USE_LINE_HEIGHT}
      fontWeight={selected ? '600' : '500'}
      color={selected ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
    >
      {children}
    </SizableText>
  )
}

function PrivateUseToggleButton({
  label,
  selected,
  onPress,
  emphasize = false,
  anchorRef,
}: {
  label: string
  selected: boolean
  onPress: () => void
  emphasize?: boolean
  anchorRef?: Ref<View>
}) {
  const colors = useMtdThemeColors()
  const showEmphasize = emphasize && !selected
  const pulse = useSharedValue(0)
  const idleBorderColor = selected ? colors.accent : colors.cardBorder

  useEffect(() => {
    if (!showEmphasize) {
      pulse.value = 0
      return
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
  }, [pulse, showEmphasize])

  const pulseBorderStyle = useAnimatedStyle(() => {
    if (!showEmphasize) {
      return {
        borderWidth: 1,
        borderColor: idleBorderColor,
        borderRadius: 10,
      }
    }

    return {
      borderWidth: 2,
      borderRadius: 10,
      borderColor: interpolateColor(
        pulse.value,
        [0, 1],
        [colors.accentMuted, colors.accent],
      ),
    }
  })

  return (
    <Animated.View ref={anchorRef} style={pulseBorderStyle}>
      <MtdAccentMutedBg
        accent={selected}
        row
        px="$3.5"
        height={PRIVATE_USE_ROW_HEIGHT}
        minW={64}
        rounded="$3"
        borderWidth={0}
        items="center"
        justify="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={onPress}
      >
        <PrivateUseText selected={selected || showEmphasize}>{label}</PrivateUseText>
      </MtdAccentMutedBg>
    </Animated.View>
  )
}

function parsePrivateUsePercent(value: string) {
  const parsed = Number.parseInt(value, 10)
  if (
    !Number.isFinite(parsed) ||
    parsed < PRIVATE_USE_PERCENT_MIN ||
    parsed > PRIVATE_USE_PERCENT_MAX
  ) {
    return 50
  }
  return parsed
}

type PrivateUseRowProps = {
  hasPrivateUse: boolean
  onHasPrivateUseChange: (value: boolean) => void
  privateUsePercent: string
  onPrivateUsePercentChange: (value: string) => void
  suggestion?: PrivateUseSuggestion | null
  yesButtonRef?: Ref<View>
  inset?: boolean
}

export function PrivateUseRow({
  hasPrivateUse,
  onHasPrivateUseChange,
  privateUsePercent,
  onPrivateUsePercentChange,
  suggestion = null,
  yesButtonRef,
  inset = true,
}: PrivateUseRowProps) {
  const showSuggestionHint = suggestion != null && !hasPrivateUse
  const percentValue = parsePrivateUsePercent(privateUsePercent)

  return (
    <YStack gap="$2" pl={inset ? '$3.5' : 0} mt={2} mb={hasPrivateUse ? 2 : 20}>
      <XStack gap="$3" items="center">
        <XStack height={PRIVATE_USE_ROW_HEIGHT} items="center" shrink={0}>
          <PrivateUseText>Private use?</PrivateUseText>
        </XStack>
        <XStack gap="$2" items="center" shrink={0} flexWrap="wrap">
          <PrivateUseToggleButton
            label="No"
            selected={!hasPrivateUse}
            onPress={() => {
              onHasPrivateUseChange(false)
              onPrivateUsePercentChange('')
            }}
          />
          <PrivateUseToggleButton
            label="Yes"
            selected={hasPrivateUse}
            emphasize={showSuggestionHint}
            anchorRef={yesButtonRef}
            onPress={() => {
              onHasPrivateUseChange(true)
              onPrivateUsePercentChange(
                suggestion?.percent != null ? String(suggestion.percent) : '50',
              )
            }}
          />
          {hasPrivateUse ? (
            <XStack
              items="center"
              height={PRIVATE_USE_ROW_HEIGHT}
              shrink={0}
              minW={48}
              justify="flex-end"
            >
              <PrivateUseText selected>{`${percentValue}%`}</PrivateUseText>
            </XStack>
          ) : null}
        </XStack>
      </XStack>

      {hasPrivateUse ? (
        <Slider
          size="$2"
          width="100%"
          mt={10}
          mb={30}
          min={PRIVATE_USE_PERCENT_MIN}
          max={PRIVATE_USE_PERCENT_MAX}
          step={1}
          value={[percentValue]}
          onValueChange={(values) => {
            const next = values[0]
            if (next == null) return
            onPrivateUsePercentChange(String(next))
          }}
        >
          <Slider.Track bg={MTD_TOKENS.cardInset} height={8} rounded={999}>
            <Slider.TrackActive bg={MTD_TOKENS.orange} />
          </Slider.Track>
          <Slider.Thumb
            index={0}
            circular
            size="$1"
            bg={MTD_TOKENS.orange}
            borderWidth={2}
            borderColor={MTD_TOKENS.background}
          />
        </Slider>
      ) : null}
    </YStack>
  )
}

export function getActivePrivateUsePercent(
  selectedCategory: string | null,
  hasPrivateUse: boolean,
  privateUsePercent: string,
) {
  const privateUsePercentValue = Number.parseInt(privateUsePercent, 10)
  if (
    selectedCategory !== 'business_expense' ||
    !hasPrivateUse ||
    privateUsePercentValue < 1 ||
    privateUsePercentValue > 99
  ) {
    return null
  }

  return privateUsePercentValue
}

export function isPrivateUseValid(
  selectedCategory: string | null,
  hasPrivateUse: boolean,
  privateUsePercent: string,
) {
  if (selectedCategory !== 'business_expense' || !hasPrivateUse) {
    return true
  }

  const privateUsePercentValue = Number.parseInt(privateUsePercent, 10)
  return privateUsePercentValue >= 1 && privateUsePercentValue <= 99
}
