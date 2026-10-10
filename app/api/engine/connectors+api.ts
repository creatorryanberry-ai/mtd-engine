import { defineRoute } from '~/api/defineRoute'
import { listConnectorInfo } from '~/features/engine/channels/registry'
import { connectorCatalogSchema } from '~/features/engine/contract'
import { withEngineAuth } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/connectors',
  summary: 'Connector catalog',
  description:
    'Every connector the engine can use, with whether the server has the provider credentials to connect it.',
  tags: ['engine'],
  output: connectorCatalogSchema,
  handler: (_input, { request }) =>
    withEngineAuth(request, async () => listConnectorInfo()),
})
