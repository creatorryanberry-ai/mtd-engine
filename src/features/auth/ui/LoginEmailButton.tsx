import { useRouter } from 'one'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'

export const LoginEmailButton = () => {
  const router = useRouter()

  if (!isPublicAuthEnabled) return null

  return (
    <MtdActionButton
      width="100%"
      height={48}
      onPress={() => router.push('/auth/signup/email')}
      data-testid="continue-with-email"
      testID="continue-with-email"
    >
      Continue with Email
    </MtdActionButton>
  )
}
