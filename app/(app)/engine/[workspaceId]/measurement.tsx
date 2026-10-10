import { createRoute } from 'one'

import { EngineMeasurementScreen } from '~/features/engine/screens/EngineMeasurementScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/measurement'>()

export default function EngineMeasurementScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineMeasurementScreen workspaceId={workspaceId} />
}
