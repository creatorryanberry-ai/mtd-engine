import { and, asc, count, eq, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineMembership } from '~/database/engineSchema'
import { user } from '~/database/schema'

import { newId, normalizeEmail } from '../ids'
import { userActor, writeAudit } from './audit'
import { httpError } from './httpError'
import { withRlsBypass } from './rlsBypass'

import type { EngineRole } from '~/database/engineSchema'

export type MemberListItem = {
  id: string
  workspaceId: string
  userId: string
  role: EngineRole
  email: string | null
  name: string | null
  createdAt: string
}

const memberColumns = {
  id: engineMembership.id,
  workspaceId: engineMembership.workspaceId,
  userId: engineMembership.userId,
  role: engineMembership.role,
  email: user.email,
  name: user.name,
  createdAt: engineMembership.createdAt,
}

/** actingUserId must already have passed requireWorkspaceAccess for this workspace */
export async function listMembers(
  workspaceId: string,
  actingUserId: string,
): Promise<MemberListItem[]> {
  // the membership policy only exposes the caller's own row, so listing colleagues runs under bypass
  return withRlsBypass(actingUserId, () =>
    drizzle
      .select(memberColumns)
      .from(engineMembership)
      .innerJoin(user, eq(user.id, engineMembership.userId))
      .where(eq(engineMembership.workspaceId, workspaceId))
      .orderBy(asc(engineMembership.createdAt)),
  )
}

async function getMemberRow(workspaceId: string, memberId: string) {
  const [row] = await drizzle
    .select(memberColumns)
    .from(engineMembership)
    .innerJoin(user, eq(user.id, engineMembership.userId))
    .where(
      and(
        eq(engineMembership.id, memberId),
        eq(engineMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1)
  return row ?? null
}

async function countOwners(workspaceId: string) {
  const [row] = await drizzle
    .select({ total: count() })
    .from(engineMembership)
    .where(
      and(
        eq(engineMembership.workspaceId, workspaceId),
        eq(engineMembership.role, 'owner'),
      ),
    )
  return row?.total ?? 0
}

export async function addMemberByEmail(
  workspaceId: string,
  actingUserId: string,
  input: { email: string; role: EngineRole },
  ipAddress: string | null = null,
): Promise<MemberListItem> {
  const normalized = normalizeEmail(input.email)
  if (!normalized) throw httpError(400, 'Invalid email')

  // other users' membership rows and the user lookup sit outside the caller's own-row policy
  const member = await withRlsBypass(actingUserId, async () => {
    const [target] = await drizzle
      .select({ id: user.id })
      .from(user)
      .where(or(eq(user.normalizedEmail, normalized), eq(user.email, normalized)))
      .limit(1)
    if (!target) throw httpError(404, 'No user with that email')

    const [existing] = await drizzle
      .select({ id: engineMembership.id })
      .from(engineMembership)
      .where(
        and(
          eq(engineMembership.workspaceId, workspaceId),
          eq(engineMembership.userId, target.id),
        ),
      )
      .limit(1)
    if (existing) throw httpError(409, 'Already a member')

    const id = newId('mem')
    await drizzle.insert(engineMembership).values({
      id,
      workspaceId,
      userId: target.id,
      role: input.role,
      invitedBy: actingUserId,
    })
    const row = await getMemberRow(workspaceId, id)
    if (!row) throw httpError(500, 'Membership not created')
    return row
  })

  await writeAudit({
    workspaceId,
    actor: userActor(actingUserId),
    action: 'membership.add',
    entityType: 'membership',
    entityId: member.id,
    after: { userId: member.userId, role: member.role },
    reasoning: `added ${normalized} as ${input.role}`,
    ipAddress,
  })

  return member
}

export async function updateMemberRole(
  workspaceId: string,
  actingUserId: string,
  memberId: string,
  role: EngineRole,
  ipAddress: string | null = null,
): Promise<MemberListItem> {
  const { before, after } = await withRlsBypass(actingUserId, async () => {
    const current = await getMemberRow(workspaceId, memberId)
    if (!current) throw httpError(404, 'Member not found')

    if (
      current.role === 'owner' &&
      role !== 'owner' &&
      (await countOwners(workspaceId)) <= 1
    ) {
      throw httpError(409, 'Cannot demote the last owner')
    }

    await drizzle
      .update(engineMembership)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(engineMembership.id, memberId))
    const updated = await getMemberRow(workspaceId, memberId)
    if (!updated) throw httpError(404, 'Member not found')
    return { before: current, after: updated }
  })

  await writeAudit({
    workspaceId,
    actor: userActor(actingUserId),
    action: 'membership.update_role',
    entityType: 'membership',
    entityId: memberId,
    before: { userId: before.userId, role: before.role },
    after: { userId: after.userId, role: after.role },
    reasoning: `role changed from ${before.role} to ${after.role}`,
    ipAddress,
  })

  return after
}

export async function removeMember(
  workspaceId: string,
  actingUserId: string,
  memberId: string,
  ipAddress: string | null = null,
): Promise<void> {
  const removed = await withRlsBypass(actingUserId, async () => {
    const current = await getMemberRow(workspaceId, memberId)
    if (!current) throw httpError(404, 'Member not found')
    if (current.role === 'owner' && (await countOwners(workspaceId)) <= 1) {
      throw httpError(409, 'Cannot remove the last owner')
    }
    await drizzle.delete(engineMembership).where(eq(engineMembership.id, memberId))
    return current
  })

  await writeAudit({
    workspaceId,
    actor: userActor(actingUserId),
    action: 'membership.remove',
    entityType: 'membership',
    entityId: memberId,
    before: { userId: removed.userId, role: removed.role },
    reasoning: 'member removed from workspace',
    ipAddress,
  })
}
