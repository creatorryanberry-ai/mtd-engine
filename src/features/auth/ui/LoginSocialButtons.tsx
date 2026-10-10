import { useState } from 'react'
import { isWeb, Separator, SizableText, Spinner, XStack } from 'tamagui'

import {
  signInWithSocial,
  type SocialProvider,
} from '~/features/auth/client/signInWithSocial'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { AppleIcon } from '~/interface/icons/AppleIcon'
import { GoogleIcon } from '~/interface/icons/GoogleIcon'
import { showToast } from '~/interface/toast/helpers'

export const LoginSocialButtons = () => {
  const [loading, setLoading] = useState<SocialProvider | null>(null)

  if (isWeb) return null

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading) return

    setLoading(provider)
    try {
      const result = await signInWithSocial(provider)
      if (result.ok || ('cancelled' in result && result.cancelled)) return
      showToast(result.error.message || `${provider} login failed`, {
        type: 'error',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : `${provider} login failed`
      showToast(message, { type: 'error' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <XStack items="center" gap="$3">
        <Separator flex={1} borderColor={MTD_TOKENS.cardBorder} />
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} shrink={0}>
          or continue with
        </SizableText>
        <Separator flex={1} borderColor={MTD_TOKENS.cardBorder} />
      </XStack>

      <XStack gap="$3">
        <MtdActionButton
          flex={1}
          variant="secondary"
          disabled={!!loading}
          onPress={() => handleSocialLogin('google')}
          icon={
            loading === 'google' ? (
              <Spinner size="small" color={MTD_TOKENS.text} />
            ) : (
              <GoogleIcon size={20} color={MTD_TOKENS.text} />
            )
          }
        >
          Google
        </MtdActionButton>
        <MtdActionButton
          flex={1}
          variant="secondary"
          disabled={!!loading}
          onPress={() => handleSocialLogin('apple')}
          icon={
            loading === 'apple' ? (
              <Spinner size="small" color={MTD_TOKENS.text} />
            ) : (
              <AppleIcon size={22} color={MTD_TOKENS.text} />
            )
          }
        >
          Apple
        </MtdActionButton>
      </XStack>
    </>
  )
}
