import * as v from 'valibot'

/**
 * valibot schemas shared by the engine api routes (app/api/engine/**) and the
 * client hooks. routes validate output against these; the client types derive
 * from them. keep this file free of server imports.
 */

export const engineRoleSchema = v.picklist([
  'owner',
  'admin',
  'marketer',
  'approver',
  'viewer',
])
export type EngineRoleValue = v.InferOutput<typeof engineRoleSchema>

export const engineWorkspaceSchema = v.object({
  id: v.string(),
  name: v.string(),
  slug: v.string(),
  currency: v.string(),
  timezone: v.string(),
  dataRegion: v.string(),
  llmBudgetMonthlyCents: v.number(),
  mediaBudgetMonthlyCents: v.number(),
  killSwitch: v.boolean(),
  /** permanent holdout share, 0..0.5 */
  globalHoldoutRate: v.number(),
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type EngineWorkspaceDto = v.InferOutput<typeof engineWorkspaceSchema>

export const engineWorkspaceListItemSchema = v.object({
  ...engineWorkspaceSchema.entries,
  role: engineRoleSchema,
})
export type EngineWorkspaceListItem = v.InferOutput<typeof engineWorkspaceListItemSchema>

export const createWorkspaceInputSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(80)),
  currency: v.optional(v.pipe(v.string(), v.length(3))),
  timezone: v.optional(v.string()),
  dataRegion: v.optional(v.picklist(['uk', 'eu'])),
})

export const updateWorkspaceInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(80))),
  currency: v.optional(v.pipe(v.string(), v.length(3))),
  timezone: v.optional(v.string()),
  llmBudgetMonthlyCents: v.optional(v.pipe(v.number(), v.minValue(0))),
  mediaBudgetMonthlyCents: v.optional(v.pipe(v.number(), v.minValue(0))),
  killSwitch: v.optional(v.boolean()),
  /** changing this moves contacts in or out of the baseline; audited */
  globalHoldoutRate: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(0.5))),
})

export const engineMembershipSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  role: engineRoleSchema,
  email: v.nullable(v.string()),
  name: v.nullable(v.string()),
  createdAt: v.string(),
})
export type EngineMembershipDto = v.InferOutput<typeof engineMembershipSchema>

export const inviteMemberInputSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  role: engineRoleSchema,
})

export const updateMemberInputSchema = v.object({
  role: engineRoleSchema,
})

export const engineBrandSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  websiteUrl: v.nullable(v.string()),
  industry: v.nullable(v.string()),
  market: v.string(),
  isDefault: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type EngineBrandDto = v.InferOutput<typeof engineBrandSchema>

export const brandKitColorSchema = v.object({
  name: v.string(),
  hex: v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/)),
  role: v.optional(v.string()),
})

export const brandKitClaimSchema = v.object({
  claim: v.string(),
  evidence: v.string(),
  approved: v.boolean(),
})

export const brandKitPersonaSchema = v.object({
  id: v.string(),
  name: v.string(),
  summary: v.string(),
  painPoints: v.array(v.string()),
  goals: v.array(v.string()),
  accuracy: v.optional(v.nullable(v.number())),
})

export const engineBrandKitSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  brandId: v.string(),
  version: v.number(),
  logoUrl: v.nullable(v.string()),
  colors: v.array(brandKitColorSchema),
  fonts: v.object({ heading: v.optional(v.string()), body: v.optional(v.string()) }),
  toneOfVoice: v.nullable(v.string()),
  bannedWords: v.array(v.string()),
  claims: v.array(brandKitClaimSchema),
  proofPoints: v.array(v.string()),
  personas: v.array(brandKitPersonaSchema),
  aiDisclosure: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type EngineBrandKitDto = v.InferOutput<typeof engineBrandKitSchema>

export const upsertBrandInputSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  websiteUrl: v.optional(v.nullable(v.pipe(v.string(), v.url()))),
  industry: v.optional(v.nullable(v.string())),
  market: v.optional(v.picklist(['b2b', 'b2c', 'both'])),
  isDefault: v.optional(v.boolean()),
})

