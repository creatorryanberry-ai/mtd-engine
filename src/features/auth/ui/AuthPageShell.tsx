import type { ReactNode } from 'react'
import { isWeb, XStack, YStack } from 'tamagui'

import { AuthPageHeader } from '~/features/auth/ui/AuthPageHeader'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Onboarding } from '~/features/onboarding'

type AuthPageShellProps = {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <YStack
      flex={1}
      minH="100vh"
      bg={MTD_TOKENS.background}
      items="center"
      justify="center"
      px="$4"
      py="$8"
      position="relative"
      overflow="hidden"
    >
      <YStack
        position="absolute"
        width={720}
        height={720}
        t={-240}
        l="50%"
        pointerEvents="none"
        style={{
          marginLeft: -360,
          background: `radial-gradient(circle, ${MTD_TOKENS.orange}28 0%, transparent 70%)`,
        }}
      />
      <YStack
        position="absolute"
        width={480}
        height={480}
        b={-160}
        r={-80}
        pointerEvents="none"
        style={{
          background: `radial-gradient(circle, ${MTD_TOKENS.orange}18 0%, transparent 70%)`,
        }}
      />

      <XStack
        width="100%"
        maxW={960}
        mx="auto"
        z={1}
        gap="$6"
        items="center"
        justify="center"
      >
        <YStack width="100%" maxW={420} items="center">
          <AuthPageHeader />

          <YStack
            width="100%"
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$6"
            p="$6"
            gap="$5"
            {...(isWeb && {
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)' as any,
            })}
          >
            {children}
          </YStack>
        </YStack>

        {/* decorative onboarding panel — hidden below $md via Onboarding itself */}
        <YStack flex={1} maxW={460} height={620} display="none" $md={{ display: 'flex' }}>
          <Onboarding />
        </YStack>
      </XStack>
    </YStack>
  )
}
