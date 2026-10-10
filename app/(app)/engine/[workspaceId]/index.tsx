import { createRoute } from 'one'

import { EngineCommandCentreScreen } from '~/features/engine/screens/EngineCommandCentreScreen'

const route = createRoute<'/(app)/engine/[workspaceId]'>()

export default function EngineCommandCentreScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineCommandCentreScreen workspaceId={workspaceId} />
}