export const upsertBrandKitInputSchema = v.object({
  logoUrl: v.optional(v.nullable(v.string())),
  colors: v.optional(v.array(brandKitColorSchema)),
  fonts: v.optional(
    v.object({ heading: v.optional(v.string()), body: v.optional(v.string()) }),
  ),
  toneOfVoice: v.optional(v.nullable(v.string())),
  bannedWords: v.optional(v.array(v.string())),
  claims: v.optional(v.array(brandKitClaimSchema)),
  proofPoints: v.optional(v.array(v.string())),
  personas: v.optional(v.array(brandKitPersonaSchema)),
  aiDisclosure: v.optional(v.picklist(['none', 'subtle', 'explicit'])),
})

export const importBrandKitInputSchema = v.object({
  websiteUrl: v.pipe(v.string(), v.url()),
})

/** llm-drafted kit from a website; same shape as upsertBrandKitInputSchema plus brand facts */
export const brandKitDraftSchema = v.object({
  brandName: v.nullable(v.string()),
  industry: v.nullable(v.string()),
  market: v.nullable(v.string()),
  colors: v.array(brandKitColorSchema),
  fonts: v.object({ heading: v.optional(v.string()), body: v.optional(v.string()) }),
  toneOfVoice: v.nullable(v.string()),
  bannedWords: v.array(v.string()),
  claims: v.array(brandKitClaimSchema),
  proofPoints: v.array(v.string()),
  personas: v.array(brandKitPersonaSchema),
})
export type BrandKitDraft = v.InferOutput<typeof brandKitDraftSchema>

export const importBrandKitResponseSchema = v.object({
  draft: brandKitDraftSchema,
  llmCallId: v.string(),
  sourceUrl: v.string(),
})
export type ImportBrandKitResponse = v.InferOutput<typeof importBrandKitResponseSchema>

export const engineConnectionSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  provider: v.string(),
  kind: v.string(),
  externalAccountId: v.nullable(v.string()),
  displayName: v.nullable(v.string()),
  status: v.string(),
  scopes: v.array(v.string()),
  tokenExpiresAt: v.nullable(v.string()),
  lastSyncAt: v.nullable(v.string()),
  lastSyncError: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type EngineConnectionDto = v.InferOutput<typeof engineConnectionSchema>

export const connectorInfoSchema = v.object({
  key: v.string(),
  displayName: v.string(),
  kind: v.string(),
  configured: v.boolean(),
  /** oauth | api_key */
  authKind: v.picklist(['oauth', 'api_key']),
  scopes: v.array(v.string()),
})
export type ConnectorInfoDto = v.InferOutput<typeof connectorInfoSchema>

export const connectorCatalogSchema = v.array(connectorInfoSchema)

export const engineConnectionListSchema = v.array(engineConnectionSchema)

export const connectInputSchema = v.object({
  returnTo: v.optional(v.nullable(v.string())),
  /** api-key providers (stripe) take the key here; it is encrypted and never echoed */
  apiKey: v.optional(v.string()),
  /** signing secret for the provider's webhook endpoint; stored encrypted with the key */
  webhookSecret: v.optional(v.string()),
})

export const syncScopeSchema = v.picklist([
  'contacts',
  'companies',
  'deals',
  'orders',
  'metrics',
  'all',
])
export type SyncScopeValue = v.InferOutput<typeof syncScopeSchema>

export const syncInputSchema = v.object({
  /** defaults to orders for revenue connectors and all for channels */
  scope: v.optional(syncScopeSchema),
})

export const connectResponseSchema = v.object({
  connectionId: v.nullable(v.string()),
  authorizeUrl: v.nullable(v.string()),
})

export const syncResponseSchema = v.object({
  queued: v.boolean(),
  jobId: v.nullable(v.string()),
})

export const engineAuditLogSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  actor: v.string(),
  action: v.string(),
  entityType: v.nullable(v.string()),
  entityId: v.nullable(v.string()),
  before: v.nullable(v.record(v.string(), v.unknown())),
  after: v.nullable(v.record(v.string(), v.unknown())),
  reasoning: v.nullable(v.string()),
  evidence: v.record(v.string(), v.unknown()),
  autonomyLevel: v.nullable(v.number()),
  createdAt: v.string(),
})
export type EngineAuditLogDto = v.InferOutput<typeof engineAuditLogSchema>

