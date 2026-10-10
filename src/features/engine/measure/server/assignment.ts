import { createHash } from 'node:crypto'

import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineAssignment,
  engineConsent,
  engineContact,
  engineExperiment,
  engineExperimentArm,
  engineWorkspace,
} from '~/database/engineSchema'
import { newId } from '~/features/engine/core/ids'
import { httpError } from '~/features/engine/core/server/httpError'
import { isInGlobalHoldout, pickArm } from '~/features/engine/measure/stats'

import type { ExperimentAssignmentDto } from '~/features/engine/contract'
import type { ArmWeight } from '~/features/engine/measure/stats'

export const ASSIGNMENT_BATCH_SIZE = 1000

/** consent states that allow contact on a channel */
export const CONSENTING_STATUSES = ['granted', 'soft_optin', 'corporate_subscriber']

export type ExclusionReason = 'global_holdout' | 'audience' | 'consent'
export type ExclusionCounts = Record<ExclusionReason, number>

export type ExperimentAudience = {
  lifecycleStages?: string[]
  requireConsentChannel?: string
}

export type AssignmentCandidate = {
  id: string
  hashBucket: number
  lifecycleStage: string
  /** consent status for the audience channel; null when none is recorded or required */
  consentStatus: string | null
}

export type EligibilityRules = {
  globalHoldoutRate: number
  audience: ExperimentAudience
}

/** uniform draw in [0,1) from sha-256 of salt and contact id; never changes for a contact */
export function drawFor(salt: string, contactId: string) {
  const digest = createHash('sha256').update(`${salt}:${contactId}`).digest()
  return digest.readUInt32BE(0) / 2 ** 32
}

export function exclusionReason(
  candidate: AssignmentCandidate,
  rules: EligibilityRules,
): ExclusionReason | null {
  if (isInGlobalHoldout(candidate.hashBucket, rules.globalHoldoutRate)) {
    return 'global_holdout'
  }
  const stages = rules.audience.lifecycleStages
  if (stages && stages.length > 0 && !stages.includes(candidate.lifecycleStage)) {
    return 'audience'
  }
  if (
    rules.audience.requireConsentChannel &&
    !(candidate.consentStatus && CONSENTING_STATUSES.includes(candidate.consentStatus))
  ) {
    return 'consent'
  }
  return null
}

/** first hash bucket outside the global holdout, so sql can filter on hashBucket < threshold */
export function globalHoldoutThreshold(globalHoldoutRate: number) {
  let lo = 0
  let hi = 10_000
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (isInGlobalHoldout(mid, globalHoldoutRate)) lo = mid + 1
    else hi = mid
  }
  return lo
}

type StoredArm = { id: string; weight: number; config: Record<string, unknown> }

function armPosition(arm: StoredArm) {
  const position = arm.config.position
  return typeof position === 'number' ? position : Number.MAX_SAFE_INTEGER
}

