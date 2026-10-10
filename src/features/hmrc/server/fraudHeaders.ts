import { APP_NAME } from '~/constants/app'

import type { HmrcFraudHeadersInput } from '../types'

export function buildHmrcFraudHeaders(input: HmrcFraudHeadersInput, request: Request) {
  const headers: Record<string, string> = {}

  const forwardedFor = request.headers.get('x-forwarded-for')
  const remoteIp =
    forwardedFor?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip')
  if (remoteIp) {
    headers['Gov-Client-Public-IP'] = remoteIp
  }

  const userAgent = input.userAgent || request.headers.get('user-agent')
  if (userAgent) {
    headers['Gov-Client-User-Agent'] = userAgent
  }

  if (input.timezone) {
    headers['Gov-Client-Timezone'] = input.timezone
  }

  if (input.screenWidth && input.screenHeight) {
    headers['Gov-Client-Screens'] =
      `width=${input.screenWidth}&height=${input.screenHeight}${
        input.screenScaleFactor ? `&scaling-factor=${input.screenScaleFactor}` : ''
      }`
  }

  if (input.windowWidth && input.windowHeight) {
    headers['Gov-Client-Window-Size'] =
      `width=${input.windowWidth}&height=${input.windowHeight}`
  }

  if (input.deviceId) {
    headers['Gov-Client-Device-ID'] = input.deviceId
  }

  if (input.plugins) {
    headers['Gov-Client-Browser-Plugins'] = input.plugins
  }

  if (input.doNotTrack) {
    headers['Gov-Client-Browser-Do-Not-Track'] = input.doNotTrack
  }

  if (input.localIps) {
    headers['Gov-Client-Local-IPs'] = input.localIps
  }

  if (input.platform) {
    headers['Gov-Client-Device-OS'] = input.platform
  }

  if (input.osVersion) {
    headers['Gov-Client-Device-OS-Version'] = input.osVersion
  }

  if (input.appVersion) {
    headers['Gov-Vendor-Product-Name'] = APP_NAME
    headers['Gov-Vendor-Version'] = input.appVersion
  }

  headers['Gov-Vendor-Forwarded'] = 'by=Straight-Up-Tax'

  return headers
}

export function parseFraudHeadersFromRequest(request: Request): HmrcFraudHeadersInput {
  const get = (name: string) => request.headers.get(name) ?? undefined

  return {
    deviceId: get('x-hmrc-device-id'),
    timezone: get('x-hmrc-timezone'),
    screenWidth: get('x-hmrc-screen-width'),
    screenHeight: get('x-hmrc-screen-height'),
    screenScaleFactor: get('x-hmrc-screen-scale'),
    windowWidth: get('x-hmrc-window-width'),
    windowHeight: get('x-hmrc-window-height'),
    userAgent: get('x-hmrc-user-agent'),
    plugins: get('x-hmrc-plugins'),
    doNotTrack: get('x-hmrc-do-not-track'),
    localIps: get('x-hmrc-local-ips'),
    platform: get('x-hmrc-platform'),
    osVersion: get('x-hmrc-os-version'),
    appVersion: get('x-hmrc-app-version'),
  }
}
