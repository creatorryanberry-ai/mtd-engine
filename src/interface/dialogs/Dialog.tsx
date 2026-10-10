import { createGlobalContext, IS_WEB, useAsyncEffect } from '@mtd/helpers'
import { use, useRef } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  DialogDescription,
  ScrollView,
  Sheet,
  styled,
  Dialog as TamaguiDialog,
  VisuallyHidden,
  withStaticProperties,
  XStack,
  YStack,
  type DialogProps,
  type SizeTokens,
  type TamaguiElement,
} from 'tamagui'

import { useHandleEscapeIf } from '~/features/shortcuts/handleKeyboardEscape'
import { BrandThemeProvider, useBrandTheme } from '~/features/theme/BrandThemeProvider'

import { dialogEmit } from './shared'
import {
  getDialogAdaptWhen,
  getDialogSheetBottomLift,
  getDialogSheetFramePadding,
  getDialogSheetSnapPoint,
  useSheetOverlayArmed,
} from './dialogSheet'

const CONTENT_RADIUS: SizeTokens = '$9'

const DialogComponent = ({
  children,
  minH = 400,
  minW = 450,
  open,
  onOpenChange,
  ...props
}: DialogProps & { minH?: number; minW?: number }) => {
  const dialogContentRef = useRef<TamaguiElement>(null)
  const insets = useSafeAreaInsets()
  const overlayArmed = useSheetOverlayArmed(!!open)
  const handleOpenChange = (next: boolean) => {
    if (!next && !overlayArmed) return
    onOpenChange?.(next)
  }
  const { brand } = useBrandTheme()
  const dialogColors = {
    bg: brand.colors.card,
    border: brand.colors.cardBorder,
    text: brand.colors.text,
    textMuted: brand.colors.textMuted,
  }

  useHandleEscapeIf(!!open, () => {
    // TODO allow a throw AbortError that works with handleKeyboardEscape closeAllEscapables
    // if they are filling out a form it can show a confirm dialog and then cancel this
    // dialogEmit({ type: 'closed' })
  })

  // TODO this can move into above useHandleEscapeIf and no need for listener
  // just add helpers/browser isActiveElementFilledInput()
  useAsyncEffect(
    (signal) => {
      if (!IS_WEB || !open) return
      const node = dialogContentRef.current as HTMLElement | null
      if (!node || typeof node.addEventListener !== 'function') {
        return
      }
      node.addEventListener(
        'keyup',
        (e) => {
          if (e.code !== 'Escape') return
          if (
            !(
              e.target instanceof HTMLInputElement ||
              e.target instanceof HTMLTextAreaElement
            )
          )
            return
          if (e.target.value) return
          dialogEmit({ type: 'closed' })
        },
        {
          signal,
        },
      )
    },
    [open],
  )

  return (
    <DialogOpenContext.Provider value={!!open}>
      <TamaguiDialog modal open={open} onOpenChange={handleOpenChange} {...props}>
        <TamaguiDialog.Adapt platform="touch" when={getDialogAdaptWhen()}>
          <Sheet
            transition="quickLessBouncy"
            zIndex={250_000}
            modal
            snapPoints={[getDialogSheetSnapPoint(minH, insets.bottom)]}
            snapPointsMode="constant"
            dismissOnSnapToBottom={false}
            moveOnKeyboardChange
          >
            <Sheet.Overlay
              bg="rgba(0, 0, 0, 0.75)"
              transition="medium"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
              pointerEvents={overlayArmed ? 'auto' : 'none'}
              onPress={() => {
                handleOpenChange(false)
              }}
            />
            <BrandThemeProvider>
              <Sheet.Frame
                p="$4"
                pb={getDialogSheetFramePadding(insets.bottom)}
                mb={getDialogSheetBottomLift()}
                gap="$4"
                rounded="$6"
                borderBottomRightRadius={0}
                borderBottomLeftRadius={0}
                bg={dialogColors.bg}
                borderTopWidth={1}
                borderColor={dialogColors.border}
              >
                <Sheet.ScrollView
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="interactive"
                  showsVerticalScrollIndicator={false}
                >
                  <TamaguiDialog.Adapt.Contents />
                </Sheet.ScrollView>
              </Sheet.Frame>
            </BrandThemeProvider>
          </Sheet>
        </TamaguiDialog.Adapt>

        <TamaguiDialog.Portal z={500_000}>
          <BrandThemeProvider>
            <DialogOverlay
              key="overlay"
              bg="rgba(0, 0, 0, 0.75)"
              pointerEvents={overlayArmed ? 'auto' : 'none'}
              onPress={(e) => {
                handleOpenChange(false)
                e.stopPropagation()
                e.preventDefault()
              }}
            />

            <DialogContent
              ref={dialogContentRef}
              minH={minH}
              minW={minW}
              key="content"
              rounded={CONTENT_RADIUS}
              overflow="hidden"
              p="$3"
              bg={dialogColors.bg}
              borderColor={dialogColors.border}
            >
              {children}
            </DialogContent>
          </BrandThemeProvider>
        </TamaguiDialog.Portal>
      </TamaguiDialog>
    </DialogOpenContext.Provider>
  )
}

