import { SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { MtdStaticPageShell } from '~/interface/landing/MtdStaticPageShell'

import type { ReactNode } from 'react'

type LegalPageProps = {
  title: string
  children: ReactNode
}

export const LegalPage = ({ title, children }: LegalPageProps) => {
  return (
    <MtdStaticPageShell>
      <YStack gap="$4">
        <SizableText
          render="h1"
          role="heading"
          fontFamily="$heading"
          fontSize={32}
          fontWeight="700"
          color={MTD_TOKENS.text}
          lineHeight={40}
        >
          {title}
        </SizableText>
        <SizableText size="$3" color={MTD_TOKENS.textMuted}>
          Last updated:{' '}
          {new Date().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </SizableText>

        <YStack gap="$4" mt="$2">
          {children}
        </YStack>
      </YStack>
    </MtdStaticPageShell>
  )
}

type LegalSectionProps = {
  title: string
  children: ReactNode
}

export const LegalSection = ({ title, children }: LegalSectionProps) => {
  return (
    <YStack gap="$2">
      <SizableText size="$5" fontWeight="600" color={MTD_TOKENS.text}>
        {title}
      </SizableText>
      {children}
    </YStack>
  )
}

export const LegalText = ({ children }: { children: ReactNode }) => {
  return (
    <SizableText size="$4" color={MTD_TOKENS.textMuted} lineHeight="$5">
      {children}
    </SizableText>
  )
}

export const LegalList = ({ children }: { children: ReactNode }) => {
  return (
    <YStack gap="$2" pl="$4">
      {children}
    </YStack>
  )
}
