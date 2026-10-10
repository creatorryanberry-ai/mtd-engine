import { Link, router } from 'one'

import type { Href } from 'one'
import type { ReactNode } from 'react'
import { isWeb, XStack, YStack, SizableText } from 'tamagui'

import { openSettings } from '~/features/mtd/mtdNavigationSession'
import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { Pressable } from '~/interface/buttons/Pressable'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { QuestionIcon } from '~/interface/icons/phosphor/QuestionIcon'
import { CuratorLogo } from './CuratorLogo'
import { useDetailSlideRequestClose } from './DetailSlideLayout'

type MtdDetailHeaderProps = {
  backHref?: (typeof MTD_ROUTES)[keyof typeof MTD_ROUTES]
  title?: string
  titleFontSize?: number
  rightActions?: ReactNode
  onBack?: () => void
  hideBack?: boolean
  /** nested routes should not dismiss the parent slide */
  skipSlideClose?: boolean
}

function HeaderBackButton({
  backHref,
  onBack,
  skipSlideClose,
}: {
  backHref: Href | string
  onBack?: () => void
  skipSlideClose?: boolean
}) {
  const requestClose = useDetailSlideRequestClose()

  const icon = (
    <YStack
      width={36}
      height={36}
      rounded="$10"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      items="center"
      justify="center"
    >
      <CaretLeftIcon size={20} color={MTD_TOKENS.text} />
    </YStack>
  )

  const navigateBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (!isWeb && router.canGoBack()) {
      router.back()
      return
    }
    router.replace(backHref as Href)
  }

  const handleBack = () => {
    if (requestClose && !skipSlideClose) {
      requestClose(navigateBack)
      return
    }
    navigateBack()
  }

  if (onBack || requestClose || !isWeb) {
    return (
      <Pressable aria-label="Go back" onPress={handleBack} cursor="pointer">
        {icon}
      </Pressable>
    )
  }

  return (
    <Link href={backHref as any} aria-label="Go back" asChild>
      <Pressable cursor="pointer" pressStyle={{ opacity: 0.85 }}>
        {icon}
      </Pressable>
    </Link>
  )
}

export function MtdDetailHeader({
  backHref = '/home/feed',
  title,
  titleFontSize = 18,
  rightActions,
  onBack,
  hideBack = false,
  skipSlideClose = false,
}: MtdDetailHeaderProps) {
  return (
    <XStack
      px="$4"
      py="$3"
      items="center"
      justify="space-between"
      bg={MTD_TOKENS.background}
    >
      {hideBack ? (
        <YStack width={36} height={36} />
      ) : (
        <HeaderBackButton
          backHref={backHref}
          onBack={onBack}
          skipSlideClose={skipSlideClose}
        />
      )}

      {title ? (
        <SizableText
          fontSize={titleFontSize}
          fontWeight="600"
          color={MTD_TOKENS.text}
          numberOfLines={1}
          flex={1}
          text="center"
          px="$2"
        >
          {title}
        </SizableText>
      ) : (
        <CuratorLogo />
      )}

      {rightActions ?? (
        <Pressable
          aria-label="Help"
          onPress={() => openSettings((href) => router.push(href as Href))}
          cursor="pointer"
        >
          <YStack
            width={36}
            height={36}
            rounded="$10"
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            items="center"
            justify="center"
          >
            <QuestionIcon size={20} color={MTD_TOKENS.text} />
          </YStack>
        </Pressable>
      )}
    </XStack>
  )
}
