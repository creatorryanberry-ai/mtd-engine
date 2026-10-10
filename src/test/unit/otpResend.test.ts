import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { shouldAutoVerifyOtp } from '~/features/auth/client/otpSubmit'

describe('shouldAutoVerifyOtp', () => {
  it('verifies a complete code', () => {
    expect(shouldAutoVerifyOtp('123456', false)).toBe(true)
  })

  it('does not verify while a resend is in flight', () => {
    expect(shouldAutoVerifyOtp('123456', true)).toBe(false)
  })

  it('does not verify an incomplete code', () => {
    expect(shouldAutoVerifyOtp('12345', false)).toBe(false)
    expect(shouldAutoVerifyOtp('', false)).toBe(false)
  })
})

describe('otp resend page', () => {
  it('does not reuse verify loading for resend', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'app/(app)/auth/signup/otp.tsx'),
      'utf-8',
    )

    expect(src).toMatch(/setResending\(true\)/)
    expect(src).toMatch(/setVerifying\(true\)/)
    expect(src).toMatch(/verifying \? 'Verifying\.\.\.' : 'Next'/)
    expect(src).toMatch(/resending \? 'Sending\.\.\.' : 'Resend code'/)
    expect(src).toMatch(/shouldAutoVerifyOtp\(otpCode, resending\)/)
    expect(src.indexOf('testID="resend-otp-button"')).toBeGreaterThan(
      src.indexOf('<KeyboardStickyFooter'),
    )
  })
})
