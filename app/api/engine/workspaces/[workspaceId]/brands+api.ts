import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { engineBrandSchema, upsertBrandInputSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { createBrand, listBrands } from '~/features/engine/core/server/brandService'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/brands',
  summary: 'List brands in the workspace',
  tags: ['engine'],
  output: v.object({ items: v.array(engineBrandSchema) }),
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      async (access) => ({
        items: await listBrands(access.workspace.id),
      }),
    ),
})

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/brands',
  summary: 'Create a brand',
  tags: ['engine'],
  input: upsertBrandInputSchema,
  output: engineBrandSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        createBrand(access.workspace.id, access.auth.id, input, requestIp(request)),
    ),
})
