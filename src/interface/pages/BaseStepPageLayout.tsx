import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EnsureFlexed, isWeb, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { GradientBackground } from '../backgrounds/GradientBackground'

import type { ReactNode } from 'react'

export const BaseStepPageLayout = ({
  children,
  bottom: bottomElement,
  header,
  disableScroll = true,
  disableKeyboardAvoidingView = false,
  hideBackButton = false,
  keyboardOffset = 0,
}: {
  children: ReactNode
  bottom?: ReactNode
  header?: ReactNode
  disableScroll?: boolean
  disableKeyboardAvoidingView?: boolean
  hideBackButton?: boolean
  keyboardOffset?: number
}) => {
  const { top, bottom } = useSafeAreaInsets()

  const content = (
    <>
      {isWeb ? (
        <YStack flex={1} p="$5">
          <YStack width="100%" maxW={400}>
            {children}
            {bottomElement}
          </YStack>
        </YStack>
      ) : (
        <GradientBackground androidHeaderOffset={false}>
          {header}
          <ScrollView
            scrollEnabled={!disableScroll}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <YStack
              minW="100%"
              flex={1}
              pt={header ? 12 : hideBackButton ? 0 : top + 24}
              rounded="$6"
            >
              <YStack maxW={600} self="center" px={14} flex={1}>
                {children}
                <EnsureFlexed />
              </YStack>
            </YStack>
          </ScrollView>
        </GradientBackground>
      )}

      {!isWeb && bottomElement && (
        <YStack position="absolute" b={0} l={0} r={0} z={999}>
          {bottomElement}
        </YStack>
      )}
    </>
  )

  const frame = (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      {content}
    </YStack>
  )

  // sticky footers handle the keyboard; avoiding view would double-shift the layout
  if (disableKeyboardAvoidingView || bottomElement) {
    return frame
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={
        keyboardOffset !== 0 ? keyboardOffset : bottom > 30 ? -24 : 0
      }
      style={{ flex: 1 }}
    >
      {frame}
    </KeyboardAvoidingView>
  )
}
