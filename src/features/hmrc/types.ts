export type HmrcEnvironment = 'sandbox' | 'production'

export type HmrcConnectionStatus = {
  configured: boolean
  connected: boolean
  environment: HmrcEnvironment
  nino: string | null
  businessId: string | null
  businessName: string | null
  connectedAt: string | null
  tokenExpiresAt: string | null
}

export type HmrcBusiness = {
  businessId: string
  typeOfBusiness: string
  tradingName: string | null
}

export type HmrcObligation = {
  periodStartDate: string
  periodEndDate: string
  dueDate: string
  status: 'open' | 'fulfilled'
  receivedDate: string | null
}

export type HmrcTaxEstimate = {
  calculationId: string
  taxYear: string
  incomeTaxAmount: number | null
  totalIncomeTaxAndNicsDue: number | null
  totalTaxDeducted: number | null
  totalNicAmount: number | null
  disclaimer: string
  hmrcAccountUrl: string
  retrievedAt: string
}

export type HmrcFraudHeadersInput = {
  deviceId?: string
  timezone?: string
  screenWidth?: string
  screenHeight?: string
  screenScaleFactor?: string
  windowWidth?: string
  windowHeight?: string
  userAgent?: string
  plugins?: string
  doNotTrack?: string
  localIps?: string
  platform?: string
  osVersion?: string
  appVersion?: string
}
