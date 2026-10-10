import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('StepPageLayout back button', () => {
  it('pins the native back control to the top safe area, outside the scroll view', () => {
    const step = readFileSync(
      resolve(process.cwd(), 'src/interface/pages/StepPageLayout.tsx'),
      'utf-8',
    )
    const base = readFileSync(
      resolve(process.cwd(), 'src/interface/pages/BaseStepPageLayout.tsx'),
      'utf-8',
    )

    expect(step).toMatch(/useSafeAreaInsets/)
    expect(step).toMatch(/header=\{/)
    expect(base).toMatch(/header\?:/)
    expect(base).toMatch(/androidHeaderOffset=\{false\}/)

    const headerRender = base.indexOf('{header}')
    const scroll = base.indexOf('<ScrollView')
    expect(headerRender).toBeGreaterThan(0)
    expect(scroll).toBeGreaterThan(headerRender)

    const flexed = base.indexOf('<EnsureFlexed')
    const children = base.lastIndexOf('{children}')
    expect(flexed).toBeGreaterThan(children)
  })
})
