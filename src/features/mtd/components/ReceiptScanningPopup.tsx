import { useEffect } from 'react'
import { Modal, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { MagnifyingGlassIcon } from '~/interface/icons/phosphor/MagnifyingGlassIcon'

type ReceiptScanningPopupProps = {
  visible: boolean
}

export function ReceiptScanningPopup({ visible }: ReceiptScanningPopupProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!visible) {
      progress.value = 0
      return
    }

    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
  }, [visible, progress])

  const glassStyle = useAnimatedStyle(() => {
    const t = progress.value
    return {
      transform: [
        { translateX: -14 + t * 28 },
        { translateY: -10 + t * 20 },
        { rotate: `${-12 + t * 24}deg` },
        { scale: 0.92 + t * 0.16 },
      ],
    }
  })

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BrandThemeProvider>
        <YStack flex={1} items="center" justify="center" style={styles.backdrop}>
          <YStack
            width={220}
            items="center"
            gap="$4"
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$6"
            px="$5"
            py="$6"
          >
            <YStack width={72} height={72} items="center" justify="center">
              <Animated.View style={glassStyle}>
                <MagnifyingGlassIcon size={48} color={MTD_TOKENS.orange} />
              </Animated.View>
            </YStack>
            <YStack gap="$1.5" items="center">
              <SizableText fontSize={17} fontWeight="600" color={MTD_TOKENS.text}>
                Scanning
              </SizableText>
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted} text="center">
                Reading receipt details…
              </SizableText>
            </YStack>
          </YStack>
        </YStack>
      </BrandThemeProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
})
