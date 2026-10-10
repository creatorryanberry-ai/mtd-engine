import { enterUserDbContext, runWithUserDbContextAsync } from '@mtd/database'
import { getAuthDataFromRequest } from '@mtd/better-auth-utils/server'
import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineMembership, engineWorkspace } from '~/database/engineSchema'
import { authServer } from '~/features/auth/server/authServer'

import { isEngineRole, roleAtLeast } from '../roles'

import type { EngineRole, EngineWorkspace } from '~/database/engineSchema'
import type { AuthData } from '~/features/auth/types'

// pure role helpers live in core/roles.ts so unit tests can import them without the db
export { isEngineRole, roleAtLeast }

export type WorkspaceAccess = {
  auth: AuthData
  workspace: EngineWorkspace
  role: EngineRole
  membershipId: string
}

function unauthorized(message = 'Unauthorized', status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** authenticate the request and bind the db context to the user (RLS) */
export async function requireEngineAuth(request: Request): Promise<AuthData> {
  const authData = await getAuthDataFromRequest(authServer, request)
  if (!authData?.id) throw unauthorized()
  enterUserDbContext(authData.id)
  return authData
}

/**
 * resolve the acting user's membership for a workspace and enforce a minimum
 * role. the workspace id always comes from the route, never the body.
 */
export async function requireWorkspaceAccess(
  request: Request,
  workspaceId: string,
  minimumRole: EngineRole = 'viewer',
): Promise<WorkspaceAccess> {
  const auth = await requireEngineAuth(request)
  return requireWorkspaceAccessForUser(auth, workspaceId, minimumRole)
}

export async function requireWorkspaceAccessForUser(
  auth: AuthData,
  workspaceId: string,
  minimumRole: EngineRole = 'viewer',
): Promise<WorkspaceAccess> {
  const [row] = await drizzle
    .select({
      membershipId: engineMembership.id,
      role: engineMembership.role,
      workspace: engineWorkspace,
    })
    .from(engineMembership)
    .innerJoin(engineWorkspace, eq(engineWorkspace.id, engineMembership.workspaceId))
    .where(
      and(
        eq(engineMembership.workspaceId, workspaceId),
        eq(engineMembership.userId, auth.id),
      ),
    )
    .limit(1)

  if (!row) throw unauthorized('Workspace not found', 404)
  if (!roleAtLeast(row.role, minimumRole)) {
    throw unauthorized(`Requires ${minimumRole} role`, 403)
  }
  return {
    auth,
    workspace: row.workspace,
    role: row.role,
    membershipId: row.membershipId,
  }
}

/**
 * enterWith inside an awaited callee never reaches the caller's continuation,
 * so route handlers bind their body to the user explicitly with run() here.
 */
export async function withEngineAuth<T>(
  request: Request,
  fn: (auth: AuthData) => Promise<T>,
): Promise<T> {
  const auth = await requireEngineAuth(request)
  return runWithUserDbContextAsync(auth.id, () => fn(auth))
}

export async function withWorkspaceAccess<T>(
  request: Request,
  workspaceId: string,
  minimumRole: EngineRole,
  fn: (access: WorkspaceAccess) => Promise<T>,
): Promise<T> {
  const access = await requireWorkspaceAccess(request, workspaceId, minimumRole)
  return runWithUserDbContextAsync(access.auth.id, () => fn(access))
}

/** refuse autonomous actions while the workspace kill switch is on */
export function assertNotKilled(workspace: EngineWorkspace) {
  if (workspace.killSwitch) {
    throw unauthorized('Workspace kill switch is on', 423)
  }
}
