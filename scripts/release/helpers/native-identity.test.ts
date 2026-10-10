import { describe, expect, it } from 'vitest'

import {
  androidPackageId,
  iosLiveActivityDirName,
  requireStoreVariant,
} from './android-autolinking'
import { BUNDLE_IDS } from './env'

describe('native identity', () => {
  it('maps store variants to reverse-dns bundle ids', () => {
    expect(androidPackageId('preview')).toBe('tax.straightup.preview')
    expect(androidPackageId('production')).toBe('tax.straightup.app')
    expect(BUNDLE_IDS.preview.ios).toBe('tax.straightup.preview')
    expect(BUNDLE_IDS.production.android).toBe('tax.straightup.app')
  })

  it('maps live activity directory stems', () => {
    expect(iosLiveActivityDirName('preview')).toBe('StraightUpTaxPreviewLiveActivity')
    expect(iosLiveActivityDirName('production')).toBe('StraightUpTaxLiveActivity')
  })

  it('rejects development and unset variants', () => {
    expect(() => requireStoreVariant('development')).toThrow(/preview or production/)
    expect(() => requireStoreVariant(undefined)).toThrow(/unset/)
    expect(() => androidPackageId('development')).toThrow(/no \.dev identity/)
  })
})
