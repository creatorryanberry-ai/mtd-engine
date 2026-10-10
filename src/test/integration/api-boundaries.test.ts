import { expect, test } from '@playwright/test'

import { DEMO_EMAIL, DEMO_OTP } from '~/constants/app'
import { ports } from '~/env'
import { getQuarterForDate, getTaxYearForDate } from '~/features/mtd/utils/quarterPeriods'

const BASE_URL = `http://localhost:${ports.web}`

const businessSetup = {
  businessName: 'Demo Boundary Biz',
  businessStartDate: '2020-04-06',
  businessDescription: 'Boundary testing',
  businessType: 'self-employed',
  cisRegistered: false,
  vehicleClaimMethod: 'mileage',
} as const

async function signInDemo(request: import('@playwright/test').APIRequestContext) {
  const send = await request.post(
    `${BASE_URL}/api/auth/email-otp/send-verification-otp`,
    {
      data: { email: DEMO_EMAIL, type: 'sign-in' },
    },
  )
  expect(send.ok()).toBeTruthy()

  const signIn = await request.post(`${BASE_URL}/api/auth/sign-in/email-otp`, {
    data: { email: DEMO_EMAIL, otp: DEMO_OTP },
  })
  expect(signIn.ok()).toBeTruthy()
  const body = await signIn.json()
  expect(typeof body.token).toBe('string')
  return body.token as string
}

test.describe('API boundaries (auth + quarters)', () => {
  test('demo bearer can create quarter-boundary txs and read summaries', async ({
    request,
  }) => {
    const unauth = await request.get(`${BASE_URL}/api/bank-accounts`)
    expect(unauth.status()).toBe(401)

    const token = await signInDemo(request)
    const auth = { Authorization: `Bearer ${token}` }

    const settings = await request.patch(`${BASE_URL}/api/users/business-settings`, {
      headers: auth,
      data: businessSetup,
    })
    expect(settings.ok()).toBeTruthy()

    const accountsRes = await request.get(`${BASE_URL}/api/bank-accounts`, {
      headers: auth,
    })
    expect(accountsRes.ok()).toBeTruthy()
    const accountsBody = await accountsRes.json()
    const bankAccountId = accountsBody.accounts?.[0]?.id as string | undefined
    expect(bankAccountId).toBeTruthy()

    const dates = ['2026-07-05', '2026-07-06'] as const
    const created: string[] = []
    for (const date of dates) {
      const create = await request.post(`${BASE_URL}/api/transactions/manual`, {
        headers: auth,
        data: {
          bankAccountId,
          name: `Boundary ${date}`,
          date,
          amount: -25,
          hmrcCategory: 'office_costs',
        },
      })
      expect(create.ok()).toBeTruthy()
      const body = await create.json()
      expect(body.transaction?.id).toBeTruthy()
      created.push(body.transaction.id)
      expect(getQuarterForDate(date).id).toBe(date === '2026-07-05' ? 'Q1' : 'Q2')
    }

    const taxYearStart = getTaxYearForDate('2026-07-18').start
    const overview = await request.get(
      `${BASE_URL}/api/submissions/overview?taxYearStart=${taxYearStart}`,
      { headers: auth },
    )
    expect(overview.ok()).toBeTruthy()

    for (const quarter of ['Q1', 'Q2'] as const) {
      const summary = await request.get(
        `${BASE_URL}/api/submissions/quarterly-summary?quarter=${quarter}&taxYearStart=${taxYearStart}`,
        { headers: auth },
      )
      expect(summary.ok()).toBeTruthy()
    }

    for (const id of created) {
      const del = await request.delete(`${BASE_URL}/api/transactions/manual`, {
        headers: auth,
        data: { id },
      })
      expect(del.ok()).toBeTruthy()
    }
  })
})
