import { timingSafeEqual } from 'node:crypto'

import { isVercelPreviewHost } from '~/features/auth/server/isVercelPreviewHost'

export const VERCEL_SEED_PATH = '/api/__vercel/seed'

let running: Promise<unknown> | null = null

function tokenMatches(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/**
 * private vercel previews only: seeds the demo workspace from the api function,
 * which runs next to the database (a build machine elsewhere would take hours
 * over the network). needs ENGINE_SEED_EMAIL and ENGINE_SEED_TOKEN, and the
 * deployment must sit on *.vercel.app behind vercel authentication.
 */
export async function handleVercelDemoSeed(url: URL) {
  const env = process.env
  const onPreview = isVercelPreviewHost({
    betterAuthUrl: env.BETTER_AUTH_URL ?? '',
    apiServerUrl: env.API_SERVER_URL ?? '',
  })
  if (!onPreview || !env.ENGINE_SEED_EMAIL || !env.ENGINE_SEED_TOKEN) {
    return json(404, { error: 'not found' })
  }
  if (!tokenMatches(url.searchParams.get('token'), env.ENGINE_SEED_TOKEN)) {
    return json(403, { error: 'forbidden' })
  }
  if (running) return json(409, { error: 'a seed is already running' })

  const startedAt = Date.now()
  try {
    const { seedEngineDemo } =
      await import('~/features/engine/seed/server/seedEngineDemo')
    running = seedEngineDemo({ email: env.ENGINE_SEED_EMAIL })
    await running
    return json(200, { ok: true, seconds: Math.round((Date.now() - startedAt) / 1000) })
  } finally {
    running = null
  }
}
