import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { engineBrandSchema, upsertBrandInputSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { updateBrand } from '~/features/engine/core/server/brandService'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/engine/workspaces/{workspaceId}/brands/{brandId}',
  summary: 'Update a brand',
  tags: ['engine'],
  input: v.partial(upsertBrandInputSchema),
  output: engineBrandSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        updateBrand(
          access.workspace.id,
          access.auth.id,
          requireParam(params, 'brandId'),
          input,
          requestIp(request),
        ),
    ),
})
