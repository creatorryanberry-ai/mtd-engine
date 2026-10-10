import { ENGINE_ROLES } from '~/database/engineSchema'

import type { EngineRole } from '~/database/engineSchema'

/** lower index = more power */
export const ROLE_RANK: Record<EngineRole, number> = {
  owner: 0,
  admin: 1,
  marketer: 2,
  approver: 3,
  viewer: 4,
}

export function roleAtLeast(role: EngineRole, minimum: EngineRole) {
  return ROLE_RANK[role] <= ROLE_RANK[minimum]
}

export function isEngineRole(value: unknown): value is EngineRole {
  return typeof value === 'string' && (ENGINE_ROLES as readonly string[]).includes(value)
}