export const ingestEventSchema = v.object({
  type: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  occurredAt: v.optional(v.string()),
  contactId: v.optional(v.nullable(v.string())),
  email: v.optional(v.nullable(v.string())),
  anonymousId: v.optional(v.nullable(v.string())),
  channelKey: v.optional(v.nullable(v.string())),
  campaignId: v.optional(v.nullable(v.string())),
  assetVariantId: v.optional(v.nullable(v.string())),
  experimentId: v.optional(v.nullable(v.string())),
  armId: v.optional(v.nullable(v.string())),
  source: v.optional(v.string()),
  sourceEventId: v.optional(v.nullable(v.string())),
  valueMinor: v.optional(v.nullable(v.number())),
  currency: v.optional(v.nullable(v.string())),
  properties: v.optional(v.record(v.string(), v.unknown())),
})
export type IngestEventInput = v.InferOutput<typeof ingestEventSchema>

export const ingestEventsInputSchema = v.object({
  events: v.pipe(v.array(ingestEventSchema), v.minLength(1), v.maxLength(500)),
})

export const ingestEventsResponseSchema = v.object({
  accepted: v.number(),
  duplicates: v.number(),
  ids: v.array(v.string()),
})

export const engineEventSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  contactId: v.nullable(v.string()),
  anonymousId: v.nullable(v.string()),
  type: v.string(),
  channelKey: v.nullable(v.string()),
  campaignId: v.nullable(v.string()),
  source: v.string(),
  sourceEventId: v.nullable(v.string()),
  valueMinor: v.nullable(v.number()),
  currency: v.nullable(v.string()),
  properties: v.record(v.string(), v.unknown()),
  occurredAt: v.string(),
  receivedAt: v.string(),
})
export type EngineEventDto = v.InferOutput<typeof engineEventSchema>

export const engineContactSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  companyId: v.nullable(v.string()),
  email: v.nullable(v.string()),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  jobTitle: v.nullable(v.string()),
  lifecycleStage: v.string(),
  upliftClass: v.nullable(v.string()),
  leadScore: v.nullable(v.number()),
  source: v.nullable(v.string()),
  lastActivityAt: v.nullable(v.string()),
  createdAt: v.string(),
})
export type EngineContactDto = v.InferOutput<typeof engineContactSchema>

export const engineOrderSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  contactId: v.nullable(v.string()),
  source: v.string(),
  externalId: v.string(),
  status: v.string(),
  currency: v.string(),
  revenueMinor: v.number(),
  costMinor: v.number(),
  feesMinor: v.number(),
  refundedMinor: v.number(),
  grossProfitMinor: v.number(),
  isFirstOrder: v.boolean(),
  occurredAt: v.string(),
})
export type EngineOrderDto = v.InferOutput<typeof engineOrderSchema>

/** command centre numbers; everything in workspace currency minor units */
export const dashboardSummarySchema = v.object({
  workspaceId: v.string(),
  currency: v.string(),
  period: v.object({ from: v.string(), to: v.string() }),
  grossProfit: v.object({
    thisWeekMinor: v.number(),
    lastWeekMinor: v.number(),
    /** null until holdout-backed measurement exists (phase 2) */
    incrementalThisWeekMinor: v.nullable(v.number()),
  }),
  revenue: v.object({ thisWeekMinor: v.number(), lastWeekMinor: v.number() }),
  orders: v.object({
    thisWeek: v.number(),
    lastWeek: v.number(),
    newCustomersThisWeek: v.number(),
  }),
  spend: v.object({ thisWeekMinor: v.number(), dailyCapMinor: v.nullable(v.number()) }),
  contacts: v.object({ total: v.number(), newThisWeek: v.number() }),
  deals: v.object({
    open: v.number(),
    openValueMinor: v.number(),
    wonThisWeek: v.number(),
  }),
  experiments: v.object({ running: v.number() }),
  approvals: v.object({ pending: v.number() }),
  learnings: v.array(
    v.object({
      id: v.string(),
      statement: v.string(),
      grade: v.string(),
      status: v.string(),
    }),
  ),
  llm: v.object({
    monthCostCents: v.number(),
    monthBudgetCents: v.number(),
    calls: v.number(),
  }),
  connections: v.array(
    v.object({
      provider: v.string(),
      status: v.string(),
      lastSyncAt: v.nullable(v.string()),
    }),
  ),
  alerts: v.array(
    v.object({
      id: v.string(),
      level: v.picklist(['info', 'warning', 'critical']),
      message: v.string(),
    }),
  ),
  /** global-holdout measurement for this week; null when the holdout rate is 0 */
  incremental: v.nullable(v.lazy(() => incrementalReportSchema)),
  /** last 28 days from engineMetricsDaily (channel 'all'), oldest first */
  trend: v.array(
    v.object({
      day: v.string(),
      revenueMinor: v.number(),
      grossProfitMinor: v.number(),
      conversions: v.number(),
      spendMinor: v.number(),
    }),
  ),
})
export type DashboardSummaryDto = v.InferOutput<typeof dashboardSummarySchema>

