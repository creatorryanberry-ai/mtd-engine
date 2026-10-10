import { randomBytes } from 'node:crypto'

import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineAssignment,
  engineCampaign,
  engineContact,
  engineExperiment,
  engineExperimentArm,
  engineHypothesis,
} from '~/database/engineSchema'
import { newId } from '~/features/engine/core/ids'
import { userActor, writeAudit } from '~/features/engine/core/server/audit'
import { httpError } from '~/features/engine/core/server/httpError'
import { assertNotKilled } from '~/features/engine/core/server/workspaceAccess'
import {
  assignPopulation,
  getOrAssign,
  globalHoldoutThreshold,
  sortArms,
} from '~/features/engine/measure/server/assignment'
import {
  parseStoredResult,
  refreshExperimentResult,
} from '~/features/engine/measure/server/results'

import type { EngineWorkspace } from '~/database/engineSchema'
import type {
  createExperimentInputSchema,
  EngineExperimentDto,
  ExperimentAssignmentDto,
  experimentArmInputSchema,
  ExperimentResultDto,
  GlobalHoldoutStatusDto,
  transitionExperimentInputSchema,
  updateExperimentInputSchema,
} from '~/features/engine/contract'
import type { AuditActor } from '~/features/engine/core/server/audit'
import type * as v from 'valibot'

export type CreateExperimentInput = v.InferOutput<typeof createExperimentInputSchema>
export type UpdateExperimentInput = v.InferOutput<typeof updateExperimentInputSchema>
export type TransitionExperimentInput = v.InferOutput<
  typeof transitionExperimentInputSchema
>
type ArmInput = v.InferOutput<typeof experimentArmInputSchema>

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'aborted'
export type ExperimentKind = 'ab' | 'holdout'

/** the only moves an experiment can make; completed and aborted are terminal */
export const EXPERIMENT_TRANSITIONS: Record<
  ExperimentStatus,
  readonly ExperimentStatus[]
> = {
  draft: ['running', 'aborted'],
  running: ['paused', 'completed', 'aborted'],
  paused: ['running', 'completed', 'aborted'],
  completed: [],
  aborted: [],
}

export function isExperimentStatus(value: string): value is ExperimentStatus {
  return Object.hasOwn(EXPERIMENT_TRANSITIONS, value)
}

export function canTransition(from: string, to: string) {
  return isExperimentStatus(from) && isExperimentStatus(to)
    ? EXPERIMENT_TRANSITIONS[from].includes(to)
    : false
}

export const MIN_HOLDOUT_RATE = 0.02
const DEFAULT_HOLDOUT_RATE = 0.1
const DEFAULT_MIN_SAMPLE = 200

export type NormalizedArm = {
  name: string
  isControl: boolean
  weight: number
  assetVariantId: string | null
}

/** holdout kind: one treatment arm by default. ab kind: two or more arms, exactly one control */
export function normalizeArms(
  kind: string,
  arms: ArmInput[] | undefined,
): NormalizedArm[] {
  const normalized = (arms ?? []).map((arm) => ({
    name: arm.name.trim(),
    isControl: arm.isControl ?? false,
    weight: arm.weight ?? 1,
    assetVariantId: arm.assetVariantId ?? null,
  }))

  if (kind === 'holdout') {
    if (normalized.length === 0) {
      return [{ name: 'Treatment', isControl: false, weight: 1, assetVariantId: null }]
    }
    if (normalized.every((arm) => arm.isControl)) {
      throw httpError(400, 'A holdout experiment needs at least one treatment arm')
    }
  } else if (kind === 'ab') {
    if (normalized.length < 2) throw httpError(400, 'An a/b test needs at least two arms')
    const controls = normalized.filter((arm) => arm.isControl).length
    if (controls > 1) throw httpError(400, 'An a/b test has exactly one control arm')
    if (controls === 0) normalized[0]!.isControl = true
  } else {
    throw httpError(400, `Unsupported experiment kind ${kind}`)
  }

  if (normalized.reduce((acc, arm) => acc + arm.weight, 0) <= 0) {
    throw httpError(400, 'At least one arm needs a positive weight')
  }
  return normalized
}

