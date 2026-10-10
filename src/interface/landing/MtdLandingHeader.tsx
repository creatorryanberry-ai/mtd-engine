import { useRouter } from 'one'
import { XStack } from 'tamagui'

import { CuratorLogo } from '~/features/mtd/components/CuratorLogo'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'
import { Link } from '~/interface/app/Link'

export function MtdLandingHeader() {
  const router = useRouter()

  return (
    <XStack
      width="100%"
      maxW={720}
      mx="auto"
      px="$4"
      py="$4"
      items="center"
      justify={isPublicAuthEnabled ? 'space-between' : 'center'}
    >
      <Link href="/" aria-label="Home">
        <CuratorLogo />
      </Link>

      {isPublicAuthEnabled && (
        <MtdActionButton
          variant="secondary"
          minW={96}
          px="$3"
          onPress={() => router.push('/auth/login')}
        >
          Sign in
        </MtdActionButton>
      )}
    </XStack>
  )
}
