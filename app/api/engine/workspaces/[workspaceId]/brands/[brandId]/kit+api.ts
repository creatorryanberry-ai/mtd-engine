import { defineRoute } from '~/api/defineRoute'
import {
  engineBrandKitSchema,
  upsertBrandKitInputSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import {
  getBrand,
  getCurrentBrandKit,
  putBrandKit,
} from '~/features/engine/core/server/brandService'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/brands/{brandId}/kit',
  summary: 'Get the current brand kit version',
  tags: ['engine'],
  output: engineBrandKitSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      async (access) => {
        const brandId = requireParam(params, 'brandId')
        if (!(await getBrand(access.workspace.id, brandId)))
          throw httpError(404, 'Brand not found')
        const kit = await getCurrentBrandKit(access.workspace.id, brandId)
        if (!kit) throw httpError(404, 'Brand kit not found')
        return kit
      },
    ),
})

export const PUT: Endpoint = defineRoute({
  method: 'PUT',
  path: '/api/engine/workspaces/{workspaceId}/brands/{brandId}/kit',
  summary: 'Save a new brand kit version',
  tags: ['engine'],
  input: upsertBrandKitInputSchema,
  output: engineBrandKitSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        putBrandKit(
          access.workspace.id,
          access.auth.id,
          requireParam(params, 'brandId'),
          input,
          requestIp(request),
        ),
    ),
})
