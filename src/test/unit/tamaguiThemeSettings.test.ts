import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { config } from '~/tamagui/tamagui.config'

describe('tamagui theme settings', () => {
  it('does not emit OS prefers-color-scheme overrides', () => {
    expect(config.settings.shouldAddPrefersColorThemes).toBe(false)
  })

  it('does not ship prefers-color-scheme rules in the generated css', () => {
    const cssPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../tamagui/tamagui.css',
    )
    const css = readFileSync(cssPath, 'utf8')
    expect(css).not.toContain('prefers-color-scheme')
  })
})
