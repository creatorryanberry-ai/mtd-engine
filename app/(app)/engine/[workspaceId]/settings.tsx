import { createRoute } from 'one'

import { EngineSettingsScreen } from '~/features/engine/screens/EngineSettingsScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/settings'>()

export default function EngineSettingsScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineSettingsScreen workspaceId={workspaceId} />
}