export const engineLlmCallSummarySchema = v.object({
  id: v.string(),
  agent: v.string(),
  tier: v.string(),
  model: v.string(),
  purpose: v.nullable(v.string()),
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.number(),
  costMicros: v.number(),
  latencyMs: v.number(),
  error: v.nullable(v.string()),
  createdAt: v.string(),
})
export type EngineLlmCallSummaryDto = v.InferOutput<typeof engineLlmCallSummarySchema>

/** query strings stay strings so the schema converts to json schema; pageLimit() parses */
export const paginatedQuerySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/))),
  cursor: v.optional(v.string()),
})

export function pageSchema<T extends v.GenericSchema>(item: T) {
  return v.object({
    items: v.array(item),
    nextCursor: v.nullable(v.string()),
  })
}

export const okSchema = v.object({ ok: v.literal(true) })

// --- phase 2: measure ----------------------------------------------------------
// numbers that can be undefined statistically (too few observations) are
// nullable: services must turn NaN / Infinity into null before returning.

export const liftVerdictSchema = v.picklist([
  'collecting',
  'positive',
  'negative',
  'inconclusive',
])
export type LiftVerdictValue = v.InferOutput<typeof liftVerdictSchema>

/** workspace-level incremental gross profit measured against the permanent holdout */
export const incrementalReportSchema = v.object({
  method: v.literal('global_holdout'),
  windowFrom: v.string(),
  windowTo: v.string(),
  currency: v.string(),
  holdoutRate: v.number(),
  treatedContacts: v.number(),
  holdoutContacts: v.number(),
  /** mean gross profit per contact in each group over the window */
  treatedMeanMinor: v.number(),
  holdoutMeanMinor: v.number(),
  /** (treated mean - holdout mean) x treated contacts, with a 95% interval */
  incrementalMinor: v.nullable(v.number()),
  ciLowMinor: v.nullable(v.number()),
  ciHighMinor: v.nullable(v.number()),
  pValue: v.nullable(v.number()),
  verdict: liftVerdictSchema,
  /** orders in the window that could not be tied to a contact */
  unattributedOrders: v.number(),
  note: v.string(),
})
export type IncrementalReportDto = v.InferOutput<typeof incrementalReportSchema>

export const incrementalQuerySchema = v.object({
  /** inclusive iso date (YYYY-MM-DD); defaults to the start of this week */
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  /** exclusive iso date; defaults to now */
  to: v.optional(v.pipe(v.string(), v.isoDate())),
})

export const experimentKindSchema = v.picklist(['ab', 'holdout'])
export const experimentStatusSchema = v.picklist([
  'draft',
  'running',
  'paused',
  'completed',
  'aborted',
])
export const experimentMetricSchema = v.picklist([
  'incremental_gross_profit',
  'conversion_rate',
])

export const experimentAudienceSchema = v.object({
  lifecycleStages: v.optional(v.array(v.string())),
  /** only contacts whose consent for this channel is not withdrawn */
  requireConsentChannel: v.optional(v.string()),
})

export const experimentArmInputSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  isControl: v.optional(v.boolean()),
  weight: v.optional(v.pipe(v.number(), v.minValue(0))),
  assetVariantId: v.optional(v.nullable(v.string())),
})

export const createExperimentInputSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2), v.maxLength(120)),
  kind: experimentKindSchema,
  successMetric: v.optional(experimentMetricSchema),
  channelKey: v.optional(v.nullable(v.string())),
  hypothesisId: v.optional(v.nullable(v.string())),
  campaignId: v.optional(v.nullable(v.string())),
  /** 0.02..0.5; holdout experiments need a holdout, a/b tests may use 0 */
  holdoutRate: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(0.5))),
  minSamplePerArm: v.optional(v.pipe(v.number(), v.integer(), v.minValue(30))),
  /** holdout kind: one treatment arm is created when omitted; ab kind needs at least two */
  arms: v.optional(v.array(experimentArmInputSchema)),
  audience: v.optional(experimentAudienceSchema),
  endsAt: v.optional(v.nullable(v.pipe(v.string(), v.isoTimestamp()))),
})

