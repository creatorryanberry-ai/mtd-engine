import { describe, expect, it } from 'vitest'

import { getContrastingTextColor } from '~/features/mtd/utils/contrastTextColor'

describe('getContrastingTextColor', () => {
  it('uses light text on dark backgrounds', () => {
    expect(getContrastingTextColor('#00539F')).toBe('#FFFFFF')
  })

  it('uses light text on red backgrounds', () => {
    expect(getContrastingTextColor('#B91C1C')).toBe('#FFFFFF')
    expect(getContrastingTextColor('#D21F32')).toBe('#FFFFFF')
  })

  it('uses dark text on light backgrounds', () => {
    expect(getContrastingTextColor('#FFD500')).toBe('#111827')
    expect(getContrastingTextColor('#FF9900')).toBe('#111827')
  })

  it('falls back to light text for invalid colors', () => {
    expect(getContrastingTextColor('not-a-color')).toBe('#FFFFFF')
  })
})
