import { randomBytes } from 'node:crypto'

import { desc, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineAutonomySettings,
  engineBrand,
  engineBrandKit,
  engineChannel,
  engineGuardrail,
  engineMembership,
  engineWorkspace,
} from '~/database/engineSchema'

import { newId, slugify } from '../ids'
import { userActor, writeAudit } from './audit'
import { httpError } from './httpError'
import { withRlsBypass } from './rlsBypass'

import type { EngineRole, EngineWorkspace } from '~/database/engineSchema'

export const DEFAULT_CHANNELS = [
  { key: 'stripe', kind: 'revenue', displayName: 'Stripe' },
  { key: 'hubspot', kind: 'sales', displayName: 'HubSpot' },
  { key: 'email', kind: 'owned', displayName: 'Email' },
  { key: 'meta_ads', kind: 'paid', displayName: 'Meta Ads' },
  { key: 'linkedin_organic', kind: 'organic', displayName: 'LinkedIn (organic)' },
  { key: 'outbound_email', kind: 'sales', displayName: 'Outbound email' },
] as const

/** outbound keeps mandatory human review of the first messages per sequence */
const OUTBOUND_REVIEW_COUNT = 200
export const DEFAULT_DAILY_SPEND_CAP_MINOR = 10_000

export type CreateWorkspaceInput = {
  name: string
  currency?: string
  timezone?: string
  dataRegion?: 'uk' | 'eu'
}

export type UpdateWorkspaceInput = {
  name?: string
  currency?: string
  timezone?: string
  llmBudgetMonthlyCents?: number
  mediaBudgetMonthlyCents?: number
  killSwitch?: boolean
  globalHoldoutRate?: number
}

export type WorkspaceWithRole = EngineWorkspace & { role: EngineRole }

export async function listWorkspacesForUser(
  userId: string,
): Promise<WorkspaceWithRole[]> {
  const rows = await drizzle
    .select({ workspace: engineWorkspace, role: engineMembership.role })
    .from(engineMembership)
    .innerJoin(engineWorkspace, eq(engineWorkspace.id, engineMembership.workspaceId))
    .where(eq(engineMembership.userId, userId))
    .orderBy(desc(engineWorkspace.createdAt))
  return rows.map((row) => ({ ...row.workspace, role: row.role }))
}

export async function getWorkspace(workspaceId: string): Promise<EngineWorkspace | null> {
  const [row] = await drizzle
    .select()
    .from(engineWorkspace)
    .where(eq(engineWorkspace.id, workspaceId))
    .limit(1)
  return row ?? null
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || 'workspace'
  const [taken] = await drizzle
    .select({ id: engineWorkspace.id })
    .from(engineWorkspace)
    .where(eq(engineWorkspace.slug, base))
    .limit(1)
  return taken ? `${base}-${randomBytes(3).toString('hex')}` : base
}

/**
 * create a workspace and everything a fresh tenant needs: the owner membership,
 * default channels with autonomy at level 0, a spend cap and a default brand.
 */
