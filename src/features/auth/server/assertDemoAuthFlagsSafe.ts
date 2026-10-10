function isTruthyFlag(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/** Throws if real production has demo auth / demo UI flags enabled. */
export function assertDemoAuthFlagsSafe(opts: {
  isRealProduction: boolean
  allowDemoAuth: string
  viteDemoMode: string
}): void {
  if (!opts.isRealProduction) return

  const blockers: string[] = []
  if (isTruthyFlag(opts.allowDemoAuth)) blockers.push('ALLOW_DEMO_AUTH')
  if (isTruthyFlag(opts.viteDemoMode)) blockers.push('VITE_DEMO_MODE')
  if (blockers.length === 0) return

  throw new Error(
    `demo auth flags must be off in production:\n` +
      blockers.map((k) => `  - ${k}`).join('\n') +
      `\nset them empty/off for production deploys (staging may keep them on).`,
  )
}
