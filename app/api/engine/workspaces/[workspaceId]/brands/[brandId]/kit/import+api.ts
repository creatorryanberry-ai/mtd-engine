import { defineRoute } from '~/api/defineRoute'
import { errorResponseSchema } from '~/contract'
import {
  importBrandKitInputSchema,
  importBrandKitResponseSchema,
} from '~/features/engine/contract'
import { requestIp, userActor, writeAudit } from '~/features/engine/core/server/audit'
import { getBrand } from '~/features/engine/core/server/brandService'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import {
  draftBrandKitFromWebsite,
  WebsiteFetchError,
} from '~/features/engine/llm/brandKitImport'
import {
  LlmBudgetExceededError,
  LlmNotConfiguredError,
  LlmOutputError,
  LlmRefusalError,
} from '~/features/engine/llm/gateway'
import { UnsafeUrlError } from '~/features/engine/llm/ssrf'

import type { Endpoint } from 'one'

function toHttpError(error: unknown) {
  if (error instanceof UnsafeUrlError) return httpError(400, error.message)
  if (error instanceof WebsiteFetchError) return httpError(422, error.message)
  if (error instanceof LlmNotConfiguredError)
    return httpError(503, 'LLM is not configured')
  if (error instanceof LlmBudgetExceededError) return httpError(402, error.message)
  if (error instanceof LlmRefusalError) return httpError(422, error.message)
  if (error instanceof LlmOutputError) return httpError(502, error.message)
  return null
}

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/brands/{brandId}/kit/import',
  summary: 'Draft a brand kit from a website',
  description:
    'Fetches the website server-side and asks the fast model to draft colours, fonts, tone, claims and personas. Nothing is saved; review the draft then PUT the kit.',
  tags: ['engine'],
  input: importBrandKitInputSchema,
  output: importBrandKitResponseSchema,
  errorResponses: [
    { status: 400, description: 'Url not allowed', schema: errorResponseSchema },
    { status: 402, description: 'Monthly LLM budget spent', schema: errorResponseSchema },
    { status: 404, description: 'Brand not found', schema: errorResponseSchema },
    {
      status: 422,
      description: 'Website could not be read',
      schema: errorResponseSchema,
    },
    { status: 503, description: 'LLM not configured', schema: errorResponseSchema },
  ],
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      async ({ auth, workspace }) => {
        const brand = await getBrand(workspace.id, requireParam(params, 'brandId'))
        if (!brand) throw httpError(404, 'Brand not found')

        const actor = userActor(auth.id)
        try {
          const result = await draftBrandKitFromWebsite({
            workspaceId: workspace.id,
            websiteUrl: input.websiteUrl,
            actor,
          })
          await writeAudit({
            workspaceId: workspace.id,
            actor,
            action: 'brand_kit.import',
            entityType: 'brand',
            entityId: brand.id,
            after: { websiteUrl: input.websiteUrl, sourceUrl: result.sourceUrl },
            reasoning: 'brand kit drafted from website by the fast model; not saved',
            evidence: { llmCallId: result.llmCallId },
            ipAddress: requestIp(request),
          })
          return result
        } catch (error) {
          const mapped = toHttpError(error)
          if (!mapped) throw error
          await writeAudit({
            workspaceId: workspace.id,
            actor,
            action: 'brand_kit.import_failed',
            entityType: 'brand',
            entityId: brand.id,
            after: { websiteUrl: input.websiteUrl },
            reasoning: error instanceof Error ? error.message : 'import failed',
            evidence:
              error instanceof LlmRefusalError ? { llmCallId: error.llmCallId } : {},
            ipAddress: requestIp(request),
          })
          throw mapped
        }
      },
    ),
})
