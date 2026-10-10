import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  assertStagingDbIsolated,
  collectForbiddenProductionDbHosts,
  parsePostgresHost,
  readDeployDbHostFromEnvFile,
} from './assert-staging-db-isolated'

describe('parsePostgresHost', () => {
  it('extracts host from a postgres url', () => {
    expect(
      parsePostgresHost(
        'postgresql://user:pass@34.13.41.244:5432/straightuptax?sslmode=require',
      ),
    ).toBe('34.13.41.244')
  })

  it('returns null for invalid input', () => {
    expect(parsePostgresHost('')).toBeNull()
    expect(parsePostgresHost('not-a-url')).toBeNull()
  })
})

describe('readDeployDbHostFromEnvFile', () => {
  it('reads DEPLOY_DB host from a dotenv file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mtd-staging-db-'))
    const path = join(dir, '.env.production')
    writeFileSync(
      path,
      'DEPLOY_DB=postgresql://u:p@prod-db.example:5432/postgres?sslmode=require\n',
    )
    expect(readDeployDbHostFromEnvFile(path)).toBe('prod-db.example')
  })

  it('returns null when file is missing', () => {
    expect(readDeployDbHostFromEnvFile('/tmp/does-not-exist-mtd.env')).toBeNull()
  })
})

describe('assertStagingDbIsolated', () => {
  afterEach(() => {
    // no process.env mutation in these tests
  })

  it('throws when staging host matches known production host', () => {
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl: 'postgresql://u:p@34.13.41.244:5432/straightuptax?sslmode=require',
        productionEnvPath: '/tmp/does-not-exist-mtd.env',
      }),
    ).toThrow(/staging must not use the production postgres host/)
  })

  it('throws when staging host matches DEPLOY_DB host in .env.production', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mtd-staging-db-'))
    const path = join(dir, '.env.production')
    writeFileSync(
      path,
      'DEPLOY_DB=postgresql://u:p@prod-only.example:5432/postgres?sslmode=require\n',
    )
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl:
          'postgresql://u:p@prod-only.example:5432/straightuptax?sslmode=require',
        productionEnvPath: path,
        knownHosts: [],
      }),
    ).toThrow(/staging must not use the production postgres host/)
  })

  it('passes when staging host is distinct', () => {
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl:
          'postgresql://u:p@staging-db.example:5432/straightuptax?sslmode=require',
        productionEnvPath: '/tmp/does-not-exist-mtd.env',
      }),
    ).not.toThrow()
  })

  it('collectForbiddenProductionDbHosts includes known fallback', () => {
    const hosts = collectForbiddenProductionDbHosts({
      productionEnvPath: '/tmp/does-not-exist-mtd.env',
    })
    expect(hosts).toContain('34.13.41.244')
  })
})
