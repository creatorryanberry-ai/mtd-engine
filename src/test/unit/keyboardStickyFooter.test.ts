import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('keyboard sticky footer', () => {
  it('insets floating actions and paints the bar without a keyboard gap', () => {
    const native = readSrc('src/interface/keyboard/KeyboardStickyFooter.native.tsx')
    const layout = readSrc('src/interface/pages/BaseStepPageLayout.tsx')

    expect(native).toMatch(/px="\$4"/)
    expect(native).toMatch(/useReanimatedKeyboardAnimation/)
    expect(native).toMatch(/FOOTER_HEIGHT/)
    expect(native).toMatch(/justify="center"/)
    expect(native).toMatch(/position: 'absolute'/)
    expect(native).toMatch(/withAlpha/)
    expect(native).toMatch(/BlurView/)
    expect(native).toMatch(/Platform\.OS === 'android' \? wash : 'transparent'/)
    expect(native).not.toMatch(/paddingBottom: bottom/)
    expect(native).not.toMatch(/offset \|\| -bottom/)
    expect(layout).not.toMatch(/b=\{0\} l=\{0\} r=\{0\} px="\$4"/)
  })
})
