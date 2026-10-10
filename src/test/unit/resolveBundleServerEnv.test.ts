import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveBundleServerEnv } from '../../../scripts/release/helpers/env'

describe('resolveBundleServerEnv', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bundle-env-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('bakes the staging api host for the preview variant from .env.staging only', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'ONE_SERVER_URL=https://app.straightup.tax\nAPI_SERVER_URL=https://api.straightup.tax\nVITE_API_HOSTNAME=api.straightup.tax\n',
    )
    writeFileSync(
      join(dir, '.env.staging'),
      [
        'ONE_SERVER_URL=https://staging-api.straightup.tax',
        'API_SERVER_URL=https://staging-api.straightup.tax',
        'VITE_API_HOSTNAME=staging-api.straightup.tax',
        'VITE_PROTOCOL=https',
        'VITE_ALLOW_PUBLIC_AUTH=1',
        'VITE_DEMO_MODE=1',
        '',
      ].join('\n'),
    )
    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.envFile).toBe('.env.staging')
    expect(res.apiServerUrl).toBe('https://staging-api.straightup.tax')
    expect(res.bundleEnv.API_SERVER_URL).toBe('https://staging-api.straightup.tax')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('staging-api.straightup.tax')
    expect(res.bundleEnv.VITE_PROTOCOL).toBe('https')
    expect(res.bundleEnv.VITE_ALLOW_PUBLIC_AUTH).toBe('1')
    expect(res.bundleEnv.VITE_DEMO_MODE).toBe('1')
  })

  it('omits empty auth flags so production preview-gates stay off', () => {
    writeFileSync(
      join(dir, '.env.production'),
      [
        'ONE_SERVER_URL=https://app.straightup.tax',
        'API_SERVER_URL=https://api.straightup.tax',
        'VITE_API_HOSTNAME=api.straightup.tax',
        'VITE_ALLOW_PUBLIC_AUTH=',
        'VITE_DEMO_MODE=',
        '',
      ].join('\n'),
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.bundleEnv.VITE_ALLOW_PUBLIC_AUTH).toBeUndefined()
    expect(res.bundleEnv.VITE_DEMO_MODE).toBeUndefined()
  })

  it('never falls back to .env.production for the preview variant', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\nVITE_API_HOSTNAME=api.straightup.tax\n',
    )
    // staging sets ONE_SERVER_URL only; the api host must NOT inherit prod values
    writeFileSync(
      join(dir, '.env.staging'),
      'ONE_SERVER_URL=https://staging-api.straightup.tax\n',
    )
    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.serverUrl).toBe('https://staging-api.straightup.tax')
    expect(res.apiServerUrl).toBe('')
    expect(res.apiHostname).toBe('')
    expect(res.bundleEnv.API_SERVER_URL).toBeUndefined()
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBeUndefined()
  })

  it('throws when the variant env file is missing', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\n',
    )
    expect(() => resolveBundleServerEnv(dir, 'preview')).toThrow(/\.env\.staging/)
  })

  it('throws for a preview build with no urls in .env.staging', () => {
    writeFileSync(join(dir, '.env.staging'), '# empty\n')
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\nVITE_API_HOSTNAME=api.straightup.tax\n',
    )
    expect(() => resolveBundleServerEnv(dir, 'preview')).toThrow(
      /refusing to use another env file/,
    )
  })

  it('bakes the prod api host for the production variant from .env.production only', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\nVITE_API_HOSTNAME=api.straightup.tax\nVITE_PROTOCOL=https\n',
    )
    writeFileSync(
      join(dir, '.env.staging'),
      'API_SERVER_URL=https://staging-api.straightup.tax\n',
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.envFile).toBe('.env.production')
    expect(res.apiServerUrl).toBe('https://api.straightup.tax')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('api.straightup.tax')
  })

  it('defaults to the production variant when none is given', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\n',
    )
    writeFileSync(
      join(dir, '.env.staging'),
      'API_SERVER_URL=https://staging-api.straightup.tax\n',
    )
    expect(resolveBundleServerEnv(dir).apiServerUrl).toBe('https://api.straightup.tax')
  })

  it('ignores ambient process.env entirely (bun may have loaded .env.development)', () => {
    writeFileSync(
      join(dir, '.env.staging'),
      [
        'ONE_SERVER_URL=https://staging-api.straightup.tax',
        'API_SERVER_URL=https://staging-api.straightup.tax',
        'VITE_API_HOSTNAME=staging-api.straightup.tax',
        'VITE_WEB_HOSTNAME=staging-api.straightup.tax',
        'VITE_PROTOCOL=https',
        '',
      ].join('\n'),
    )
    // even if process.env is polluted, resolution is file-only
    process.env.ONE_SERVER_URL = 'http://localhost:8081'
    process.env.VITE_PROTOCOL = 'http'
    process.env.VITE_API_HOSTNAME = 'localhost:8081'
    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.serverUrl).toBe('https://staging-api.straightup.tax')
    expect(res.webProtocol).toBe('https')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('staging-api.straightup.tax')
    delete process.env.ONE_SERVER_URL
    delete process.env.VITE_PROTOCOL
    delete process.env.VITE_API_HOSTNAME
  })

  it('derives the api hostname from API_SERVER_URL when VITE_API_HOSTNAME is absent', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\n',
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.apiHostname).toBe('api.straightup.tax')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('api.straightup.tax')
  })

  it('accepts api-only production urls and mirrors them into ONE_SERVER_URL', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.straightup.tax\nVITE_API_HOSTNAME=api.straightup.tax\nVITE_PROTOCOL=https\n',
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.apiServerUrl).toBe('https://api.straightup.tax')
    expect(res.bundleEnv.ONE_SERVER_URL).toBe('https://api.straightup.tax')
    expect(res.bundleEnv.VITE_WEB_HOSTNAME).toBe('api.straightup.tax')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('api.straightup.tax')
  })

  it('still resolves the web server url + hostname (regression)', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'ONE_SERVER_URL=https://app.straightup.tax\n',
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.serverUrl).toBe('https://app.straightup.tax')
    expect(res.webHostname).toBe('app.straightup.tax')
    expect(res.bundleEnv.ONE_SERVER_URL).toBe('https://app.straightup.tax')
  })
})
