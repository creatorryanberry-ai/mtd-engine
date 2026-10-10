import { createRoute } from 'one'

import { EngineAudiencesScreen } from '~/features/engine/screens/EngineAudiencesScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/audiences'>()

export default function EngineAudiencesScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineAudiencesScreen workspaceId={workspaceId} />
}
