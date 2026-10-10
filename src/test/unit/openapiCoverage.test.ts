import { describe, expect, it } from 'vitest'

import {
  diffManifestCoverage,
  MANIFEST_DECLARATION,
  normalizeManifestPath,
  parseManifestOpsFromSource,
} from '~/api/openapi/coverage'

describe('openapi coverage', () => {
  it('normalizes :param to {param}', () => {
    expect(normalizeManifestPath('/api/bank-accounts/:id')).toBe(
      '/api/bank-accounts/{id}',
    )
  })

  it('reports missing ops not in openapi or allowlist', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/health' },
        { method: 'POST', pattern: '/api/stats' },
      ],
      openapiPaths: {
        '/api/health': { get: {} },
      },
      allowlist: [],
    })
    expect(missing).toEqual([{ method: 'POST', pattern: '/api/stats' }])
  })

  it('treats auth catch-all covered when documented auth ops exist', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/auth/*' },
        { method: 'POST', pattern: '/api/auth/*' },
      ],
      openapiPaths: {
        '/api/auth/email-otp/send-verification-otp': { post: {} },
        '/api/auth/sign-in/email-otp': { post: {} },
        '/api/auth/sign-out': { post: {} },
        '/api/auth/get-session': { get: {} },
        '/api/auth/validateToken': { post: {} },
      },
      allowlist: [],
    })
    expect(missing).toEqual([])
  })

  it('reports auth catch-all missing when auth set is incomplete', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/auth/*' },
        { method: 'POST', pattern: '/api/auth/*' },
      ],
      openapiPaths: {
        '/api/auth/email-otp/send-verification-otp': { post: {} },
        '/api/auth/get-session': { get: {} },
      },
      allowlist: [],
    })
    expect(missing).toEqual([
      { method: 'GET', pattern: '/api/auth/*' },
      { method: 'POST', pattern: '/api/auth/*' },
    ])
  })

  it('treats allowlisted ops as covered', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/file/receipt' },
        { method: 'DELETE', pattern: '/api/file/upload' },
        { method: 'POST', pattern: '/api/stats' },
      ],
      openapiPaths: {},
      allowlist: [
        { method: 'GET', pattern: '/api/file/receipt' },
        { method: 'DELETE', pattern: '/api/file/upload' },
      ],
    })
    expect(missing).toEqual([{ method: 'POST', pattern: '/api/stats' }])
  })

  it('parseManifestOpsFromSource throws when no ops are found', () => {
    expect(() => parseManifestOpsFromSource(`${MANIFEST_DECLARATION}\n]\n`)).toThrow(
      'route manifest source parsed zero operations',
    )
  })

  it('parseManifestOpsFromSource throws when declaration is missing', () => {
    expect(() =>
      parseManifestOpsFromSource("{ method: 'GET', pattern: '/api/health' }"),
    ).toThrow('route manifest source missing expected declaration')
  })

  it('parseManifestOpsFromSource throws when the manifest array is truncated', () => {
    expect(() =>
      parseManifestOpsFromSource(
        `${MANIFEST_DECLARATION}
  { method: 'GET', pattern: '/api/health', handler: r0.GET },
`,
      ),
    ).toThrow('route manifest source missing closing array bracket')
  })

  it('parseManifestOpsFromSource throws when an array entry is unparseable', () => {
    expect(() =>
      parseManifestOpsFromSource(
        `${MANIFEST_DECLARATION}
  { method: 'GET', pattern: '/api/health', handler: r0.GET },
  { method: 'POST', handler: r1.POST },
]
`,
      ),
    ).toThrow('route manifest source contains malformed entry')
  })

  it('empty manifest parse is not treated as fully covered', () => {
    expect(() => parseManifestOpsFromSource(`${MANIFEST_DECLARATION}\n]\n`)).toThrow()

    const { missing } = diffManifestCoverage({
      manifest: [],
      openapiPaths: {},
      allowlist: [],
    })
    expect(missing).toEqual([])
  })
})