/** holdout kind needs a real holdout; a/b tests may skip it (0) or use one of at least 2% */
export function resolveHoldoutRate(kind: string, rate: number | undefined) {
  const resolved = rate ?? (kind === 'holdout' ? DEFAULT_HOLDOUT_RATE : 0)
  if (kind === 'holdout' && resolved < MIN_HOLDOUT_RATE) {
    throw httpError(
      400,
      `A holdout experiment needs a holdout rate of at least ${MIN_HOLDOUT_RATE}`,
    )
  }
  if (resolved > 0 && resolved < MIN_HOLDOUT_RATE) {
    throw httpError(400, `Holdout rate must be 0 or at least ${MIN_HOLDOUT_RATE}`)
  }
  return resolved
}

type ExperimentRow = typeof engineExperiment.$inferSelect
type ArmRow = typeof engineExperimentArm.$inferSelect

function armValues(workspaceId: string, experimentId: string, arms: NormalizedArm[]) {
  return arms.map((arm, position) => ({
    id: newId('arm'),
    workspaceId,
    experimentId,
    name: arm.name,
    isControl: arm.isControl,
    weight: arm.weight,
    assetVariantId: arm.assetVariantId,
    config: { position },
  }))
}

async function loadArms(experimentIds: string[]) {
  const byExperiment = new Map<string, ArmRow[]>()
  if (experimentIds.length === 0) return byExperiment
  const rows = await drizzle
    .select()
    .from(engineExperimentArm)
    .where(inArray(engineExperimentArm.experimentId, experimentIds))
  for (const row of rows) {
    const list = byExperiment.get(row.experimentId) ?? []
    list.push(row)
    byExperiment.set(row.experimentId, list)
  }
  for (const [id, list] of byExperiment) byExperiment.set(id, sortArms(list))
  return byExperiment
}

async function assignedCounts(experimentIds: string[]) {
  const counts = new Map<string, number>()
  if (experimentIds.length === 0) return counts
  const rows = await drizzle
    .select({ experimentId: engineAssignment.experimentId, total: count() })
    .from(engineAssignment)
    .where(inArray(engineAssignment.experimentId, experimentIds))
    .groupBy(engineAssignment.experimentId)
  for (const row of rows) counts.set(row.experimentId, row.total)
  return counts
}

function toDto(
  row: ExperimentRow,
  arms: ArmRow[],
  assignedCount: number,
): EngineExperimentDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    kind: row.kind,
    status: row.status,
    successMetric: row.successMetric,
    channelKey: row.channelKey,
    hypothesisId: row.hypothesisId,
    campaignId: row.campaignId,
    holdoutRate: row.holdoutRate,
    minSamplePerArm: row.minSamplePerArm,
    audience: row.audience,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    arms: arms.map((arm) => ({
      id: arm.id,
      name: arm.name,
      isControl: arm.isControl,
      weight: arm.weight,
      assetVariantId: arm.assetVariantId,
    })),
    assignedCount,
    result: parseStoredResult(row.result),
  }
}

function toAudit(row: ExperimentRow, arms: ArmRow[]): Record<string, unknown> {
  return {
    name: row.name,
    kind: row.kind,
    status: row.status,
    successMetric: row.successMetric,
    channelKey: row.channelKey,
    holdoutRate: row.holdoutRate,
    minSamplePerArm: row.minSamplePerArm,
    audience: row.audience,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    arms: arms.map((arm) => ({
      id: arm.id,
      name: arm.name,
      isControl: arm.isControl,
      weight: arm.weight,
    })),
  }
}

