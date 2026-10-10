import { hmrcApiRequest, getValidHmrcAccessToken } from './client'

import type { HmrcFraudHeadersInput, HmrcObligation } from '../types'

type ObligationsResponse = {
  obligations?: Array<{
    start: string
    end: string
    due: string
    status: string
    received?: string
  }>
}

export async function getHmrcObligations(input: {
  userId: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
  fromDate?: string
  toDate?: string
}) {
  const { accessToken, connection } = await getValidHmrcAccessToken(input.userId)
  const params = new URLSearchParams()

  if (input.fromDate) params.set('fromDate', input.fromDate)
  if (input.toDate) params.set('toDate', input.toDate)
  params.set('status', 'open')

  const query = params.toString()
  const path = `/obligations/details/${connection.nino}/income-and-expenditure${
    query ? `?${query}` : ''
  }`

  const response = await hmrcApiRequest<ObligationsResponse>({
    path,
    accessToken,
    accept: 'application/vnd.hmrc.3.0+json',
    request: input.request,
    fraudHeaders: input.fraudHeaders,
  })

  const obligations: HmrcObligation[] = (response.obligations ?? []).map((row) => ({
    periodStartDate: row.start,
    periodEndDate: row.end,
    dueDate: row.due,
    status: row.status === 'fulfilled' ? 'fulfilled' : 'open',
    receivedDate: row.received ?? null,
  }))

  return obligations
}

export async function getNextOpenHmrcObligation(input: {
  userId: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
}) {
  const obligations = await getHmrcObligations(input)
  const open = obligations
    .filter((obligation) => obligation.status === 'open')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return open[0] ?? null
}
