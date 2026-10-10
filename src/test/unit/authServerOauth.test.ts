import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const authServerSrc = readFileSync(
  resolve(process.cwd(), 'src/features/auth/server/authServer.ts'),
  'utf-8',
)

describe('auth server native oauth', () => {
  it('passes BETTER_AUTH_URL as better-auth baseURL', () => {
    // vite SSR skips createEnv.apply(), so process.env.BETTER_AUTH_URL is unset
    // and better-auth would otherwise derive origin from each request.
    expect(authServerSrc).toMatch(/baseURL:\s*server\.BETTER_AUTH_URL/)
  })

  it('skips the signed oauth state cookie check', () => {
    // google's callback runs in ASWebAuthenticationSession, which does not
    // send the signed better-auth.state cookie set before the provider redirect.
    expect(authServerSrc).toMatch(/skipStateCookieCheck:\s*true/)
  })
})
