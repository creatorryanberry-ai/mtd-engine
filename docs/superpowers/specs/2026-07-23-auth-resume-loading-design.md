# Auth resume: keep screen + spinner overlay

## Goal

Stop the flash of "Loading..." when leaving and returning to the app. Keep the current screen visible while auth revalidates. When a true cold-start loading gate is needed, show a centered spinner overlay instead of replacing the tree with text.

## Problem

`app/(app)/_layout.tsx` unmounts the app and renders `Loading...` whenever `auth.state === 'loading'`. On resume, better-auth's session subscription briefly sets `isPending`, and `createAuthClient` maps that to `state: 'loading'` even when `session`/`user` are already in memory — so the whole UI flashes.

## Decisions

1. **Soft-revalidate in `@mtd/better-auth-utils`**
   - If `isPending` **and** in-memory `session` + `user` → keep `logged-in`.
   - If `isPending` **and** already `logged-out` with **no** persisted session token → keep `logged-out` (do not flip to `loading`; that was wiping auth nav on resume).
   - Cold start with a persisted token / no in-memory user → still `loading`.
   - Failed confirmations after retries → still `logged-out` (unchanged).

2. **Harden `AppLayout` gate**
   - Blocking spinner only on **first** unresolved load (`loading && !user && !authReady`).
   - Once auth has resolved once, never unmount children for a background refetch.

3. **Loading UI = overlay + spinner**
   - Replace the plain `Loading...` text with a full-screen overlay (semi-transparent / brand-neutral) and a centered Tamagui `Spinner`.
   - Children are not mounted during cold-start load (same as today for the gate), but the visible affordance is a spinner, not copy.
   - Optional: if we later want children under the overlay, that can be a follow-up; out of scope now because cold start has nothing useful to show underneath.

## Non-goals

- Changing splash animation / `PlatformSpecificRootProvider` behavior beyond continuing to wait on non-`loading` auth for hide timing
- Reworking auth retry / offline toast behavior
- Web-only SSR loading patterns

## Files

- `packages/better-auth-utils/src/createAuthClient.ts` — soft-revalidate state
- `app/(app)/_layout.tsx` — gate condition + spinner overlay

## Success

- Background → foreground while logged in: no flash, current screen stays up
- Background → foreground on auth email screen: stay on email form (no "Invalid authentication method")
- Fresh launch with session: spinner overlay until session resolves (or splash covers it), then app
- Logged-out / expired session after retries: still lands on auth as today
