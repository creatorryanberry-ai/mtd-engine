import { useRouter } from 'one'

import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'

export const LoginButton = () => {
  const router = useRouter()
  const { loginText, loginLink } = useAuth()

  return <Button onPress={() => router.push(loginLink)}>{loginText}</Button>
}
