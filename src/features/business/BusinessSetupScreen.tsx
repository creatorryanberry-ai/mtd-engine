import { router, useBlocker } from 'one'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Keyboard, Pressable as RNPressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, Spinner, useMedia, XStack, YStack } from 'tamagui'

import { useLogout } from '~/features/auth/useLogout'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { useHmrcConnection } from '~/features/hmrc/client/useHmrcConnection'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdRadioGroup } from '~/features/mtd/components/MtdRadioGroup'
import { MtdRadioOption } from '~/features/mtd/components/MtdRadioOption'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { Dialog } from '~/interface/dialogs/Dialog'
import { usesDialogBottomSheet } from '~/interface/dialogs/dialogSheet'
import { DialogPrimaryButton } from '~/interface/dialogs/DialogPrimaryButton'
import { DialogSecondaryButton } from '~/interface/dialogs/DialogSecondaryButton'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { Input } from '~/interface/forms/Input'
import { KeyboardAwareScrollView } from '~/interface/keyboard/KeyboardAwareScrollView'
import { KeyboardStickyFooter } from '~/interface/keyboard/KeyboardStickyFooter'
import { showToast } from '~/interface/toast/helpers'

import type { BusinessSettingsPatch } from '~/features/business/businessSettingsValidation'

type BusinessType = 'self-employed' | 'landlord'
type VehicleClaimMethod = 'mileage' | 'actual'

type BusinessSetupScreenProps = {
  mode: 'onboarding' | 'settings'
}

const FORM_FONT_SIZE = 15
const FORM_LINE_HEIGHT = 20

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5">
      <SizableText
        fontSize={FORM_FONT_SIZE}
        fontWeight="600"
        color={MTD_TOKENS.orange}
        textTransform="uppercase"
        letterSpacing={0.8}
        px="$1"
      >
        {title}
      </SizableText>
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        p="$4"
        gap="$4"
      >
        {children}
      </YStack>
    </YStack>
  )
}

function FieldLabel({ children }: { children: string }) {
  return (
    <SizableText
      fontSize={FORM_FONT_SIZE}
      fontWeight="600"
      color={MTD_TOKENS.textMuted}
      lineHeight={FORM_LINE_HEIGHT}
    >
      {children}
    </SizableText>
  )
}

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
    <MtdActionButton
      width="100%"
      size="large"
      disabled={disabled}
      onPress={onPress}
      testID="business-setup-submit"
    >
      {label}
    </MtdActionButton>
  )
}

