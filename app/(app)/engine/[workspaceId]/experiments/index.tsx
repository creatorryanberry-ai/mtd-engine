import { createRoute } from 'one'

import { EngineExperimentsScreen } from '~/features/engine/screens/EngineExperimentsScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/experiments'>()

export default function EngineExperimentsScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineExperimentsScreen workspaceId={workspaceId} />
}
