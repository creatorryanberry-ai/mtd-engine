import { Redirect, useRouter, createRoute } from 'one'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { useEvent, YStack } from 'tamagui'

import { validateLoginOtpCode } from '~/features/auth/client/otpLogin'
import {
  loadPendingOtpChallenge,
  savePendingOtpChallenge,
} from '~/features/auth/client/pendingOtpChallenge'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { showError } from '~/interface/dialogs/actions'
import { isSmallScreen } from '~/interface/dimensions'
import { Input } from '~/interface/forms/Input'
import { EnvelopeSimpleIcon } from '~/interface/icons/phosphor/EnvelopeSimpleIcon'
import { dismissKeyboard } from '~/interface/keyboard/dismissKeyboard'
import { KeyboardStickyFooter } from '~/interface/keyboard/KeyboardStickyFooter'
import { StepPageLayout } from '~/interface/pages/StepPageLayout'

const route = createRoute<'/(app)/auth/signup/[method]'>()

export const SignupPage = memo(() => {
  // resume can drop dynamic params; this route is email-only
  const params = route.useParams()
  const router = useRouter()
  const inputRef = useRef<Input>(null)
  const [inputValue, setInputValue] = useState(() => {
    const pending = loadPendingOtpChallenge()
    return pending?.method === 'email' ? pending.value : ''
  })
  const [loading, setLoading] = useState(false)

  const isDisabled = !inputValue.trim()

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 650)
    return () => clearTimeout(timer)
  }, [])

  const handleEmailChange = useEvent((value: string) => {
    setInputValue(value)
    const email = value.trim()
    if (email) {
      savePendingOtpChallenge({ method: 'email', value: email })
    }
  })

  const handleContinue = useEvent(async () => {
    const email = inputValue.trim()
    if (!email) return

    const tm = setTimeout(() => {
      setLoading(true)
    }, 1000)

    try {
      const { success, error } = await validateLoginOtpCode(email)

      if (success) {
        // persist so otp screen survives app background / remount (mail apps)
        savePendingOtpChallenge({ method: 'email', value: email })
        router.push(`/auth/signup/otp?method=email&value=${encodeURIComponent(email)}`)
        return
      }
      dismissKeyboard()
      showError(error)
    } finally {
      clearTimeout(tm)
      setLoading(false)
    }
  })

  // unknown method only — missing param after remount still shows email form
  if (params.method && params.method !== 'email') {
    return <Redirect href="/auth/signup/email" />
  }

  return (
    <StepPageLayout
      title="Continue with Email"
      Icon={EnvelopeSimpleIcon}
      description="Sign in or sign up with your email."
      backHref="/auth/login"
      disableScroll={!isSmallScreen}
      bottom={
        <KeyboardStickyFooter>
          <MtdActionButton
            width="100%"
            disabled={isDisabled || loading}
            opacity={isDisabled || loading ? 0.5 : 1}
            onPress={isDisabled || loading ? undefined : handleContinue}
            data-testid="next-button"
          >
            {loading ? 'Processing...' : 'Next'}
          </MtdActionButton>
        </KeyboardStickyFooter>
      }
    >
      <YStack>
        <Input
          data-testid="email-input"
          ref={inputRef}
          placeholder="Enter email address"
          value={inputValue}
          onChangeText={handleEmailChange}
          autoCapitalize="none"
          onSubmitEditing={handleContinue}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
        />
      </YStack>
    </StepPageLayout>
  )
})
