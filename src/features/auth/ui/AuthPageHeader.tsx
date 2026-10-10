import { usePathname, type Href } from 'one'
import { SizableText, XStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { Link } from '~/interface/app/Link'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'

function getBackTarget(pathname: string): { href: Href; label: string } {
  if (pathname === '/auth/login') {
    return { href: '/', label: 'Back' }
  }

  if (pathname.startsWith('/auth/signup/otp')) {
    return { href: '/auth/signup/email', label: 'Back' }
  }

  if (pathname.startsWith('/auth/signup')) {
    return { href: '/auth/login', label: 'Back' }
  }

  return { href: '/', label: 'Back' }
}

export function AuthPageHeader() {
  const pathname = usePathname()
  const { href, label } = getBackTarget(pathname)

  return (
    <XStack width="100%" maxW={420} mx="auto" mb="$4" items="center">
      <Link href={href} aria-label={label} asChild>
        <XStack
          gap="$1.5"
          items="center"
          py="$1"
          px="$1"
          rounded="$3"
          cursor="pointer"
          hoverStyle={{ opacity: 0.85 }}
          pressStyle={{ opacity: 0.7 }}
        >
          <CaretLeftIcon size={18} color={MTD_TOKENS.textMuted} />
          <SizableText fontSize={14} fontWeight="500" color={MTD_TOKENS.textMuted}>
            {label}
          </SizableText>
        </XStack>
      </Link>
    </XStack>
  )
}