/** only draft experiments accept arm / holdout changes */
export const updateExperimentInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(120))),
  successMetric: v.optional(experimentMetricSchema),
  channelKey: v.optional(v.nullable(v.string())),
  holdoutRate: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(0.5))),
  minSamplePerArm: v.optional(v.pipe(v.number(), v.integer(), v.minValue(30))),
  arms: v.optional(v.array(experimentArmInputSchema)),
  audience: v.optional(experimentAudienceSchema),
  endsAt: v.optional(v.nullable(v.pipe(v.string(), v.isoTimestamp()))),
})

/** draft -> running (assigns the population), running <-> paused, -> completed | aborted */
export const transitionExperimentInputSchema = v.object({
  to: v.picklist(['running', 'paused', 'completed', 'aborted']),
  reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
})

export const experimentArmSchema = v.object({
  id: v.string(),
  name: v.string(),
  isControl: v.boolean(),
  weight: v.number(),
  assetVariantId: v.nullable(v.string()),
})

export const experimentGroupSchema = v.object({
  /** arm id, or 'holdout' */
  key: v.string(),
  label: v.string(),
  isHoldout: v.boolean(),
  isControl: v.boolean(),
  n: v.number(),
  conversions: v.number(),
  conversionRate: v.number(),
  grossProfitMinor: v.number(),
  meanGrossProfitMinor: v.number(),
  sdGrossProfitMinor: v.number(),
})

export const experimentComparisonSchema = v.object({
  treatmentKey: v.string(),
  baselineKey: v.string(),
  metric: v.picklist(['gross_profit_per_contact', 'conversion_rate']),
  /** absolute difference treatment - baseline (minor units per contact, or rate) */
  diff: v.number(),
  ciLow: v.nullable(v.number()),
  ciHigh: v.nullable(v.number()),
  relativeLift: v.nullable(v.number()),
  relativeCiLow: v.nullable(v.number()),
  relativeCiHigh: v.nullable(v.number()),
  pValue: v.nullable(v.number()),
  /** bayesian P(treatment > baseline); conversion metric only */
  probabilityBetter: v.nullable(v.number()),
  verdict: liftVerdictSchema,
  /** gross profit metric only: diff x treatment contacts */
  incrementalGrossProfitMinor: v.nullable(v.number()),
  incrementalCiLowMinor: v.nullable(v.number()),
  incrementalCiHighMinor: v.nullable(v.number()),
})

export const experimentResultSchema = v.object({
  computedAt: v.string(),
  windowFrom: v.string(),
  windowTo: v.string(),
  currency: v.string(),
  primaryMetric: experimentMetricSchema,
  groups: v.array(experimentGroupSchema),
  comparisons: v.array(experimentComparisonSchema),
  /** the comparison on the primary metric for the first treatment arm */
  primary: v.nullable(experimentComparisonSchema),
  srm: v.object({ chiSquare: v.number(), pValue: v.number(), mismatch: v.boolean() }),
  warnings: v.array(v.string()),
})
export type ExperimentResultDto = v.InferOutput<typeof experimentResultSchema>

export const engineExperimentSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  kind: v.string(),
  status: v.string(),
  successMetric: v.string(),
  channelKey: v.nullable(v.string()),
  hypothesisId: v.nullable(v.string()),
  campaignId: v.nullable(v.string()),
  holdoutRate: v.number(),
  minSamplePerArm: v.number(),
  audience: experimentAudienceSchema,
  startsAt: v.nullable(v.string()),
  endsAt: v.nullable(v.string()),
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  arms: v.array(experimentArmSchema),
  assignedCount: v.number(),
  result: v.nullable(experimentResultSchema),
})
export type EngineExperimentDto = v.InferOutput<typeof engineExperimentSchema>

export const experimentAssignmentQuerySchema = v.object({
  contactId: v.pipe(v.string(), v.minLength(1)),
})

