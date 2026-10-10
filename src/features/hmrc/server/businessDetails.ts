import { HMRC_SELF_EMPLOYMENT_TYPE } from '~/features/hmrc/constants'

import { hmrcApiRequest, getValidHmrcAccessToken } from './client'
import { getHmrcConnectionStatus, setHmrcBusiness } from './connectionService'

import type { HmrcBusiness, HmrcFraudHeadersInput } from '../types'

type ListBusinessesResponse = {
  listOfBusinesses?: Array<{
    businessId: string
    typeOfBusiness: string
    tradingName?: string
  }>
}

export async function listHmrcBusinesses(input: {
  userId: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
}) {
  const { accessToken, connection } = await getValidHmrcAccessToken(input.userId)

  const response = await hmrcApiRequest<ListBusinessesResponse>({
    path: `/individuals/business/details/${connection.nino}/list`,
    accessToken,
    accept: 'application/vnd.hmrc.2.0+json',
    request: input.request,
    fraudHeaders: input.fraudHeaders,
  })

  return (response.listOfBusinesses ?? [])
    .filter((business) => business.typeOfBusiness === HMRC_SELF_EMPLOYMENT_TYPE)
    .map(
      (business): HmrcBusiness => ({
        businessId: business.businessId,
        typeOfBusiness: business.typeOfBusiness,
        tradingName: business.tradingName ?? null,
      }),
    )
}

export async function ensureDefaultSelfEmploymentBusiness(input: {
  userId: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
}) {
  const status = await getHmrcConnectionStatus(input.userId)

  if (status.businessId) {
    return status
  }

  const businesses = await listHmrcBusinesses(input)
  const first = businesses[0]
  if (!first) {
    throw new Error('No self-employment business found in HMRC account')
  }

  await setHmrcBusiness(input.userId, first.businessId, first.tradingName)

  return getHmrcConnectionStatus(input.userId)
}
