import { afterEach, describe, expect, it } from 'vitest'

import { assertDeployEnv } from './assert-deploy-env'

const KEYS = [
  'API_SERVER_URL',
  'VITE_API_HOSTNAME',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'DATABASE_URL',
  'DEPLOY_DB',
  'DEPLOY_HOST',
  'DEPLOY_SSH_KEY',
  'VITE_PROTOCOL',
  'ONE_SERVER_URL',
  'VITE_WEB_HOSTNAME',
] as const

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function stash() {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
}

function restore() {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('assertDeployEnv', () => {
  afterEach(restore)

  it('passes for api when api + db + deploy keys are set', () => {
    stash()
    process.env.API_SERVER_URL = 'https://api.example.com'
    process.env.VITE_API_HOSTNAME = 'api.example.com'
    process.env.BETTER_AUTH_URL = 'https://api.example.com'
    process.env.BETTER_AUTH_SECRET = 'secret'
    process.env.DATABASE_URL = 'postgres://x'
    process.env.DEPLOY_HOST = '1.2.3.4'
    process.env.DEPLOY_SSH_KEY = '/tmp/key'
    process.env.VITE_PROTOCOL = 'https'
    expect(() => assertDeployEnv('api')).not.toThrow()
  })

  it('fails for api when web-only keys are the only ones set', () => {
    stash()
    process.env.ONE_SERVER_URL = 'https://app.example.com'
    process.env.VITE_WEB_HOSTNAME = 'app.example.com'
    process.env.DEPLOY_HOST = '1.2.3.4'
    process.env.DEPLOY_SSH_KEY = '/tmp/key'
    process.env.VITE_PROTOCOL = 'https'
    expect(() => assertDeployEnv('api')).toThrow(/missing env for deploy-api/)
  })

  it('passes for web when web + deploy keys are set (no api required)', () => {
    stash()
    process.env.ONE_SERVER_URL = 'https://app.example.com'
    process.env.VITE_WEB_HOSTNAME = 'app.example.com'
    process.env.DEPLOY_HOST = '1.2.3.4'
    process.env.DEPLOY_SSH_KEY = '/tmp/key'
    process.env.VITE_PROTOCOL = 'https'
    expect(() => assertDeployEnv('web')).not.toThrow()
  })

  it('fails for web when ONE_SERVER_URL is missing', () => {
    stash()
    process.env.VITE_WEB_HOSTNAME = 'app.example.com'
    process.env.DEPLOY_HOST = '1.2.3.4'
    process.env.DEPLOY_SSH_KEY = '/tmp/key'
    process.env.VITE_PROTOCOL = 'https'
    expect(() => assertDeployEnv('web')).toThrow(/ONE_SERVER_URL/)
  })
})