function resultAudit(result: ExperimentResultDto): Record<string, unknown> {
  return {
    computedAt: result.computedAt,
    groups: result.groups.map((group) => ({
      key: group.key,
      n: group.n,
      conversions: group.conversions,
      grossProfitMinor: group.grossProfitMinor,
    })),
    primary: result.primary
      ? {
          metric: result.primary.metric,
          diff: result.primary.diff,
          ciLow: result.primary.ciLow,
          ciHigh: result.primary.ciHigh,
          verdict: result.primary.verdict,
        }
      : null,
    srmMismatch: result.srm.mismatch,
  }
}

async function requireExperimentRow(workspaceId: string, experimentId: string) {
  const [row] = await drizzle
    .select()
    .from(engineExperiment)
    .where(
      and(
        eq(engineExperiment.id, experimentId),
        eq(engineExperiment.workspaceId, workspaceId),
      ),
    )
    .limit(1)
  if (!row) throw httpError(404, 'Experiment not found')
  return row
}

async function experimentDto(row: ExperimentRow): Promise<EngineExperimentDto> {
  const [arms, counts] = await Promise.all([loadArms([row.id]), assignedCounts([row.id])])
  return toDto(row, arms.get(row.id) ?? [], counts.get(row.id) ?? 0)
}

export async function listExperiments(
  workspaceId: string,
): Promise<EngineExperimentDto[]> {
  const rows = await drizzle
    .select()
    .from(engineExperiment)
    .where(eq(engineExperiment.workspaceId, workspaceId))
    .orderBy(desc(engineExperiment.createdAt), desc(engineExperiment.id))
  const ids = rows.map((row) => row.id)
  const [arms, counts] = await Promise.all([loadArms(ids), assignedCounts(ids)])
  return rows.map((row) => toDto(row, arms.get(row.id) ?? [], counts.get(row.id) ?? 0))
}

export async function getExperiment(
  workspaceId: string,
  experimentId: string,
): Promise<EngineExperimentDto> {
  return experimentDto(await requireExperimentRow(workspaceId, experimentId))
}

async function assertBelongsToWorkspace(
  workspaceId: string,
  input: { hypothesisId?: string | null; campaignId?: string | null },
) {
  if (input.hypothesisId) {
    const [row] = await drizzle
      .select({ id: engineHypothesis.id })
      .from(engineHypothesis)
      .where(
        and(
          eq(engineHypothesis.id, input.hypothesisId),
          eq(engineHypothesis.workspaceId, workspaceId),
        ),
      )
      .limit(1)
    if (!row) throw httpError(400, 'Hypothesis not found in this workspace')
  }
  if (input.campaignId) {
    const [row] = await drizzle
      .select({ id: engineCampaign.id })
      .from(engineCampaign)
      .where(
        and(
          eq(engineCampaign.id, input.campaignId),
          eq(engineCampaign.workspaceId, workspaceId),
        ),
      )
      .limit(1)
    if (!row) throw httpError(400, 'Campaign not found in this workspace')
  }
}

export async function createExperiment(
  workspace: EngineWorkspace,
  userId: string,
  input: CreateExperimentInput,
  ipAddress: string | null = null,
): Promise<EngineExperimentDto> {
  const arms = normalizeArms(input.kind, input.arms)
  const holdoutRate = resolveHoldoutRate(input.kind, input.holdoutRate)
  await assertBelongsToWorkspace(workspace.id, input)

  const id = newId('exp')
  const created = await drizzle.transaction(async (tx) => {
    const [row] = await tx
      .insert(engineExperiment)
      .values({
        id,
        workspaceId: workspace.id,
        name: input.name.trim(),
        kind: input.kind,
        successMetric: input.successMetric ?? 'incremental_gross_profit',
        channelKey: input.channelKey ?? null,
        hypothesisId: input.hypothesisId ?? null,
        campaignId: input.campaignId ?? null,
        holdoutRate,
        minSamplePerArm: input.minSamplePerArm ?? DEFAULT_MIN_SAMPLE,
        audience: input.audience ?? {},
        assignmentSalt: randomBytes(16).toString('hex'),
        endsAt: input.endsAt ?? null,
        createdBy: userId,
      })
      .returning()
    const armRows = await tx
      .insert(engineExperimentArm)
      .values(armValues(workspace.id, id, arms))
      .returning()
    return row ? { row, arms: sortArms(armRows) } : null
  })
  if (!created) throw httpError(500, 'Experiment not created')

  await writeAudit({
    workspaceId: workspace.id,
    actor: userActor(userId),
    action: 'experiment.create',
    entityType: 'experiment',
    entityId: id,
    after: toAudit(created.row, created.arms),
    reasoning: `${input.kind} experiment created by user`,
    ipAddress,
  })
  return toDto(created.row, created.arms, 0)
}