function OnboardingSignOutBar({ onPress }: { onPress: () => void }) {
  return (
    <XStack justify="flex-end" px="$4" pt="$2" pb="$1" $lg={{ px: '$6' }}>
      <RNPressable
        onPress={onPress}
        hitSlop={20}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        testID="business-setup-sign-out"
        style={({ pressed }) => ({
          paddingVertical: 10,
          paddingHorizontal: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SizableText
          fontSize={FORM_FONT_SIZE}
          fontWeight="600"
          color={MTD_TOKENS.textMuted}
          pointerEvents="none"
        >
          Sign out
        </SizableText>
      </RNPressable>
    </XStack>
  )
}

export function BusinessSetupScreen({ mode }: BusinessSetupScreenProps) {
  const insets = useSafeAreaInsets()
  const media = useMedia()
  const inlineActions = usesDialogBottomSheet(media)
  const { settings, isLoading, save, isSaving } = useBusinessSettings()
  const { status: hmrcStatus } = useHmrcConnection()
  const { logout } = useLogout()

  const [businessName, setBusinessName] = useState('')
  const [businessStartDate, setBusinessStartDate] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [cisRegistered, setCisRegistered] = useState<boolean | null>(null)
  const [vehicleClaimMethod, setVehicleClaimMethod] = useState<VehicleClaimMethod | null>(
    null,
  )
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (isLoading || initialized) return

    setBusinessName(settings?.businessName ?? hmrcStatus.businessName ?? '')
    setBusinessStartDate(settings?.businessStartDate ?? '')
    setBusinessDescription(settings?.businessDescription ?? '')
    setBusinessType(settings?.businessType ?? null)
    setCisRegistered(settings?.cisRegistered ?? null)
    setVehicleClaimMethod(settings?.vehicleClaimMethod ?? null)
    setInitialized(true)
  }, [hmrcStatus.businessName, initialized, isLoading, settings])

  const savedSnapshot = useMemo(
    () =>
      JSON.stringify({
        businessName: settings?.businessName ?? hmrcStatus.businessName ?? '',
        businessStartDate: settings?.businessStartDate ?? '',
        businessDescription: settings?.businessDescription ?? '',
        businessType: settings?.businessType ?? null,
        cisRegistered: settings?.cisRegistered ?? null,
        vehicleClaimMethod: settings?.vehicleClaimMethod ?? null,
      }),
    [hmrcStatus.businessName, settings],
  )

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        businessName,
        businessStartDate,
        businessDescription,
        businessType,
        cisRegistered: businessType === 'self-employed' ? cisRegistered : null,
        vehicleClaimMethod,
      }),
    [
      businessDescription,
      businessName,
      businessStartDate,
      businessType,
      cisRegistered,
      vehicleClaimMethod,
    ],
  )

  const hasUnsavedChanges = mode === 'settings' && savedSnapshot !== currentSnapshot

  const canSave =
    businessName.trim().length > 0 &&
    businessStartDate.trim().length > 0 &&
    businessDescription.trim().length > 0 &&
    businessType !== null &&
    vehicleClaimMethod !== null &&
    (businessType !== 'self-employed' || typeof cisRegistered === 'boolean') &&
    !isSaving

  const blocker = useBlocker(mode === 'settings' && !isSaving && hasUnsavedChanges)

  const handleDiscard = () => {
    const destination = blocker.location as Parameters<typeof router.push>[0]
    blocker.proceed?.()
    if (isWeb && destination) {
      router.push(destination)
    } else {
      router.back()
    }
  }

  const handleSave = async () => {
    if (!canSave || !businessType || !vehicleClaimMethod) return

    Keyboard.dismiss()

    const patch: BusinessSettingsPatch = {
      businessName: businessName.trim(),
      businessStartDate: businessStartDate.trim(),
      businessDescription: businessDescription.trim(),
      businessType,
      cisRegistered: businessType === 'self-employed' ? cisRegistered : null,
      vehicleClaimMethod,
    }

    try {
      await save(patch)
      showToast(mode === 'onboarding' ? 'Setup complete' : 'Business settings saved', {
        type: 'success',
      })

      if (mode === 'onboarding') {
        router.replace(MTD_ROUTES.overview)
        return
      }

      router.back()
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to save business settings',
        {
          type: 'error',
        },
      )
    }
  }

  const handleBusinessTypeChange = (next: BusinessType) => {
    setBusinessType(next)
    if (next === 'landlord') {
      setCisRegistered(null)
    }
  }

  const title = mode === 'onboarding' ? 'Set up your business' : 'Business setup'
  const subtitle =
    mode === 'onboarding'
      ? 'Tell us about your business so we can tailor your tax experience.'
      : 'Update your business details and expense preferences.'
  const actionLabel = mode === 'onboarding' ? 'Continue' : isSaving ? 'Saving...' : 'Save'

  const form = (
    <YStack gap="$5" width="100%" maxW={480} self="center" select="none">
      <YStack gap="$1">
        {mode === 'onboarding' ? (
          <SizableText
            fontSize={19}
            fontWeight="700"
            color={MTD_TOKENS.text}
            lineHeight={24}
          >
            {title}
          </SizableText>
        ) : null}
        <SizableText
          fontSize={FORM_FONT_SIZE}
          color={MTD_TOKENS.textMuted}
          lineHeight={FORM_LINE_HEIGHT}
        >
          {subtitle}
        </SizableText>
      </YStack>

      {isLoading && !initialized ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : (
        <YStack gap="$5">
          <FormSection title="Business">
            <YStack gap="$2">
              <FieldLabel>Business name</FieldLabel>
              <Input
                width="100%"
                placeholder="Your business name"
                value={businessName}
                onChangeText={setBusinessName}
                autoCapitalize="words"
                fontSize={FORM_FONT_SIZE}
                testID="business-setup-name"
                {...mtdInputProps}
              />
            </YStack>

            <YStack gap="$2">
              <FieldLabel>Business start date</FieldLabel>
              <MtdDatePicker
                value={businessStartDate}
                onChange={setBusinessStartDate}
                placeholder="DD/MM/YYYY"
                testID="business-setup-start-date"
              />
            </YStack>

            <YStack gap="$2">
              <FieldLabel>What do you do?</FieldLabel>
              <Input
                width="100%"
                placeholder="Describe your business activity"
                value={businessDescription}
                onChangeText={setBusinessDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                height={100}
                fontSize={FORM_FONT_SIZE}
                testID="business-setup-description"
                {...mtdInputProps}
              />
            </YStack>

            <YStack gap="$2">
              <FieldLabel>Are you self-employed or a landlord?</FieldLabel>
              <MtdRadioGroup>
                <MtdRadioOption
                  label="Self-employed"
                  selected={businessType === 'self-employed'}
                  onPress={() => handleBusinessTypeChange('self-employed')}
                />
                <MtdRadioOption
                  label="Landlord"
                  selected={businessType === 'landlord'}
                  onPress={() => handleBusinessTypeChange('landlord')}
                />
              </MtdRadioGroup>
            </YStack>
          </FormSection>

          {businessType === 'self-employed' ? (
            <FormSection title="CIS (if applicable)">
              <YStack gap="$2">
                <FieldLabel>Are you registered for CIS?</FieldLabel>
                <MtdRadioGroup>
                  <MtdRadioOption
                    label="Yes"
                    selected={cisRegistered === true}
                    onPress={() => setCisRegistered(true)}
                  />
                  <MtdRadioOption
                    label="No"
                    selected={cisRegistered === false}
                    onPress={() => setCisRegistered(false)}
                  />
                </MtdRadioGroup>
              </YStack>
            </FormSection>
          ) : null}

          <FormSection title="Vehicle expenses">
            <YStack gap="$2">
              <FieldLabel>How will you claim vehicle costs?</FieldLabel>
              <MtdRadioGroup>
                <MtdRadioOption
                  label="Mileage"
                  selected={vehicleClaimMethod === 'mileage'}
                  onPress={() => setVehicleClaimMethod('mileage')}
                />
                <MtdRadioOption
                  label="Actual vehicle costs"
                  selected={vehicleClaimMethod === 'actual'}
                  onPress={() => setVehicleClaimMethod('actual')}
                />
              </MtdRadioGroup>
            </YStack>
          </FormSection>

          {(isWeb || mode === 'settings') && (!isLoading || initialized) ? (
            <SaveButton
              onPress={() => void handleSave()}
              disabled={!canSave}
              label={actionLabel}
            />
          ) : null}
        </YStack>
      )}
    </YStack>
  )

  const bottomPadding =
    mode === 'onboarding' ? insets.bottom + 24 : insets.bottom + MTD_TAB_BAR_HEIGHT + 24

  const scrollContent = (
    <YStack
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : bottomPadding}
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
          <DialogSecondaryButton
            flex={inlineActions ? 1 : undefined}
            onPress={() => blocker.reset?.()}
          >
            Stay
          </DialogSecondaryButton>
          <DialogPrimaryButton
            flex={inlineActions ? 1 : undefined}
            onPress={handleDiscard}
          >
            Discard
          </DialogPrimaryButton>
        </Dialog.Footer>
      </Dialog>

      {isWeb ? (
        <YStack flex={1} minH={0} overflow="scroll">
          {mode === 'onboarding' ? (
            <OnboardingSignOutBar onPress={() => void logout()} />
          ) : null}
          {scrollContent}
        </YStack>
      ) : (
        <>
          {mode === 'onboarding' ? (
            <OnboardingSignOutBar onPress={() => void logout()} />
          ) : null}
          <YStack flex={1}>
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              bottomOffset={100}
              keyboardShouldPersistTaps="always"
              contentInsetAdjustmentBehavior="automatic"
            >
              {scrollContent}
            </KeyboardAwareScrollView>
          </YStack>

          {mode === 'onboarding' && (!isLoading || initialized) ? (
            <KeyboardStickyFooter>
              <SaveButton
                onPress={() => void handleSave()}
                disabled={!canSave}
                label={actionLabel}
              />
            </KeyboardStickyFooter>
          ) : null}
        </>
      )}
    </>
  )
}