const DialogOverlay = styled(TamaguiDialog.Overlay, {
  transition: '200ms',
  opacity: 1,
  backdropFilter: 'blur(3px)',
  enterStyle: { opacity: 0 },
  exitStyle: { opacity: 0 },
})

const DialogContent = styled(TamaguiDialog.Content, {
  unstyled: true,
  z: 1000000,
  transition: '200ms',
  borderWidth: 1,
  rounded: CONTENT_RADIUS,
  position: 'relative',
  shadowColor: '#000',
  shadowRadius: 24,
  shadowOffset: { height: 12, width: 0 },
  shadowOpacity: 0.4,
  maxH: '90vh',
  width: '60%',
  minW: 200,
  maxW: 500,
  p: '$4',
  opacity: 1,
  y: 0,
  enterStyle: { x: 0, y: -5, opacity: 0, scale: 0.985 },
  exitStyle: { x: 0, y: 5, opacity: 0 },

  focusStyle: {
    outlineWidth: 0,
  },
})

const DialogTitle = styled(TamaguiDialog.Title, {
  fontFamily: '$heading',
  size: '$5',
})

const DialogHeader = ({
  title,
  description,
  hidden,
}: {
  hidden?: boolean
  title?: string
  description?: string
}) => {
  const { brand } = useBrandTheme()
  const text = brand.colors.text
  const textMuted = brand.colors.textMuted

  const content = (
    <YStack pointerEvents="box-none" gap="$3">
      <DialogTitle size="$5" fontWeight="600" cursor="default" select="none" color={text}>
        {title}
      </DialogTitle>
      {!!description && (
        <DialogDescription size="$4" color={textMuted} lineHeight={20}>
          {description}
        </DialogDescription>
      )}
    </YStack>
  )

  if (hidden) {
    return <VisuallyHidden>{content}</VisuallyHidden>
  }

  return content
}

const DialogFooter = ({ children }: { children: any }) => {
  return (
    <XStack justify="flex-end" gap="$2" width="100%">
      {children}
    </XStack>
  )
}

const DialogBody = (props: { children: any; scrollable?: boolean }) => {
  const content = (
    <YStack flex={1} gap="$2" px="$1" pb="$3">
      {props.children}
    </YStack>
  )

  if (props.scrollable) {
    return (
      <ScrollView m="$-1">
        <YStack gap="$2" px="$1">
          {content}
        </YStack>
      </ScrollView>
    )
  }

  return content
}

export const Dialog = withStaticProperties(DialogComponent, {
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: TamaguiDialog.Close,
})

const DialogOpenContext = createGlobalContext('dialog/open-context', false)
export const useDialogOpen = () => use(DialogOpenContext)
