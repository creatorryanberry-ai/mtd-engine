import { Redirect, Slot } from 'one'

import { ProvideQuery } from '~/features/api/client/ProvideQuery'
import { useAuth } from '~/features/auth/client/authClient'
import { EngineShell } from '~/features/engine/components/EngineShell'
import { isPublicAuthEnabled } from '~/helpers/isPublicAuthEnabled'

export function EngineLayout() {
  const { state } = useAuth()

  if (state === 'logged-out') {
    if (process.env.VITE_NATIVE || isPublicAuthEnabled) {
      return <Redirect href="/auth/login" />
    }
    return <Redirect href="/" />
  }

  return (
    <ProvideQuery>
      <EngineShell>
        <Slot />
      </EngineShell>
    </ProvideQuery>
  )
}
