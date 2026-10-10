import { router, Slot, usePathname } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, YStack } from 'tamagui'

import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { SlideFromBottomScreen } from '~/features/mtd/components/SlideFromBottomScreen'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import {
  getSettingsBackHref,
  getSettingsTitle,
} from '~/features/mtd/settingsLayoutHelpers'
import { Pressable } from '~/interface/buttons/Pressable'
import { XIcon } from '~/interface/icons/phosphor/XIcon'

import type { Href } from 'one'

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable aria-label="Close" onPress={onPress} cursor="pointer">
      <YStack
        width={36}
        height={36}
        rounded="$10"
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        items="center"
        justify="center"
        pressStyle={{ opacity: 0.85 }}
      >
        <XIcon size={18} color={MTD_TOKENS.text} />
      </YStack>
    </Pressable>
  )
}

export const SettingLayout = () => {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const backHref = getSettingsBackHref(pathname)
  const title = getSettingsTitle(pathname)
  const isRootSettings = backHref === MTD_ROUTES.overview

  return (
    <SlideFromBottomScreen>
      {(requestClose) => {
        const handleClose = () => {
          requestClose(() => {
            if (!isWeb && router.canGoBack()) {
              router.back()
              return
            }
            router.replace(backHref as Href)
          })
        }

        return (
          <YStack flex={1} bg={MTD_TOKENS.background}>
            <YStack pt={isWeb ? 0 : insets.top}>
              <MtdDetailHeader
                backHref={backHref}
                title={title}
                hideBack={isRootSettings}
                rightActions={
                  isRootSettings ? (
                    <CloseButton onPress={handleClose} />
                  ) : (
                    <YStack width={36} height={36} />
                  )
                }
              />
            </YStack>
            <YStack flex={1} minH={0}>
              <Slot />
            </YStack>
          </YStack>
        )
      }}
    </SlideFromBottomScreen>
  )
}
