import * as v from 'valibot'

import { authFetch, getAuthFetchErrorMessage } from '~/features/auth/client/authFetch'

import type {
  AttributionModelValue,
  AttributionReportDto,
  ConnectorInfoDto,
  DashboardSummaryDto,
  EngineAuditLogDto,
  EngineBrandDto,
  EngineBrandKitDto,
  EngineConnectionDto,
  EngineContactDto,
  EngineExperimentDto,
  EngineLlmCallSummaryDto,
  EngineMembershipDto,
  EngineOrderDto,
  EngineWorkspaceDto,
  EngineWorkspaceListItem,
  ExperimentAssignmentDto,
  ExperimentResultDto,
  GlobalHoldoutStatusDto,
  ImportBrandKitResponse,
  IncrementalReportDto,
  MetricsDailyRowDto,
  connectInputSchema,
  connectResponseSchema,
  createExperimentInputSchema,
  createWorkspaceInputSchema,
  importBrandKitInputSchema,
  inviteMemberInputSchema,
  metricsRollupInputSchema,
  metricsRollupResponseSchema,
  okSchema,
  syncResponseSchema,
  transitionExperimentInputSchema,
  updateExperimentInputSchema,
  updateMemberInputSchema,
  updateWorkspaceInputSchema,
  upsertBrandInputSchema,
  upsertBrandKitInputSchema,
} from '~/features/engine/contract'

export type CreateWorkspaceInput = v.InferInput<typeof createWorkspaceInputSchema>
export type UpdateWorkspaceInput = v.InferInput<typeof updateWorkspaceInputSchema>
export type InviteMemberInput = v.InferInput<typeof inviteMemberInputSchema>
export type UpdateMemberInput = v.InferInput<typeof updateMemberInputSchema>
export type UpsertBrandInput = v.InferInput<typeof upsertBrandInputSchema>
export type UpsertBrandKitInput = v.InferInput<typeof upsertBrandKitInputSchema>
export type ImportBrandKitInput = v.InferInput<typeof importBrandKitInputSchema>
export type ConnectInput = v.InferInput<typeof connectInputSchema>
export type ConnectResponse = v.InferOutput<typeof connectResponseSchema>
export type SyncResponse = v.InferOutput<typeof syncResponseSchema>
export type OkResponse = v.InferOutput<typeof okSchema>
export type CreateExperimentInput = v.InferInput<typeof createExperimentInputSchema>
export type UpdateExperimentInput = v.InferInput<typeof updateExperimentInputSchema>
export type TransitionExperimentInput = v.InferInput<
  typeof transitionExperimentInputSchema
>
export type MetricsRollupInput = v.InferInput<typeof metricsRollupInputSchema>
export type MetricsRollupResponse = v.InferOutput<typeof metricsRollupResponseSchema>

/** iso dates (YYYY-MM-DD); `to` is exclusive */
export type DateRange = { from?: string; to?: string }
export type AttributionQuery = DateRange & {
  model?: AttributionModelValue
  lookbackDays?: number
}
export type MetricsDailyQuery = DateRange & { channelKey?: string }

export type Page<T> = { items: T[]; nextCursor: string | null }
export type PageQuery = { limit?: number; cursor?: string | null }

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// unpaged list routes wrap their array in { items }
type Items<T> = { items: T[] }

async function request<T>(
  path: string,
  options: { method?: Method; body?: unknown; fallback: string },
): Promise<T> {
  const response = await authFetch<T>(path, {
    method: options.method ?? 'GET',
    body: options.body,
  })
  if (response.error) {
    throw new Error(getAuthFetchErrorMessage(response.error, options.fallback))
  }
  return response.data
}

