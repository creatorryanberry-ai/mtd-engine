import type { Endpoint } from 'one'

import { API_RELEASE_VERSION } from '~/contract/apiRelease'
import { API_CONTRACT_VERSION } from '~/contract/version'

export const GET: Endpoint = async () => {
  return Response.json({
    status: 'ok',
    sha: process.env.GIT_SHA || 'unknown',
    env: process.env.NODE_ENV || 'unknown',
    apiRelease: API_RELEASE_VERSION,
    apiContract: API_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
  })
}