export const experimentAssignmentSchema = v.object({
  experimentId: v.string(),
  contactId: v.string(),
  armId: v.nullable(v.string()),
  isHoldout: v.boolean(),
  /** true when the contact is in the permanent workspace holdout or outside the audience */
  excluded: v.boolean(),
  excludedReason: v.nullable(v.string()),
  assignedAt: v.nullable(v.string()),
})
export type ExperimentAssignmentDto = v.InferOutput<typeof experimentAssignmentSchema>

export const globalHoldoutStatusSchema = v.object({
  rate: v.number(),
  contactsTotal: v.number(),
  contactsHeldOut: v.number(),
})
export type GlobalHoldoutStatusDto = v.InferOutput<typeof globalHoldoutStatusSchema>

export const attributionModelSchema = v.picklist([
  'last_touch',
  'first_touch',
  'linear',
  'time_decay',
  'position_based',
])
export type AttributionModelValue = v.InferOutput<typeof attributionModelSchema>

export const attributionQuerySchema = v.object({
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  to: v.optional(v.pipe(v.string(), v.isoDate())),
  model: v.optional(attributionModelSchema),
  /** 1..90, default 30 */
  lookbackDays: v.optional(v.pipe(v.string(), v.regex(/^\d{1,2}$/))),
})

export const attributionFlagSchema = v.object({
  code: v.picklist([
    'platform_overclaims',
    'experiment_disagrees',
    'sign_mismatch',
    'no_incrementality_evidence',
  ]),
  level: v.picklist(['info', 'warning', 'critical']),
  message: v.string(),
})

const creditSchema = v.object({ conversions: v.number(), grossProfitMinor: v.number() })

export const attributionChannelSchema = v.object({
  channelKey: v.string(),
  spendMinor: v.number(),
  /** first-party credit under the requested model */
  firstParty: creditSchema,
  /** first-party credit under every model, keyed by model */
  byModel: v.record(v.string(), creditSchema),
  /** platform-reported numbers; null when the channel does not report them */
  platform: v.nullable(v.object({ conversions: v.number(), revenueMinor: v.number() })),
  /** holdout-backed incremental gross profit from experiments on this channel */
  experiment: v.nullable(
    v.object({
      experiments: v.number(),
      incrementalGrossProfitMinor: v.number(),
      ciLowMinor: v.nullable(v.number()),
      ciHighMinor: v.nullable(v.number()),
    }),
  ),
  /** media mix model contribution; phase 7 */
  mmm: v.nullable(
    v.object({
      contributionMinor: v.number(),
      ciLowMinor: v.nullable(v.number()),
      ciHighMinor: v.nullable(v.number()),
    }),
  ),
  flags: v.array(attributionFlagSchema),
})

export const attributionReportSchema = v.object({
  from: v.string(),
  to: v.string(),
  currency: v.string(),
  model: attributionModelSchema,
  lookbackDays: v.number(),
  totals: v.object({
    outcomes: v.number(),
    attributedOutcomes: v.number(),
    unattributedOutcomes: v.number(),
    grossProfitMinor: v.number(),
  }),
  channels: v.array(attributionChannelSchema),
})
export type AttributionReportDto = v.InferOutput<typeof attributionReportSchema>
export type AttributionChannelDto = v.InferOutput<typeof attributionChannelSchema>

export const metricsDailyQuerySchema = v.object({
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  to: v.optional(v.pipe(v.string(), v.isoDate())),
  channelKey: v.optional(v.string()),
})

export const metricsDailyRowSchema = v.object({
  day: v.string(),
  channelKey: v.string(),
  spendMinor: v.number(),
  impressions: v.number(),
  clicks: v.number(),
  conversions: v.number(),
  newCustomers: v.number(),
  revenueMinor: v.number(),
  grossProfitMinor: v.number(),
  unsubscribes: v.number(),
  complaints: v.number(),
  platformConversions: v.nullable(v.number()),
  platformRevenueMinor: v.nullable(v.number()),
  currency: v.string(),
  computedAt: v.string(),
})
export type MetricsDailyRowDto = v.InferOutput<typeof metricsDailyRowSchema>

export const metricsRollupInputSchema = v.object({
  from: v.optional(v.pipe(v.string(), v.isoDate())),
  to: v.optional(v.pipe(v.string(), v.isoDate())),
})

export const metricsRollupResponseSchema = v.object({
  days: v.number(),
  rows: v.number(),
})
