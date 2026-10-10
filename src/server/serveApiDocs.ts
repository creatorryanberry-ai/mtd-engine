import { existsSync, realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function isContainedInRoot(root: string, candidate: string): boolean {
  const relToRoot = relative(root, candidate)
  return (
    relToRoot !== '' && !relToRoot.startsWith('..') && !relToRoot.includes(`..${sep}`)
  )
}

function resolveDocsFile(docsRoot: string, pathname: string): string | null {
  if (pathname !== '/docs' && !pathname.startsWith('/docs/')) return null

  const rel =
    pathname === '/docs' || pathname === '/docs/'
      ? 'index.html'
      : pathname.slice('/docs/'.length)

  if (!rel || rel.includes('\0') || rel.split(/[/\\]/).includes('..')) return null

  const root = resolve(docsRoot)
  const candidate = resolve(root, rel)
  if (!isContainedInRoot(root, candidate)) return null
  if (!existsSync(candidate)) return null

  try {
    const realRoot = realpathSync(root)
    const realCandidate = realpathSync(candidate)
    if (!isContainedInRoot(realRoot, realCandidate)) return null
    if (!statSync(realCandidate).isFile()) return null
    return realCandidate
  } catch {
    return null
  }
}

export async function serveApiDocs(
  request: Request,
  docsRoot: string,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null

  const { pathname } = new URL(request.url)
  if (pathname !== '/docs' && !pathname.startsWith('/docs/')) return null
  if (!docsRoot || !existsSync(docsRoot)) return null

  const filePath = resolveDocsFile(docsRoot, pathname)
  if (!filePath) return null

  const headers = { 'content-type': contentTypeFor(filePath) }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }

  try {
    const body = await readFile(filePath)
    return new Response(new Uint8Array(body), { status: 200, headers })
  } catch {
    return null
  }
}