const DRAFT_ONLY_FIELDS = ['arms', 'holdoutRate', 'audience', 'successMetric'] as const

export async function updateExperiment(
  workspace: EngineWorkspace,
  userId: string,
  experimentId: string,
  input: UpdateExperimentInput,
  ipAddress: string | null = null,
): Promise<EngineExperimentDto> {
  const before = await requireExperimentRow(workspace.id, experimentId)
  const beforeArms = (await loadArms([experimentId])).get(experimentId) ?? []

  const draftOnly = DRAFT_ONLY_FIELDS.filter((field) => input[field] !== undefined)
  if (draftOnly.length > 0 && before.status !== 'draft') {
    throw httpError(
      409,
      `${draftOnly.join(', ')} can only change while the experiment is a draft`,
    )
  }
  const terminal = before.status === 'completed' || before.status === 'aborted'
  if (terminal && (input.minSamplePerArm !== undefined || input.endsAt !== undefined)) {
    throw httpError(
      409,
      `A ${before.status} experiment only accepts name and channel changes`,
    )
  }

  const patch: Partial<typeof engineExperiment.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.channelKey !== undefined) patch.channelKey = input.channelKey
  if (input.successMetric !== undefined) patch.successMetric = input.successMetric
  if (input.minSamplePerArm !== undefined) patch.minSamplePerArm = input.minSamplePerArm
  if (input.audience !== undefined) patch.audience = input.audience
  if (input.endsAt !== undefined) patch.endsAt = input.endsAt
  if (input.holdoutRate !== undefined) {
    patch.holdoutRate = resolveHoldoutRate(before.kind, input.holdoutRate)
  }
  const arms = input.arms ? normalizeArms(before.kind, input.arms) : null

  const after = await drizzle.transaction(async (tx) => {
    const [row] = await tx
      .update(engineExperiment)
      .set(patch)
      .where(
        and(
          eq(engineExperiment.id, experimentId),
          eq(engineExperiment.workspaceId, workspace.id),
          eq(engineExperiment.status, before.status),
        ),
      )
      .returning()
    if (!row) return null
    if (arms) {
      await tx
        .delete(engineExperimentArm)
        .where(eq(engineExperimentArm.experimentId, experimentId))
      await tx
        .insert(engineExperimentArm)
        .values(armValues(workspace.id, experimentId, arms))
    }
    return row
  })
  if (!after) throw httpError(409, 'Experiment changed while updating; reload and retry')

  const afterArms = arms
    ? ((await loadArms([experimentId])).get(experimentId) ?? [])
    : beforeArms
  await writeAudit({
    workspaceId: workspace.id,
    actor: userActor(userId),
    action: 'experiment.update',
    entityType: 'experiment',
    entityId: experimentId,
    before: toAudit(before, beforeArms),
    after: toAudit(after, afterArms),
    reasoning: 'experiment updated by user',
    ipAddress,
  })
  return experimentDto(after)
}