export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
  ipAddress: string | null = null,
): Promise<WorkspaceWithRole> {
  const name = input.name.trim()
  const currency = (input.currency ?? 'GBP').toUpperCase()
  const timezone = input.timezone ?? 'Europe/London'
  const dataRegion = input.dataRegion ?? 'uk'

  // the workspace policy needs a membership that cannot exist before the row, so bootstrap bypasses rls
  const workspace = await withRlsBypass(userId, async () => {
    const slug = await uniqueSlug(name)
    const workspaceId = newId('ws')
    const brandId = newId('br')

    return drizzle.transaction(async (tx) => {
      const [created] = await tx
        .insert(engineWorkspace)
        .values({
          id: workspaceId,
          name,
          slug,
          currency,
          timezone,
          dataRegion,
          createdBy: userId,
        })
        .returning()

      await tx.insert(engineMembership).values({
        id: newId('mem'),
        workspaceId,
        userId,
        role: 'owner',
        invitedBy: null,
      })

      await tx.insert(engineChannel).values(
        DEFAULT_CHANNELS.map((channel) => ({
          id: newId('ch'),
          workspaceId,
          key: channel.key,
          kind: channel.kind,
          displayName: channel.displayName,
        })),
      )

      await tx.insert(engineAutonomySettings).values(
        DEFAULT_CHANNELS.map((channel) => ({
          id: newId('oas'),
          workspaceId,
          channelKey: channel.key,
          level: 0,
          maxLevel: channel.key === 'outbound_email' ? 2 : 1,
          mandatoryReviewCount:
            channel.key === 'outbound_email' ? OUTBOUND_REVIEW_COUNT : 0,
        })),
      )

      await tx.insert(engineGuardrail).values({
        id: newId('gr'),
        workspaceId,
        kind: 'spend_cap',
        channelKey: null,
        name: 'Daily spend cap',
        config: { dailyCapMinor: DEFAULT_DAILY_SPEND_CAP_MINOR, currency },
        action: 'block',
      })

      await tx.insert(engineBrand).values({
        id: brandId,
        workspaceId,
        name,
        isDefault: true,
      })

      await tx.insert(engineBrandKit).values({
        id: newId('bk'),
        workspaceId,
        brandId,
        version: 1,
      })

      return created!
    })
  })

  await writeAudit({
    workspaceId: workspace.id,
    actor: userActor(userId),
    action: 'workspace.create',
    entityType: 'workspace',
    entityId: workspace.id,
    after: toAuditShape(workspace),
    reasoning: 'workspace created by user',
    ipAddress,
  })

  return { ...workspace, role: 'owner' }
}

export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  input: UpdateWorkspaceInput,
  ipAddress: string | null = null,
): Promise<EngineWorkspace> {
  const before = await getWorkspace(workspaceId)
  if (!before) throw httpError(404, 'Workspace not found')

  const patch: Partial<typeof engineWorkspace.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.currency !== undefined) patch.currency = input.currency.toUpperCase()
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.llmBudgetMonthlyCents !== undefined) {
    patch.llmBudgetMonthlyCents = input.llmBudgetMonthlyCents
  }
  if (input.mediaBudgetMonthlyCents !== undefined) {
    patch.mediaBudgetMonthlyCents = input.mediaBudgetMonthlyCents
  }
  if (input.killSwitch !== undefined) patch.killSwitch = input.killSwitch
  if (input.globalHoldoutRate !== undefined) {
    patch.globalHoldoutRate = Math.min(Math.max(input.globalHoldoutRate, 0), 0.5)
  }

  const [after] = await drizzle
    .update(engineWorkspace)
    .set(patch)
    .where(eq(engineWorkspace.id, workspaceId))
    .returning()
  if (!after) throw httpError(404, 'Workspace not found')

  await writeAudit({
    workspaceId,
    actor: userActor(userId),
    action:
      before.killSwitch !== after.killSwitch
        ? 'workspace.kill_switch'
        : before.globalHoldoutRate !== after.globalHoldoutRate
          ? 'workspace.global_holdout'
          : 'workspace.update',
    entityType: 'workspace',
    entityId: workspaceId,
    before: toAuditShape(before),
    after: toAuditShape(after),
    reasoning:
      before.globalHoldoutRate !== after.globalHoldoutRate
        ? 'global holdout rate changed: contacts move between treated and holdout, so incremental measurement restarts from this point'
        : 'workspace settings updated by user',
    ipAddress,
  })

  return after
}

function toAuditShape(workspace: EngineWorkspace): Record<string, unknown> {
  return {
    name: workspace.name,
    currency: workspace.currency,
    timezone: workspace.timezone,
    dataRegion: workspace.dataRegion,
    llmBudgetMonthlyCents: workspace.llmBudgetMonthlyCents,
    mediaBudgetMonthlyCents: workspace.mediaBudgetMonthlyCents,
    killSwitch: workspace.killSwitch,
    globalHoldoutRate: workspace.globalHoldoutRate,
  }
}
