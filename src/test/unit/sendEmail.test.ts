import { describe, expect, it } from 'vitest'

import { isUsablePostmarkToken } from '~/features/email/server/sendEmail'

describe('isUsablePostmarkToken', () => {
  it('rejects empty and example placeholder tokens', () => {
    expect(isUsablePostmarkToken('')).toBe(false)
    expect(isUsablePostmarkToken('   ')).toBe(false)
    expect(isUsablePostmarkToken('your-postmark-server-token')).toBe(false)
  })

  it('accepts a real Postmark server token', () => {
    expect(isUsablePostmarkToken('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true)
  })
})
