import { describe, expect, it } from 'vitest'

import { APP_NAME } from '~/constants/app'
import { buildHmrcFraudHeaders } from '~/features/hmrc/server/fraudHeaders'

describe('buildHmrcFraudHeaders', () => {
  it('sets Straight Up Tax as the HMRC vendor product name', () => {
    const headers = buildHmrcFraudHeaders(
      { appVersion: '1.2.3' },
      new Request('http://localhost'),
    )

    expect(headers['Gov-Vendor-Product-Name']).toBe(APP_NAME)
    expect(headers['Gov-Vendor-Product-Name']).toBe('Straight Up Tax')
    expect(headers['Gov-Vendor-Version']).toBe('1.2.3')
    expect(headers['Gov-Vendor-Forwarded']).toBe('by=Straight-Up-Tax')
  })
})
