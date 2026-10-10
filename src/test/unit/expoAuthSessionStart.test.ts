import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('expo social auth session', () => {
  it('opens the provider authorize url so ios names google.com not the api host', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'node_modules/@better-auth/expo/dist/client.js'),
      'utf-8',
    )

    expect(src).toMatch(/openAuthSessionAsync\(signInURL/)
    expect(src).not.toMatch(/openAuthSessionAsync\(proxyURL/)
  })
})
