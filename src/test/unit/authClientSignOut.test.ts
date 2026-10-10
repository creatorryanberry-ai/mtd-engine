import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('auth client sign-out wiring', () => {
  it('clears expo cookie storage as part of local auth reset', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/features/auth/client/authClient.ts'),
      'utf-8',
    )

    expect(src).toMatch(/onClearAuth/)
    expect(src).toMatch(/clearExpoAuthStorage/)
    expect(src).toMatch(/resetAuthPlugins/)
  })
})
