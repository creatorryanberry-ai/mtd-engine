import { useTimer } from '@mtd/helpers'
import { Redirect, useParams } from 'one'
import { useEffect, useRef, useState } from 'react'
import { Pressable as RNPressable } from 'react-native'
import { SizableText, useEvent, YStack } from 'tamagui'

import { otpLogin, validateLoginOtpCode } from '~/features/auth/client/otpLogin'
import { shouldAutoVerifyOtp } from '~/features/auth/client/otpSubmit'
import {
  clearPendingOtpChallenge,
  loadPendingOtpChallenge,
} from '~/features/auth/client/pendingOtpChallenge'
import { OtpInput } from '~/features/auth/ui/OtpInput'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { showError } from '~/interface/dialogs/actions'
import { PasswordIcon } from '~/interface/icons/phosphor/PasswordIcon'
import { dismissKeyboard } from '~/interface/keyboard/dismissKeyboard'
import { KeyboardStickyFooter } from '~/interface/keyboard/KeyboardStickyFooter'
import { StepPageLayout } from '~/interface/pages/StepPageLayout'

function resolveOtpChallenge(params: { method?: 'email'; value?: string }) {
  if (params.method === 'email' && params.value) {
    return { method: 'email' as const, value: params.value }
  }

  const pending = loadPendingOtpChallenge()
  if (!pending) return null
  if (params.method && pending.method !== params.method) return null
  return pending
}

export const OtpPage = () => {
  const { start: startTimer, pause: pauseTimer, count: timerCount } = useTimer()
  const params = useParams<{ method?: 'email'; value?: string }>()
  const challenge = resolveOtpChallenge(params)
  const [otpCode, setOtpCode] = useState('')
  const [isError, setIsError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [otpKey, setOtpKey] = useState(0)
  const skipAutoVerifyRef = useRef(false)

  const isDisabled = otpCode.length !== 6 || verifying || resending

  const handleResendOtp = useEvent(async () => {
    if (!challenge) {
      showError('Authentication method or value is not specified.')
      return
    }
    skipAutoVerifyRef.current = true
    setResending(true)
    setOtpCode('')
    setOtpKey(Math.random())
    try {
      const { error } = await validateLoginOtpCode(challenge.value)

      if (error) {
        showError(error)
      }

      setIsError(!!error)
      startTimer(30, true)
    } finally {
      setResending(false)
    }
  })

  const handleCodeChanged = useEvent((code: string) => {
    setOtpCode(code)
    if (skipAutoVerifyRef.current && code.length === 6) {
      return
    }
    if (code.length > 0) {
      skipAutoVerifyRef.current = false
    }
    if (isError && code.length < 6) {
      setIsError(false)
    }
  })

  const handleContinue = useEvent(async () => {
    if (!challenge) {
      showError('Authentication method or value is not specified.')
      return
    }
    if (!shouldAutoVerifyOtp(otpCode, resending) || skipAutoVerifyRef.current) {
      return
    }

    setVerifying(true)

    try {
      const { error } = await otpLogin(challenge.value, otpCode)

      if (error) {
        setIsError(true)
        dismissKeyboard()
        showError(error)
        setOtpCode('')
        setOtpKey(Math.random())
        setVerifying(false)
        return
      }

      clearPendingOtpChallenge()
      pauseTimer()
    } catch {
      // error handled by auth client
    } finally {
      setVerifying(false)
    }
  })

  useEffect(() => {
    startTimer(30, true)
  }, [startTimer])

  useEffect(() => {
    if (shouldAutoVerifyOtp(otpCode, resending) && !skipAutoVerifyRef.current) {
      handleContinue()
    }
  }, [handleContinue, otpCode, resending])

  if (!challenge) {
    return <Redirect href="/auth/signup/email" />
  }

  return (
    <StepPageLayout
      title="Enter Code"
      Icon={PasswordIcon}
      description="We sent a verification code to your email"
      descriptionSecondLine={challenge.value}
      backHref="/auth/signup/email"
      bottom={
        <KeyboardStickyFooter>
          <YStack items="center" gap="$3" pb="$3">
            {timerCount > 0 ? (
              <SizableText fontSize={14} color="$color11">
                Resend code in {timerCount}s
              </SizableText>
            ) : (
              <RNPressable
                onPress={() => void handleResendOtp()}
                disabled={resending}
                hitSlop={20}
                accessibilityRole="button"
                accessibilityLabel="Resend code"
                testID="resend-otp-button"
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  opacity: resending ? 0.6 : pressed ? 0.7 : 1,
                })}
              >
                <SizableText
                  fontSize={14}
                  fontWeight="600"
                  color="$orange10"
                  pointerEvents="none"
                >
                  {resending ? 'Sending...' : 'Resend code'}
                </SizableText>
              </RNPressable>
            )}
          </YStack>
          <MtdActionButton
            width="100%"
            disabled={isDisabled}
            opacity={isDisabled ? 0.5 : 1}
            onPress={isDisabled ? undefined : handleContinue}
            data-testid="verify-otp-button"
          >
            {verifying ? 'Verifying...' : 'Next'}
          </MtdActionButton>
        </KeyboardStickyFooter>
      }
    >
      <YStack items="center" gap="$4">
        <OtpInput
          data-testid="otp-input"
          key={otpKey}
          autoFocus
          otpCount={6}
          onCodeChanged={handleCodeChanged}
          defaultValue={otpCode}
          isError={isError}
        />
      </YStack>
    </StepPageLayout>
  )
}
