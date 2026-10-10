import { isWeb } from 'tamagui'

export type HmrcFraudHeaderPayload = Record<string, string>

export function collectHmrcFraudHeaders(): HmrcFraudHeaderPayload {
  if (isWeb && typeof window !== 'undefined') {
    const screenInfo = window.screen
    const headers: HmrcFraudHeaderPayload = {
      'x-hmrc-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'x-hmrc-screen-width': String(screenInfo.width),
      'x-hmrc-screen-height': String(screenInfo.height),
      'x-hmrc-screen-scale': String(window.devicePixelRatio ?? 1),
      'x-hmrc-window-width': String(window.innerWidth),
      'x-hmrc-window-height': String(window.innerHeight),
      'x-hmrc-user-agent': window.navigator.userAgent,
      'x-hmrc-do-not-track': window.navigator.doNotTrack === '1' ? 'true' : 'false',
    }

    const plugins = Array.from(window.navigator.plugins ?? [])
      .map((plugin) => plugin.name)
      .filter(Boolean)
      .join(',')

    if (plugins) {
      headers['x-hmrc-plugins'] = plugins
    }

    return headers
  }

  return {
    'x-hmrc-platform': 'native',
  }
}

export function getHmrcFraudHeaderRecord(): Record<string, string> {
  return collectHmrcFraudHeaders()
}
