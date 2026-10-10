import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Link } from '~/interface/app/Link'

const links = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/help', label: 'Help' },
] as const

export function MtdLandingFooter() {
  return (
    <YStack width="100%" maxW={720} mx="auto" px="$4" pt="$6" pb="$10">
      <XStack gap="$2" flexWrap="wrap" justify="center" items="center">
        {links.map((link, index) => (
          <XStack key={link.href} gap="$2" items="center">
            {index > 0 && (
              <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
                ·
              </SizableText>
            )}
            <Link href={link.href}>
              <SizableText
                fontSize={12}
                color={MTD_TOKENS.textSubtle}
                hoverStyle={{ color: MTD_TOKENS.orange }}
              >
                {link.label}
              </SizableText>
            </Link>
          </XStack>
        ))}
      </XStack>
    </YStack>
  )
}
