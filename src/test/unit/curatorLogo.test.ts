import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('curator logo', () => {
  it('keeps the wordmark inside its box on android', () => {
    const logo = readSrc('src/features/mtd/components/CuratorLogo.tsx')
    const splash = readSrc('src/interface/splash/splash.tsx')
    const config = readSrc('app.config.ts')

    expect(logo).toMatch(/from '~\/constants\/app'/)
    expect(logo).toMatch(/\{APP_NAME\}/)
    expect(logo).not.toMatch(/^\s+Curat\s*$/m)
    expect(logo).not.toMatch(/^\s+MTD\s*$/m)
    expect(logo).toMatch(/paddingHorizontal: 6/)
    expect(logo).toMatch(/overflow: 'visible'/)
    expect(splash).toMatch(/overflow: 'visible'/)
    expect(splash).toMatch(/Dimensions\.get\('window'\)\.width - 48/)
    expect(config).toMatch(/splash-logo-square\.png/)
  })
})
