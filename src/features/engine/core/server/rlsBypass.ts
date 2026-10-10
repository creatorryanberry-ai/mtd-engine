import { enterBypassRlsContext, runWithUserDbContextAsync } from '@mtd/database'

/**
 * run fn with RLS bypassed without leaking bypass to the caller: run() scopes a
 * fresh store to fn and the synchronous enterWith inside flips only that store.
 * only for steps that cannot pass the membership policy even for a legitimate
 * member (bootstrapping a workspace, touching other members' rows); callers
 * must have already verified access with requireWorkspaceAccess.
 */
export async function withRlsBypass<T>(
  actingUserId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithUserDbContextAsync(actingUserId, async () => {
    enterBypassRlsContext()
    return fn()
  })
}
