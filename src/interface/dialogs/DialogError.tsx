import { useEmitterSelector } from '@mtd/helpers'
import { isWeb, useWindowDimensions, YStack } from 'tamagui'

import { DialogPrimaryButton } from './DialogPrimaryButton'
import { Dialog } from './Dialog'
import { closeDialogLayer2, dialogLayer2Emitter } from './shared'

export const DialogError = () => {
  const { width } = useWindowDimensions()
  const minW = isWeb ? 450 : width * 0.9
  const state = useEmitterSelector(dialogLayer2Emitter, (next) => {
    return next.type === 'error' ? next : null
  })

  const close = () => {
    closeDialogLayer2()
  }

  const descriptionLength = state?.description?.length || 0
  const minHeight = descriptionLength > 100 ? 240 : 200

  return (
    <Dialog
      minH={minHeight}
      minW={minW}
      open={!!state}
      onOpenChange={(open) => {
        if (open) return
        if (state) close()
      }}
    >
      <YStack pointerEvents="box-none" gap="$3" $md={{ flex: 1 }}>
        <Dialog.Header title={state?.title} description={state?.description} />
      </YStack>

      <Dialog.Footer>
        <DialogPrimaryButton onPress={close}>
          {state?.dismissText || 'OK'}
        </DialogPrimaryButton>
      </Dialog.Footer>
    </Dialog>
  )
}
