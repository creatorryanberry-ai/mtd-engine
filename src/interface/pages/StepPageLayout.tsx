import { router, type Href } from 'one'
import { Circle, H5, isWeb, Spacer, XStack, YStack } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useIsMtdTheme } from '~/features/theme/useIsMtdTheme'

import { Button } from '../buttons/Button'
import { CaretLeftIcon } from '../icons/phosphor/CaretLeftIcon'
import { PageHeading } from '../text/PageHeading'
import { BaseStepPageLayout } from './BaseStepPageLayout'

import type { IconComponent } from '../icons/types'
import type { ReactNode } from 'react'

export type StepPageProps = {
  title: string
  description?: string
  descriptionSecondLine?: string
  headerTitle?: string
  Icon?: IconComponent
  IconGroup?: ReactNode
  children: ReactNode
  bottom?: ReactNode
  buttonRight?: ReactNode
  disableBackButton?: boolean
  hideBackButton?: boolean
  /** fallback when native history is empty (auth uses Slot, not a nested Stack) */
  backHref?: Href | string
  disableScroll?: boolean
  linearGradientFooter?: boolean
  disableKeyboardAvoidingView?: boolean
  keyboardOffset?: number
}

function goBackOrReplace(backHref?: Href | string) {
  if (router.canGoBack()) {
    router.back()
    return
  }
  if (backHref) {
    router.replace(backHref as Href)
  }
}

export const StepPageLayout = ({
  title,
  description,
  descriptionSecondLine,
  headerTitle,
  Icon,
  IconGroup,
  children,
  bottom,
  buttonRight,
  disableBackButton = false,
  hideBackButton = false,
  backHref,
  disableScroll = false,
  disableKeyboardAvoidingView = false,
  keyboardOffset = 0,
}: StepPageProps) => {
  const isMtd = useIsMtdTheme()
  const { top } = useSafeAreaInsets()
  const showNativeBack = !hideBackButton && !isWeb

  const nativeHeader = showNativeBack ? (
    <XStack pt={top + 8} px={14} pb="$2" items="center" justify="space-between">
      <Button
        size="large"
        glass
        circular
        onPress={() => goBackOrReplace(backHref)}
        icon={<CaretLeftIcon size={22} color="$color12" />}
        disabled={disableBackButton}
        testID="step-page-back"
        aria-label="Go back"
      />
      {headerTitle && (
        <H5 fontFamily="$heading" color="$color12">
          {headerTitle}
        </H5>
      )}
      {buttonRight ? buttonRight : <Spacer width={42} />}
    </XStack>
  ) : null

  return (
    <BaseStepPageLayout
      bottom={bottom}
      header={nativeHeader}
      disableScroll={disableScroll}
      disableKeyboardAvoidingView={disableKeyboardAvoidingView}
      hideBackButton={hideBackButton || showNativeBack}
      keyboardOffset={keyboardOffset}
    >
      <YStack gap="$4">
        <YStack gap="$4" mt="$2" items="center">
          {Icon && (
            <Circle
              size={52}
              bg={isMtd ? MTD_TOKENS.orangeMuted : '$color2'}
              shadowColor={isMtd ? undefined : '$color12'}
              shadowOpacity={isMtd ? undefined : 0.1}
              shadowRadius={isMtd ? undefined : 12}
              borderWidth={0.5}
              borderColor={isMtd ? '$color9' : '$color3'}
              items="center"
              justify="center"
            >
              <Icon size={28} color={isMtd ? '$orange10' : '$color11'} />
            </Circle>
          )}

          {IconGroup}

          <PageHeading
            title={title}
            subTitle={description}
            subTitle2={descriptionSecondLine}
          />
        </YStack>
      </YStack>

      <YStack pt="$4" gap="$4">
        {children}
      </YStack>
    </BaseStepPageLayout>
  )
}
