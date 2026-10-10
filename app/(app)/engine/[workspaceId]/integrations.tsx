import { createRoute } from 'one'

import { EngineIntegrationsScreen } from '~/features/engine/screens/EngineIntegrationsScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/integrations'>()

export default function EngineIntegrationsScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineIntegrationsScreen workspaceId={workspaceId} />
}
