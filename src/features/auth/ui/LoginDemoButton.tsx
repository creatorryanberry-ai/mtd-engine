import { useState } from 'react'
import { Spinner } from 'tamagui'

import { standardizeBetterAuthError } from '~/features/auth/client/betterAuthErrors'
import { signInAsDemo } from '~/features/auth/client/signInAsDemo'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { isDemoMode } from '~/helpers/isDemoMode'
import { showToast } from '~/interface/toast/helpers'

export const LoginDemoButton = () => {
  const [loading, setLoading] = useState(false)

  if (!isDemoMode) return null

  const handleLoginAsDemo = async () => {
    setLoading(true)
    const { error } = await signInAsDemo()
    setLoading(false)
    if (error) {
      const { message } = standardizeBetterAuthError(error)
      showToast(`Demo login failed: ${message}`, { type: 'error' })
    }
  }

  return (
    <MtdActionButton
      width="100%"
      variant="secondary"
      disabled={loading}
      onPress={handleLoginAsDemo}
      data-testid="login-as-demo"
      testID="login-as-demo"
    >
      {loading ? <Spinner size="small" color={MTD_TOKENS.text} /> : 'Login as Demo User'}
    </MtdActionButton>
  )
}
