import { describe, expect, it } from 'vitest'
import { parseUncloudEnvTarget } from './load-deploy-env'

describe('parseUncloudEnvTarget', () => {
  it('requires --production or --staging', () => {
    expect(() => parseUncloudEnvTarget([])).toThrow(/--production or --staging/)
    expect(() => parseUncloudEnvTarget(['--skip-build'])).toThrow(
      /--production or --staging/,
    )
  })

  it('selects production when --production is present', () => {
    expect(parseUncloudEnvTarget(['--production'])).toBe('production')
    expect(parseUncloudEnvTarget(['--skip-build', '--production'])).toBe('production')
  })

  it('selects staging when --staging is present', () => {
    expect(parseUncloudEnvTarget(['--staging'])).toBe('staging')
    expect(parseUncloudEnvTarget(['--skip-build', '--staging'])).toBe('staging')
  })

  it('rejects both flags together', () => {
    expect(() => parseUncloudEnvTarget(['--production', '--staging'])).toThrow(
      /only one of/,
    )
  })
})