function withQuery(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

function withPage(path: string, query?: PageQuery) {
  const params = new URLSearchParams()
  if (query?.limit) params.set('limit', String(query.limit))
  if (query?.cursor) params.set('cursor', query.cursor)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

const base = '/api/engine'
const ws = (workspaceId: string) => `${base}/workspaces/${workspaceId}`

export const engineApi = {
  listWorkspaces: () =>
    request<Items<EngineWorkspaceListItem>>(`${base}/workspaces`, {
      fallback: 'Failed to load workspaces',
    }).then((page) => page.items),
  createWorkspace: (input: CreateWorkspaceInput) =>
    request<EngineWorkspaceListItem>(`${base}/workspaces`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to create workspace',
    }),
  getWorkspace: (workspaceId: string) =>
    request<EngineWorkspaceDto>(ws(workspaceId), {
      fallback: 'Failed to load workspace',
    }),
  updateWorkspace: (workspaceId: string, input: UpdateWorkspaceInput) =>
    request<EngineWorkspaceDto>(ws(workspaceId), {
      method: 'PATCH',
      body: input,
      fallback: 'Failed to update workspace',
    }),

  listMembers: (workspaceId: string) =>
    request<Items<EngineMembershipDto>>(`${ws(workspaceId)}/members`, {
      fallback: 'Failed to load members',
    }).then((page) => page.items),
  addMember: (workspaceId: string, input: InviteMemberInput) =>
    request<EngineMembershipDto>(`${ws(workspaceId)}/members`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to add member',
    }),
  updateMember: (workspaceId: string, memberId: string, input: UpdateMemberInput) =>
    request<EngineMembershipDto>(`${ws(workspaceId)}/members/${memberId}`, {
      method: 'PATCH',
      body: input,
      fallback: 'Failed to update member',
    }),
  removeMember: (workspaceId: string, memberId: string) =>
    request<OkResponse>(`${ws(workspaceId)}/members/${memberId}`, {
      method: 'DELETE',
      fallback: 'Failed to remove member',
    }),

  listBrands: (workspaceId: string) =>
    request<Items<EngineBrandDto>>(`${ws(workspaceId)}/brands`, {
      fallback: 'Failed to load brands',
    }).then((page) => page.items),
  createBrand: (workspaceId: string, input: UpsertBrandInput) =>
    request<EngineBrandDto>(`${ws(workspaceId)}/brands`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to create brand',
    }),
  updateBrand: (workspaceId: string, brandId: string, input: Partial<UpsertBrandInput>) =>
    request<EngineBrandDto>(`${ws(workspaceId)}/brands/${brandId}`, {
      method: 'PATCH',
      body: input,
      fallback: 'Failed to update brand',
    }),
  getBrandKit: (workspaceId: string, brandId: string) =>
    request<EngineBrandKitDto>(`${ws(workspaceId)}/brands/${brandId}/kit`, {
      fallback: 'Failed to load brand kit',
    }),
  saveBrandKit: (workspaceId: string, brandId: string, input: UpsertBrandKitInput) =>
    request<EngineBrandKitDto>(`${ws(workspaceId)}/brands/${brandId}/kit`, {
      method: 'PUT',
      body: input,
      fallback: 'Failed to save brand kit',
    }),
  importBrandKit: (workspaceId: string, brandId: string, input: ImportBrandKitInput) =>
    request<ImportBrandKitResponse>(`${ws(workspaceId)}/brands/${brandId}/kit/import`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to import brand kit',
    }),

  listAudit: (workspaceId: string, query?: PageQuery) =>
    request<Page<EngineAuditLogDto>>(withPage(`${ws(workspaceId)}/audit`, query), {
      fallback: 'Failed to load audit log',
    }),
  listContacts: (workspaceId: string, query?: PageQuery) =>
    request<Page<EngineContactDto>>(withPage(`${ws(workspaceId)}/contacts`, query), {
      fallback: 'Failed to load contacts',
    }),
  listOrders: (workspaceId: string, query?: PageQuery) =>
    request<Page<EngineOrderDto>>(withPage(`${ws(workspaceId)}/orders`, query), {
      fallback: 'Failed to load orders',
    }),
  getDashboard: (workspaceId: string) =>
    request<DashboardSummaryDto>(`${ws(workspaceId)}/dashboard`, {
      fallback: 'Failed to load dashboard',
    }),
  listLlmCalls: (workspaceId: string, query?: PageQuery) =>
    request<Page<EngineLlmCallSummaryDto>>(
      withPage(`${ws(workspaceId)}/llm/calls`, query),
      {
        fallback: 'Failed to load LLM calls',
      },
    ),

  listConnectors: () =>
    request<ConnectorInfoDto[]>(`${base}/connectors`, {
      fallback: 'Failed to load connectors',
    }),
  listConnections: (workspaceId: string) =>
    request<EngineConnectionDto[]>(`${ws(workspaceId)}/connections`, {
      fallback: 'Failed to load connections',
    }),
  connectProvider: (workspaceId: string, provider: string, input: ConnectInput) =>
    request<ConnectResponse>(`${ws(workspaceId)}/connections/connect/${provider}`, {
      method: 'POST',
      body: input,
      fallback: `Failed to connect ${provider}`,
    }),
  syncConnection: (workspaceId: string, connectionId: string) =>
    request<SyncResponse>(`${ws(workspaceId)}/connections/${connectionId}/sync`, {
      method: 'POST',
      body: {},
      fallback: 'Failed to queue sync',
    }),
  disconnect: (workspaceId: string, connectionId: string) =>
    request<OkResponse>(`${ws(workspaceId)}/connections/${connectionId}`, {
      method: 'DELETE',
      fallback: 'Failed to disconnect',
    }),

  listExperiments: (workspaceId: string) =>
    request<Items<EngineExperimentDto>>(`${ws(workspaceId)}/experiments`, {
      fallback: 'Failed to load experiments',
    }).then((page) => page.items),
  getExperiment: (workspaceId: string, experimentId: string) =>
    request<EngineExperimentDto>(`${ws(workspaceId)}/experiments/${experimentId}`, {
      fallback: 'Failed to load experiment',
    }),
  createExperiment: (workspaceId: string, input: CreateExperimentInput) =>
    request<EngineExperimentDto>(`${ws(workspaceId)}/experiments`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to create experiment',
    }),
  updateExperiment: (
    workspaceId: string,
    experimentId: string,
    input: UpdateExperimentInput,
  ) =>
    request<EngineExperimentDto>(`${ws(workspaceId)}/experiments/${experimentId}`, {
      method: 'PATCH',
      body: input,
      fallback: 'Failed to update experiment',
    }),
  transitionExperiment: (
    workspaceId: string,
    experimentId: string,
    input: TransitionExperimentInput,
  ) =>
    request<EngineExperimentDto>(
      `${ws(workspaceId)}/experiments/${experimentId}/transition`,
      {
        method: 'POST',
        body: input,
        fallback: 'Failed to change experiment status',
      },
    ),
  refreshExperiment: (workspaceId: string, experimentId: string) =>
    request<ExperimentResultDto>(
      `${ws(workspaceId)}/experiments/${experimentId}/refresh`,
      {
        method: 'POST',
        body: {},
        fallback: 'Failed to refresh results',
      },
    ),
  getAssignment: (workspaceId: string, experimentId: string, contactId: string) =>
    request<ExperimentAssignmentDto>(
      withQuery(`${ws(workspaceId)}/experiments/${experimentId}/assignment`, {
        contactId,
      }),
      { fallback: 'Failed to look up assignment' },
    ),

  getGlobalHoldout: (workspaceId: string) =>
    request<GlobalHoldoutStatusDto>(`${ws(workspaceId)}/holdout`, {
      fallback: 'Failed to load holdout',
    }),
  getIncremental: (workspaceId: string, range: DateRange) =>
    request<IncrementalReportDto>(
      withQuery(`${ws(workspaceId)}/incremental`, { from: range.from, to: range.to }),
      { fallback: 'Failed to load incremental profit' },
    ),
  getAttribution: (workspaceId: string, query: AttributionQuery) =>
    request<AttributionReportDto>(
      withQuery(`${ws(workspaceId)}/attribution`, {
        from: query.from,
        to: query.to,
        model: query.model,
        lookbackDays: query.lookbackDays,
      }),
      { fallback: 'Failed to load attribution' },
    ),
  listMetricsDaily: (workspaceId: string, query: MetricsDailyQuery) =>
    request<Items<MetricsDailyRowDto>>(
      withQuery(`${ws(workspaceId)}/metrics/daily`, {
        from: query.from,
        to: query.to,
        channelKey: query.channelKey,
      }),
      { fallback: 'Failed to load daily metrics' },
    ).then((page) => page.items),
  runMetricsRollup: (workspaceId: string, input: MetricsRollupInput) =>
    request<MetricsRollupResponse>(`${ws(workspaceId)}/metrics/rollup`, {
      method: 'POST',
      body: input,
      fallback: 'Failed to recompute metrics',
    }),
}
