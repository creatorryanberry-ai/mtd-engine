import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { serveApiDocs } from '~/server/serveApiDocs'

describe('serveApiDocs', () => {
  let root: string
  let outside: string | undefined

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    if (outside) rmSync(outside, { recursive: true, force: true })
    root = undefined as unknown as string
    outside = undefined
  })

  function fixture(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), 'api-docs-'))
    for (const [rel, body] of Object.entries(files)) {
      const full = join(root, rel)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, body)
    }
    return root
  }

  it('serves index.html for /docs and /docs/', async () => {
    const docsRoot = fixture({ 'index.html': '<html>docs</html>' })
    for (const path of ['/docs', '/docs/']) {
      const res = await serveApiDocs(
        new Request(`https://staging-api.straightup.tax${path}`),
        docsRoot,
      )
      expect(res?.status).toBe(200)
      expect(await res!.text()).toBe('<html>docs</html>')
      expect(res!.headers.get('content-type')).toContain('text/html')
    }
  })

  it('returns 200 with headers and no body for HEAD', async () => {
    const docsRoot = fixture({ 'index.html': '<html>docs</html>' })
    const res = await serveApiDocs(
      new Request('https://staging-api.straightup.tax/docs', { method: 'HEAD' }),
      docsRoot,
    )
    expect(res?.status).toBe(200)
    expect(res!.headers.get('content-type')).toContain('text/html')
    expect(await res!.text()).toBe('')
  })

  it('serves nested assets under /docs/', async () => {
    const docsRoot = fixture({ 'assets/app.js': 'console.info(1)' })
    const res = await serveApiDocs(
      new Request('https://staging-api.straightup.tax/docs/assets/app.js'),
      docsRoot,
    )
    expect(res?.status).toBe(200)
    expect(await res!.text()).toBe('console.info(1)')
    expect(res!.headers.get('content-type')).toContain('javascript')
  })

  it('returns null for non-docs paths and non-GET methods', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    expect(
      await serveApiDocs(
        new Request('https://staging-api.straightup.tax/api/health'),
        docsRoot,
      ),
    ).toBeNull()
    expect(
      await serveApiDocs(
        new Request('https://staging-api.straightup.tax/docs', { method: 'POST' }),
        docsRoot,
      ),
    ).toBeNull()
  })

  it('returns null when the file is missing', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    expect(
      await serveApiDocs(
        new Request('https://staging-api.straightup.tax/docs/missing.js'),
        docsRoot,
      ),
    ).toBeNull()
  })

  it('returns null for directories', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    mkdirSync(join(docsRoot, 'assets'))

    for (const method of ['GET', 'HEAD']) {
      expect(
        await serveApiDocs(
          new Request('https://staging-api.straightup.tax/docs/assets', {
            method,
          }),
          docsRoot,
        ),
      ).toBeNull()
    }
  })

  it('rejects path escape attempts', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    const escapePaths = [
      '/docs/../../etc/passwd',
      '/docs/%2e%2e/%2e%2e/etc/passwd',
      '/docs/nested/../../../etc/passwd',
    ]
    for (const path of escapePaths) {
      expect(
        await serveApiDocs(
          new Request(`https://staging-api.straightup.tax${path}`),
          docsRoot,
        ),
      ).toBeNull()
    }
  })

  it('rejects symlinks pointing outside docs root', async () => {
    outside = mkdtempSync(join(tmpdir(), 'api-docs-outside-'))
    const outsideFile = join(outside, 'secret.txt')
    writeFileSync(outsideFile, 'secret')
    root = mkdtempSync(join(tmpdir(), 'api-docs-'))
    writeFileSync(join(root, 'index.html'), 'x')
    symlinkSync(outsideFile, join(root, 'escape.txt'))
    expect(
      await serveApiDocs(
        new Request('https://staging-api.straightup.tax/docs/escape.txt'),
        root,
      ),
    ).toBeNull()
  })
})
