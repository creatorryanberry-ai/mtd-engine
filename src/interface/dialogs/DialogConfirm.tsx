import { IS_WEB, useEmitterSelector } from '@mtd/helpers'
import { useState } from 'react'
import { SizableText, useMedia, useWindowDimensions, YStack } from 'tamagui'

import { Input } from '../forms/Input'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { WarningIcon } from '~/interface/icons/phosphor/WarningIcon'
import { confirmEmitter } from './actions'
import { Dialog } from './Dialog'
import { usesDialogBottomSheet } from './dialogSheet'
import { DialogPrimaryButton } from './DialogPrimaryButton'
import { DialogSecondaryButton } from './DialogSecondaryButton'
import { closeDialogLayer2, dialogLayer2Emitter } from './shared'

const WARNING_ICON_SIZE = 88

export const DialogConfirm = () => {
  const { width } = useWindowDimensions()
  const media = useMedia()
  const { brand } = useBrandTheme()
  const minW = IS_WEB ? 450 : width * 0.9
  const inlineActions = usesDialogBottomSheet(media)
  const [extraConfirm, setExtraConfirm] = useState('')
  const state = useEmitterSelector(dialogLayer2Emitter, (next) => {
    return next.type === 'confirm' ? next : null
  })

  const close = (accepted: boolean) => {
    confirmEmitter.emit(accepted)
    closeDialogLayer2()
  }

  const showWarningIcon = state?.icon === 'warning'

  return (
    <Dialog
      minH={state?.extraConfirm || showWarningIcon ? 280 : 160}
      minW={minW}
      open={!!state}
      onOpenChange={(open) => {
        if (open) return
        if (state) close(false)
      }}
    >
      <YStack pointerEvents="box-none" gap="$3" mb="$3" $md={{ flex: 1 }}>
        {showWarningIcon ? (
          <YStack items="center">
            <YStack items="center" gap="$2" width="100%">
              <SizableText
                fontSize={18}
                fontWeight="600"
                color={brand.colors.text}
                text="center"
                cursor="default"
                select="none"
              >
                {state?.title}
              </SizableText>
              {state?.description ? (
                <SizableText
                  fontSize={14}
                  color={brand.colors.textMuted}
                  lineHeight={24}
                  text="center"
                >
                  {state.description}
                </SizableText>
              ) : null}
            </YStack>

            <YStack mt={14} mb={60} items="center" justify="center" shrink={0}>
              <WarningIcon size={WARNING_ICON_SIZE} color={brand.colors.accent} />
            </YStack>
          </YStack>
        ) : (
          <Dialog.Header title={state?.title} description={state?.description} />
        )}

        {state?.extraConfirm && (
          <Input
            mt="$2"
            {...mtdInputProps}
            onChange={(e) => setExtraConfirm((e.target as HTMLInputElement).value)}
            placeholder='Type "Confirm" to confirm'
          />
        )}
      </YStack>

      <Dialog.Footer>
        <DialogSecondaryButton
          flex={inlineActions ? 1 : undefined}
          onPress={() => {
            close(false)
          }}
        >
          {state?.cancelText || 'Cancel'}
        </DialogSecondaryButton>

        <DialogPrimaryButton
          flex={inlineActions ? 1 : undefined}
          onPress={() => {
            if (state?.extraConfirm && extraConfirm !== 'Confirm') {
              return
            }
            close(true)
          }}
        >
          {state?.confirmText || 'Confirm'}
        </DialogPrimaryButton>
      </Dialog.Footer>
    </Dialog>
  )
}