export async function transitionExperiment(input: {
  workspace: EngineWorkspace
  experimentId: string
  to: TransitionExperimentInput['to']
  reason?: string
  actor: AuditActor
  ipAddress?: string | null
  now?: Date
}): Promise<EngineExperimentDto> {
  const { workspace, experimentId, to } = input
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const before = await requireExperimentRow(workspace.id, experimentId)

  if (!canTransition(before.status, to)) {
    throw httpError(409, `A ${before.status} experiment cannot move to ${to}`)
  }
  if (to === 'running') {
    assertNotKilled(workspace)
    if (before.endsAt && Date.parse(before.endsAt) <= now.getTime()) {
      throw httpError(
        409,
        'The experiment end date has passed; move endsAt before running',
      )
    }
    const arms = (await loadArms([experimentId])).get(experimentId) ?? []
    if (arms.length === 0) throw httpError(409, 'Experiment has no arms')
  }

  const patch: Partial<typeof engineExperiment.$inferInsert> = {
    status: to,
    updatedAt: nowIso,
  }
  if (to === 'running' && !before.startsAt) patch.startsAt = nowIso
  // closing the window keeps later refreshes from counting outcomes after the end
  if (
    (to === 'completed' || to === 'aborted') &&
    (!before.endsAt || Date.parse(before.endsAt) > now.getTime())
  ) {
    patch.endsAt = nowIso
  }

  const [updated] = await drizzle
    .update(engineExperiment)
    .set(patch)
    .where(
      and(
        eq(engineExperiment.id, experimentId),
        eq(engineExperiment.workspaceId, workspace.id),
        eq(engineExperiment.status, before.status),
      ),
    )
    .returning()
  if (!updated)
    throw httpError(409, 'Experiment changed while updating; reload and retry')

  const population = to === 'running' ? await assignPopulation(experimentId) : null
  const result =
    to === 'completed' ? await refreshExperimentResult(experimentId, now) : null

  await writeAudit({
    workspaceId: workspace.id,
    actor: input.actor,
    action: 'experiment.transition',
    entityType: 'experiment',
    entityId: experimentId,
    before: { status: before.status, startsAt: before.startsAt, endsAt: before.endsAt },
    after: {
      status: to,
      startsAt: patch.startsAt ?? before.startsAt,
      endsAt: patch.endsAt ?? before.endsAt,
      ...(population ? { population } : {}),
      ...(result ? { result: resultAudit(result) } : {}),
    },
    reasoning: input.reason?.trim() || `experiment moved from ${before.status} to ${to}`,
    ipAddress: input.ipAddress ?? null,
  })

  return getExperiment(workspace.id, experimentId)
}

/** user-triggered recompute; the hourly job audits its own runs as system:analyst */
export async function refreshExperiment(
  workspace: EngineWorkspace,
  userId: string,
  experimentId: string,
  ipAddress: string | null = null,
): Promise<ExperimentResultDto> {
  const before = await requireExperimentRow(workspace.id, experimentId)
  const result = await refreshExperimentResult(experimentId)
  const previous = parseStoredResult(before.result)
  await writeAudit({
    workspaceId: workspace.id,
    actor: userActor(userId),
    action: 'experiment.refresh',
    entityType: 'experiment',
    entityId: experimentId,
    before: previous ? resultAudit(previous) : null,
    after: resultAudit(result),
    reasoning: 'experiment result recomputed on request',
    ipAddress,
  })
  return result
}

export async function getAssignment(
  workspaceId: string,
  experimentId: string,
  contactId: string,
): Promise<ExperimentAssignmentDto> {
  await requireExperimentRow(workspaceId, experimentId)
  return getOrAssign(experimentId, contactId)
}

export async function getGlobalHoldoutStatus(
  workspace: EngineWorkspace,
): Promise<GlobalHoldoutStatusDto> {
  const threshold = globalHoldoutThreshold(workspace.globalHoldoutRate)
  const [row] = await drizzle
    .select({
      total: count(),
      heldOut: count(
        sql`case when ${engineContact.hashBucket} < ${threshold} then 1 end`,
      ),
    })
    .from(engineContact)
    .where(eq(engineContact.workspaceId, workspace.id))
  return {
    rate: workspace.globalHoldoutRate,
    contactsTotal: row?.total ?? 0,
    contactsHeldOut: row?.heldOut ?? 0,
  }
}
