import { assertDemoAuthFlagsSafe } from '../../../src/features/auth/server/assertDemoAuthFlagsSafe'

/** Throw if production deploy env enables demo auth / demo UI flags. */
export function assertProdAuthFlags(): void {
  assertDemoAuthFlagsSafe({
    isRealProduction: true,
    allowDemoAuth: process.env.ALLOW_DEMO_AUTH ?? '',
    viteDemoMode: process.env.VITE_DEMO_MODE ?? '',
  })
}