/** arms in the order they were defined; pickArm walks them cumulatively so order must be stable */
export function sortArms<T extends StoredArm>(arms: T[]): T[] {
  return [...arms].sort(
    (a, b) => armPosition(a) - armPosition(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}

export type AssignmentContext = {
  experimentId: string
  workspaceId: string
  status: string
  holdoutRate: number
  salt: string
  rules: EligibilityRules
  arms: ArmWeight[]
}

export async function loadAssignmentContext(
  experimentId: string,
): Promise<AssignmentContext> {
  const [row] = await drizzle
    .select({
      id: engineExperiment.id,
      workspaceId: engineExperiment.workspaceId,
      status: engineExperiment.status,
      holdoutRate: engineExperiment.holdoutRate,
      salt: engineExperiment.assignmentSalt,
      audience: engineExperiment.audience,
      globalHoldoutRate: engineWorkspace.globalHoldoutRate,
    })
    .from(engineExperiment)
    .innerJoin(engineWorkspace, eq(engineWorkspace.id, engineExperiment.workspaceId))
    .where(eq(engineExperiment.id, experimentId))
    .limit(1)
  if (!row) throw httpError(404, 'Experiment not found')

  const arms = await drizzle
    .select({
      id: engineExperimentArm.id,
      weight: engineExperimentArm.weight,
      config: engineExperimentArm.config,
    })
    .from(engineExperimentArm)
    .where(eq(engineExperimentArm.experimentId, experimentId))

  return {
    experimentId: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    holdoutRate: row.holdoutRate,
    salt: row.salt,
    rules: { globalHoldoutRate: row.globalHoldoutRate, audience: row.audience },
    arms: sortArms(arms).map((arm) => ({ id: arm.id, weight: arm.weight })),
  }
}

/** contacts with their consent for the audience channel, optionally only those not yet assigned */
async function selectCandidates(
  ctx: AssignmentContext,
  options: {
    afterId?: string
    contactId?: string
    unassignedOnly: boolean
    limit: number
  },
): Promise<AssignmentCandidate[]> {
  const channel = ctx.rules.audience.requireConsentChannel
  return drizzle
    .select({
      id: engineContact.id,
      hashBucket: engineContact.hashBucket,
      lifecycleStage: engineContact.lifecycleStage,
      consentStatus: engineConsent.status,
    })
    .from(engineContact)
    .leftJoin(
      engineConsent,
      channel
        ? and(
            eq(engineConsent.contactId, engineContact.id),
            eq(engineConsent.channel, channel),
            or(isNull(engineConsent.expiresAt), gt(engineConsent.expiresAt, sql`now()`)),
          )
        : sql`false`,
    )
    .leftJoin(
      engineAssignment,
      and(
        eq(engineAssignment.experimentId, ctx.experimentId),
        eq(engineAssignment.contactId, engineContact.id),
      ),
    )
    .where(
      and(
        eq(engineContact.workspaceId, ctx.workspaceId),
        options.afterId ? gt(engineContact.id, options.afterId) : undefined,
        options.contactId ? eq(engineContact.id, options.contactId) : undefined,
        options.unassignedOnly ? isNull(engineAssignment.id) : undefined,
      ),
    )
    .orderBy(asc(engineContact.id))
    .limit(options.limit)
}

/** walk every unassigned contact of the workspace in keyset batches */
async function scanUnassigned(
  ctx: AssignmentContext,
  onBatch: (batch: AssignmentCandidate[]) => Promise<void>,
) {
  let afterId: string | undefined
  for (;;) {
    const batch = await selectCandidates(ctx, {
      afterId,
      unassignedOnly: true,
      limit: ASSIGNMENT_BATCH_SIZE,
    })
    if (batch.length === 0) return
    await onBatch(batch)
    if (batch.length < ASSIGNMENT_BATCH_SIZE) return
    afterId = batch[batch.length - 1]!.id
  }
}

function emptyExclusions(): ExclusionCounts {
  return { global_holdout: 0, audience: 0, consent: 0 }
}

function assignmentValues(ctx: AssignmentContext, contactId: string) {
  const pick = pickArm(drawFor(ctx.salt, contactId), ctx.holdoutRate, ctx.arms)
  return {
    id: newId('asg'),
    workspaceId: ctx.workspaceId,
    experimentId: ctx.experimentId,
    contactId,
    armId: pick.armId,
    isHoldout: pick.isHoldout,
  }
}

export type PopulationSummary = {
  assigned: number
  excluded: number
  excludedByReason: ExclusionCounts
}

/** assign every eligible contact not yet in the experiment; existing assignments never move */
export async function assignPopulation(experimentId: string): Promise<PopulationSummary> {
  const ctx = await loadAssignmentContext(experimentId)
  if (ctx.arms.length === 0) throw httpError(409, 'Experiment has no arms')

  let assigned = 0
  const excludedByReason = emptyExclusions()
  await scanUnassigned(ctx, async (batch) => {
    const values = []
    for (const candidate of batch) {
      const reason = exclusionReason(candidate, ctx.rules)
      if (reason) excludedByReason[reason] += 1
      else values.push(assignmentValues(ctx, candidate.id))
    }
    if (values.length === 0) return
    const inserted = await drizzle
      .insert(engineAssignment)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: engineAssignment.id })
    assigned += inserted.length
  })

  const excluded =
    excludedByReason.global_holdout + excludedByReason.audience + excludedByReason.consent
  return { assigned, excluded, excludedByReason }
}

/** contacts currently kept out of the experiment, by reason */
export async function countExclusions(experimentId: string): Promise<ExclusionCounts> {
  const ctx = await loadAssignmentContext(experimentId)
  const counts = emptyExclusions()
  await scanUnassigned(ctx, async (batch) => {
    for (const candidate of batch) {
      const reason = exclusionReason(candidate, ctx.rules)
      if (reason) counts[reason] += 1
    }
  })
  return counts
}

async function findAssignment(experimentId: string, contactId: string) {
  const [row] = await drizzle
    .select({
      armId: engineAssignment.armId,
      isHoldout: engineAssignment.isHoldout,
      assignedAt: engineAssignment.assignedAt,
    })
    .from(engineAssignment)
    .where(
      and(
        eq(engineAssignment.experimentId, experimentId),
        eq(engineAssignment.contactId, contactId),
      ),
    )
    .limit(1)
  return row ?? null
}

/** the contact's group; assigns on read only while the experiment runs and the contact is eligible */
export async function getOrAssign(
  experimentId: string,
  contactId: string,
): Promise<ExperimentAssignmentDto> {
  const ctx = await loadAssignmentContext(experimentId)
  const unassigned = {
    experimentId,
    contactId,
    armId: null,
    isHoldout: false,
    excluded: false,
    excludedReason: null,
    assignedAt: null,
  }

  const existing = await findAssignment(experimentId, contactId)
  if (existing) return { ...unassigned, ...existing }

  const [candidate] = await selectCandidates(ctx, {
    contactId,
    unassignedOnly: false,
    limit: 1,
  })
  if (!candidate) throw httpError(404, 'Contact not found')

  const reason = exclusionReason(candidate, ctx.rules)
  if (reason) return { ...unassigned, excluded: true, excludedReason: reason }
  if (ctx.status !== 'running' || ctx.arms.length === 0) return unassigned

  await drizzle
    .insert(engineAssignment)
    .values(assignmentValues(ctx, contactId))
    .onConflictDoNothing()
  const created = await findAssignment(experimentId, contactId)
  return created ? { ...unassigned, ...created } : unassigned
}
