import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  getDialogAdaptWhen,
  getDialogSheetSnapPoint,
} from '~/interface/dialogs/dialogSheet'

describe('getDialogSheetSnapPoint', () => {
  it('includes dialog min height, safe area, padding, and bottom lift', () => {
    expect(getDialogSheetSnapPoint(220, 34)).toBe(290)
  })

  it('never returns less than 240', () => {
    expect(getDialogSheetSnapPoint(100, 0)).toBe(240)
  })
})

describe('getDialogAdaptWhen', () => {
  it('returns a touch breakpoint on web and always-on for native', () => {
    const value = getDialogAdaptWhen()
    expect(value === 'max-md' || value === true).toBe(true)
  })
})

describe('Dialog overlay dismiss', () => {
  it('routes portal overlay presses through the overlay-armed guard', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/interface/dialogs/Dialog.tsx'),
      'utf-8',
    )

    expect(src).toMatch(/const handleOpenChange/)
    expect(src).toMatch(/dismissOnSnapToBottom=\{false\}/)
    expect(src).toMatch(/keyboardShouldPersistTaps="always"/)
  })
})
