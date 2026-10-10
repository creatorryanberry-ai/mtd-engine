import { describe, expect, it } from 'vitest'

import { serveApiDocsLogin } from '~/server/serveApiDocsLogin'

describe('serveApiDocsLogin', () => {
  it('serves the login page for /login', async () => {
    const res = await serveApiDocsLogin(
      new Request('https://staging-api.straightup.tax/login'),
    )
    expect(res?.status).toBe(200)
    expect(res!.headers.get('content-type')).toContain('text/html')
    const html = await res!.text()
    expect(html).toContain('Sign in with Google')
    expect(html).toContain('href="/docs"')
  })

  it('returns null for other paths and methods', async () => {
    expect(
      await serveApiDocsLogin(new Request('https://staging-api.straightup.tax/docs')),
    ).toBeNull()
    expect(
      await serveApiDocsLogin(
        new Request('https://staging-api.straightup.tax/login', {
          method: 'POST',
        }),
      ),
    ).toBeNull()
  })
})
