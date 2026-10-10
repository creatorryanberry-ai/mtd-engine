import { createRoute } from 'one'

import { EngineBrandScreen } from '~/features/engine/screens/EngineBrandScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/brand'>()

export default function EngineBrandScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineBrandScreen workspaceId={workspaceId} />
}
