import { Redirect, Slot } from 'one'
import { SizableText, YStack } from 'tamagui'

import { authState, useAuth } from '~/features/auth/client/authClient'
import { AuthPageShell } from '~/features/auth/ui/AuthPageShell'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'

export function AuthAndOnboardingLayout() {
  const { state } = useAuth()
  const liveState = authState.value?.state ?? state
  if (liveState === 'logged-in') {
    return <Redirect href="/home/feed" />
  }

  // web: send to marketing home. native has no `/` route — show a static message
  // instead of Redirect (which would loop if pointed at /auth/login).
  if (!isPublicAuthEnabled) {
    if (process.env.VITE_NATIVE) {
      return (
        <YStack
          flex={1}
          items="center"
          justify="center"
          bg={MTD_TOKENS.background}
          p="$4"
        >
          <SizableText color={MTD_TOKENS.textMuted}>Sign in is not available</SizableText>
        </YStack>
      )
    }
    return <Redirect href="/" />
  }

  return process.env.VITE_NATIVE ? (
    <Slot />
  ) : (
    <AuthPageShell>
      <Slot />
    </AuthPageShell>
  )
}
