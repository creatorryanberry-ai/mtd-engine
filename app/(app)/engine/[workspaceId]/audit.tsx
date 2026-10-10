import { createRoute } from 'one'

import { EngineAuditScreen } from '~/features/engine/screens/EngineAuditScreen'

const route = createRoute<'/(app)/engine/[workspaceId]/audit'>()

export default function EngineAuditScreenRoute() {
  const { workspaceId } = route.useParams()
  if (!workspaceId) return null
  return <EngineAuditScreen workspaceId={workspaceId} />
}
