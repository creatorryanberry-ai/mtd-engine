import { router, useBlocker } from 'one'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, Spinner, View, XStack, YStack } from 'tamagui'

import { useProfileEdit } from '~/features/user/useProfileEdit'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { Dialog } from '~/interface/dialogs/Dialog'
import { DialogPrimaryButton } from '~/interface/dialogs/DialogPrimaryButton'
import { DialogSecondaryButton } from '~/interface/dialogs/DialogSecondaryButton'
import { Input } from '~/interface/forms/Input'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { KeyboardAwareScrollView } from '~/interface/keyboard/KeyboardAwareScrollView'
import { KeyboardStickyFooter } from '~/interface/keyboard/KeyboardStickyFooter'
import { AvatarUpload } from '~/interface/upload/AvatarUpload'

function SaveButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void
  disabled: boolean
  label: string
}) {
  return (
    <MtdActionButton width="100%" size="large" disabled={disabled} onPress={onPress}>
      {label}
    </MtdActionButton>
  )
}

export const ProfileEditPage = () => {
  const insets = useSafeAreaInsets()
  const {
    user,
    username,
    name,
    isSaving,
    isCheckingAvailability,
    isAvailable,
    isUnavailable,
    isUsernameInvalid,
    hasUnsavedChanges,
    canSave,
    debouncedUsername,
    handleAvatarUpload,
    handleSave: saveProfile,
    handleNameChange,
    handleUsernameChange,
  } = useProfileEdit()

  const handleSave = async () => {
    Keyboard.dismiss()
    await saveProfile()
  }

  const blocker = useBlocker(!isSaving && hasUnsavedChanges)

  const handleDiscard = () => {
    const destination = blocker.location as any
    blocker.proceed?.()
    if (isWeb && destination) {
      router.push(destination)
    } else {
      router.back()
    }
  }

  const form = (
    <YStack gap="$5" width="100%" maxW={480} self="center" select="none">
      <YStack gap="$1">
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          Update your name and username
        </SizableText>
      </YStack>

      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        p="$4"
        gap="$4"
      >
        <YStack items="center" py="$2">
          <AvatarUpload
            id="avatar"
            dropActive={false}
            originalImage={user?.image || undefined}
            currentImage={user?.image || undefined}
            onChangeImage={handleAvatarUpload}
          />
        </YStack>

        <YStack gap="$2">
          <XStack justify="space-between" items="center">
            <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
              Name
            </SizableText>
            <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
              {name.length}/40
            </SizableText>
          </XStack>
          <Input
            width="100%"
            placeholder="Your name"
            value={name}
            onChangeText={handleNameChange}
            autoCapitalize="words"
            autoCorrect="off"
            {...mtdInputProps}
          />
        </YStack>

        <YStack gap="$2">
          <XStack justify="space-between" items="center">
            <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
              Username
            </SizableText>
            <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
              {username.length}/30
            </SizableText>
          </XStack>
          <View position="relative" justify="center">
            <Input
              width="100%"
              placeholder="johndoe"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect="off"
              pr="$10"
              {...mtdInputProps}
            />
            <XStack position="absolute" r="$4">
              {isCheckingAvailability ? (
                <Spinner size="small" color={MTD_TOKENS.orange} />
              ) : isUsernameInvalid || isUnavailable ? (
                <XIcon size={18} color="$red10" />
              ) : isAvailable && debouncedUsername ? (
                <CheckIcon size={18} color="$green10" />
              ) : null}
            </XStack>
          </View>
          {isUnavailable && !isCheckingAvailability ? (
            <SizableText fontSize={12} color={MTD_TOKENS.orange}>
              Username is not available
            </SizableText>
          ) : isUsernameInvalid ? (
            <SizableText fontSize={12} color={MTD_TOKENS.orange}>
              Must be 3+ chars, start with letter, only letters/numbers/_
            </SizableText>
          ) : null}
        </YStack>

        {isWeb && (
          <SaveButton
            onPress={() => void handleSave()}
            disabled={!canSave}
            label={isSaving ? 'Saving...' : 'Save'}
          />
        )}
      </YStack>
    </YStack>
  )

  const scrollContent = (
    <YStack
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      $lg={{ px: '$6', pt: '$6' }}
    >
      {form}
    </YStack>
  )

  return (
    <>
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        minH={200}
      >
        <Dialog.Header
          title="Discard changes?"
          description="You have unsaved changes. Are you sure you want to discard them?"
        />
        <Dialog.Footer>
          <DialogSecondaryButton onPress={() => blocker.reset?.()}>
            Stay
          </DialogSecondaryButton>
          <DialogPrimaryButton onPress={handleDiscard}>Discard</DialogPrimaryButton>
        </Dialog.Footer>
      </Dialog>

      {isWeb ? (
        <YStack flex={1} minH={0} overflow="scroll">
          {scrollContent}
        </YStack>
      ) : (
        <>
          <YStack flex={1}>
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              bottomOffset={100}
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
            >
              {scrollContent}
            </KeyboardAwareScrollView>
          </YStack>

          <KeyboardStickyFooter>
            <SaveButton
              onPress={() => void handleSave()}
              disabled={!canSave}
              label={isSaving ? 'Saving...' : 'Save'}
            />
          </KeyboardStickyFooter>
        </>
      )}
    </>
  )
}
