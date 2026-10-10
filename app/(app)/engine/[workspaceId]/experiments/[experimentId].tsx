import { createRoute } from 'one'

import { EngineExperimentDetailScreen } from '~/features/engine/screens/EngineExperimentDetailScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/experiments/[experimentId]'>()

export default function EngineExperimentDetailScreenRoute() {
  const { workspaceId, experimentId } = route.useParams()
  if (!workspaceId || !experimentId) return null
  return (
    <EngineExperimentDetailScreen workspaceId={workspaceId} experimentId={experimentId} />
  )
}
