export type ManifestOp = { method: string; pattern: string }

export const MANIFEST_DECLARATION = 'export const apiRouteManifest: ApiRoute[] = ['

function findMatchingArrayEnd(source: string, bodyStart: number): number {
  let depth = 1
  let quote: "'" | '"' | '`' | undefined
  let inLineComment = false
  let inBlockComment = false

  for (let index = bodyStart; index < source.length; index++) {
    const char = source[index]!
    const next = source[index + 1]

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        index++
      }
      continue
    }
    if (quote) {
      if (char === '\\') {
        index++
      } else if (char === quote) {
        quote = undefined
      }
      continue
    }
    if (char === '/' && next === '/') {
      inLineComment = true
      index++
    } else if (char === '/' && next === '*') {
      inBlockComment = true
      index++
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char
    } else if (char === '[') {
      depth++
    } else if (char === ']' && --depth === 0) {
      return index
    }
  }

  return -1
}

const MANIFEST_ENTRY_RE =
  /\{\s*method:\s*'([^']+)'\s*,\s*pattern:\s*'([^']+)'\s*,\s*handler:\s*[^,{}\r\n]+\s*\}/y

export function parseManifestOpsFromSource(source: string): ManifestOp[] {
  const declarationStart = source.indexOf(MANIFEST_DECLARATION)
  if (declarationStart === -1) {
    throw new Error(
      `route manifest source missing expected declaration: ${MANIFEST_DECLARATION}`,
    )
  }

  const bodyStart = declarationStart + MANIFEST_DECLARATION.length
  const bodyEnd = findMatchingArrayEnd(source, bodyStart)
  if (bodyEnd === -1) {
    throw new Error('route manifest source missing closing array bracket')
  }

  const body = source.slice(bodyStart, bodyEnd)
  const ops: ManifestOp[] = []
  let offset = 0

  while (offset < body.length) {
    while (/\s/.test(body[offset] ?? '')) offset++
    if (offset === body.length) break

    MANIFEST_ENTRY_RE.lastIndex = offset
    const match = MANIFEST_ENTRY_RE.exec(body)
    if (!match) {
      throw new Error('route manifest source contains malformed entry')
    }

    ops.push({ method: match[1]!, pattern: match[2]! })
    offset = MANIFEST_ENTRY_RE.lastIndex

    while (/\s/.test(body[offset] ?? '')) offset++
    if (offset === body.length) break
    if (body[offset] !== ',') {
      throw new Error('route manifest source contains malformed entry')
    }
    offset++
  }

  if (ops.length === 0) {
    throw new Error('route manifest source parsed zero operations')
  }

  return ops
}

const AUTH_DOCUMENTED_OPS = [
  { path: '/api/auth/email-otp/send-verification-otp', method: 'post' },
  { path: '/api/auth/sign-in/email-otp', method: 'post' },
  { path: '/api/auth/sign-out', method: 'post' },
  { path: '/api/auth/get-session', method: 'get' },
  { path: '/api/auth/validateToken', method: 'post' },
] as const

export function normalizeManifestPath(pattern: string): string {
  return pattern.replace(/:([^/]+)/g, '{$1}')
}

function manifestOpKey(op: ManifestOp) {
  return `${op.method}:${normalizeManifestPath(op.pattern)}`
}

function authCatchAllCovered(openapiPaths: Record<string, Record<string, unknown>>) {
  return AUTH_DOCUMENTED_OPS.every(
    ({ path, method }) => openapiPaths[path]?.[method] !== undefined,
  )
}

function isManifestOpCovered(
  op: ManifestOp,
  openapiPaths: Record<string, Record<string, unknown>>,
  allowlist: Set<string>,
) {
  if (allowlist.has(manifestOpKey(op))) return true

  const normalized = normalizeManifestPath(op.pattern)
  if (
    normalized === '/api/auth/*' &&
    (op.method === 'GET' || op.method === 'POST') &&
    authCatchAllCovered(openapiPaths)
  ) {
    return true
  }

  return openapiPaths[normalized]?.[op.method.toLowerCase()] !== undefined
}

export function diffManifestCoverage(args: {
  manifest: ManifestOp[]
  openapiPaths: Record<string, Record<string, unknown>>
  allowlist: ManifestOp[]
}): { missing: ManifestOp[] } {
  const allowlist = new Set(args.allowlist.map(manifestOpKey))
  const missing = args.manifest.filter(
    (op) => !isManifestOpCovered(op, args.openapiPaths, allowlist),
  )

  return { missing }
}
