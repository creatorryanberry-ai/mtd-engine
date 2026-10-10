import type { Page } from '@playwright/test'

import { DEMO_EMAIL, DEMO_OTP } from '~/constants/app'
import { ports } from '~/env'

const BASE_URL = `http://localhost:${ports.web}`

const defaultBusinessSetup = {
  businessName: 'Demo Business',
  businessStartDate: '2020-04-06',
  businessDescription: 'General contracting services',
  businessType: 'self-employed',
  cisRegistered: false,
  vehicleClaimMethod: 'mileage',
} as const

export async function completeBusinessSetup(page: Page) {
  const result = await page.evaluate(
    async ({ baseUrl, payload }) => {
      const response = await fetch(`${baseUrl}/api/users/business-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })

      if (!response.ok) {
        const text = await response.text()
        return { ok: false, status: response.status, text }
      }

      return { ok: true, status: response.status }
    },
    { baseUrl: BASE_URL, payload: defaultBusinessSetup },
  )

  if (!result.ok) {
    throw new Error(
      `Failed to complete business setup (${result.status}): ${'text' in result ? result.text : 'unknown error'}`,
    )
  }
}

export async function gotoAndWaitForApp(page: Page, pathname: string) {
  await page.goto(`${BASE_URL}${pathname}`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  })
  await page.waitForLoadState('networkidle')
}

export async function loginAsDemo(page: Page, pathname = '/') {
  console.info('Logging in as demo user via OTP...')

  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'commit' })

  const result = await page.evaluate(
    async ({ baseUrl, email, otp }) => {
      const headers = { 'Content-Type': 'application/json' }

      for (let attempt = 0; attempt < 5; attempt++) {
        const send = await fetch(`${baseUrl}/api/auth/email-otp/send-verification-otp`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, type: 'sign-in' }),
          credentials: 'include',
        })
        if (!send.ok) {
          await new Promise((r) => setTimeout(r, 500))
          continue
        }

        const signIn = await fetch(`${baseUrl}/api/auth/sign-in/email-otp`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ email, otp }),
          credentials: 'include',
        })
        if (signIn.ok) return { step: 'sign-in', status: signIn.status, attempt }

        await new Promise((r) => setTimeout(r, 500))
      }

      return { step: 'failed', status: 0, error: true as const, attempt: 5 }
    },
    { baseUrl: BASE_URL, email: DEMO_EMAIL, otp: DEMO_OTP },
  )

  if ('error' in result && result.error) {
    throw new Error(`Demo login failed after ${result.attempt} attempts`)
  }

  console.info(
    `✅ Logged in via ${result.step} (status: ${result.status})${result.attempt ? ` (attempt ${result.attempt + 1})` : ''}`,
  )

  const target =
    pathname !== '/' && pathname !== '/home' && pathname !== '/home/feed'
      ? pathname
      : '/home/feed'

  await gotoAndWaitForApp(page, target)
  await completeBusinessSetup(page)
  await gotoAndWaitForApp(page, target)
}
