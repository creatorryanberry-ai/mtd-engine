import { describe, expect, it } from 'vitest'

import {
  assertSafeUrl,
  isBlockedHostname,
  isPrivateAddress,
  UnsafeUrlError,
} from '~/features/engine/llm/ssrf'

describe('engine llm ssrf guard', () => {
  it('accepts public http(s) urls', () => {
    expect(assertSafeUrl('https://example.com/about').hostname).toBe('example.com')
    expect(assertSafeUrl('http://www.northstar-roofing.co.uk').protocol).toBe('http:')
    expect(assertSafeUrl('https://93.184.216.34/').hostname).toBe('93.184.216.34')
  })

  it('rejects non-http schemes', () => {
    for (const url of [
      'ftp://example.com',
      'file:///etc/passwd',
      'gopher://example.com',
      'javascript:alert(1)',
    ]) {
      expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError)
    }
  })

  it('rejects garbage and urls with credentials', () => {
    expect(() => assertSafeUrl('not a url')).toThrow(UnsafeUrlError)
    expect(() => assertSafeUrl('https://user:pass@example.com')).toThrow(UnsafeUrlError)
  })

  it('rejects loopback, private, link-local and metadata hosts', () => {
    const blocked = [
      'http://localhost',
      'http://localhost:8081/api',
      'http://foo.localhost',
      'http://127.0.0.1',
      'http://127.1.2.3',
      'http://0.0.0.0',
      'http://10.0.0.5',
      'http://172.16.0.1',
      'http://172.31.255.255',
      'http://192.168.1.1',
      'http://169.254.169.254/latest/meta-data',
      'http://100.64.0.1',
      'http://metadata.google.internal',
      'http://db.internal',
      'http://printer.local',
      'http://intranet',
      'http://[::1]',
      'http://[fe80::1]',
      'http://[fd00::1]',
      'http://[::ffff:127.0.0.1]',
      'http://[::ffff:10.0.0.1]',
    ]
    for (const url of blocked) {
      expect(() => assertSafeUrl(url), url).toThrow(UnsafeUrlError)
    }
  })

  it('allows public ranges adjacent to private ones', () => {
    expect(() => assertSafeUrl('http://172.15.0.1')).not.toThrow()
    expect(() => assertSafeUrl('http://172.32.0.1')).not.toThrow()
    expect(() => assertSafeUrl('http://100.63.0.1')).not.toThrow()
    expect(() => assertSafeUrl('http://100.128.0.1')).not.toThrow()
    expect(() => assertSafeUrl('http://[2606:4700::1111]')).not.toThrow()
  })

  it('classifies resolved addresses', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false)
    expect(isPrivateAddress('10.1.1.1')).toBe(true)
    expect(isPrivateAddress('224.0.0.1')).toBe(true)
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('fc00::1')).toBe(true)
    expect(isPrivateAddress('::ffff:192.168.0.1')).toBe(true)
    expect(isPrivateAddress('not-an-ip')).toBe(true)
  })

  it('treats bare and trailing-dot hostnames consistently', () => {
    expect(isBlockedHostname('example.com.')).toBe(false)
    expect(isBlockedHostname('LOCALHOST')).toBe(true)
    expect(isBlockedHostname('')).toBe(true)
  })
})
