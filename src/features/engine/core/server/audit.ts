import { drizzle } from '~/database/db'
import { engineAuditLog } from '~/database/engineSchema'

import { newId } from '../ids'

export type AuditActor = `user:${string}` | `system:${string}` | `connector:${string}`

export type AuditEntry = {
  workspaceId: string
  actor: AuditActor
  action: string
  entityType?: string
  entityId?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  reasoning?: string
  evidence?: Record<string, unknown>
  autonomyLevel?: number
  ipAddress?: string | null
}

/** append-only; failures are logged but never block the action they describe */
export async function writeAudit(entry: AuditEntry) {
  const id = newId('aud')
  try {
    await drizzle.insert(engineAuditLog).values({
      id,
      workspaceId: entry.workspaceId,
      actor: entry.actor,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      reasoning: entry.reasoning ?? null,
      evidence: entry.evidence ?? {},
      autonomyLevel: entry.autonomyLevel ?? null,
      ipAddress: entry.ipAddress ?? null,
    })
  } catch (error) {
    console.error('[engine:audit] failed to write audit entry', entry.action, error)
  }
  return id
}

export function userActor(userId: string): AuditActor {
  return `user:${userId}`
}

export function systemActor(agent: string): AuditActor {
  return `system:${agent}`
}

export function requestIp(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  )
}
