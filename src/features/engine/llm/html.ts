/** small, dependency-free html helpers for the brand kit importer */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
}

export function decodeEntities(input: string) {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      safeFromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(Number.parseInt(dec, 10)))
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    )
}

function safeFromCodePoint(code: number) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

const DROP_BLOCKS =
  /<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi
const COMMENTS = /<!--[\s\S]*?-->/g
const BLOCK_TAGS =
  /<\/?(p|div|br|li|ul|ol|h[1-6]|section|article|header|footer|nav|main|aside|tr|td|th|table|blockquote|pre|hr|dd|dt|dl|figure|figcaption|form|fieldset)\b[^>]*>/gi

/** strips markup to readable text; keeps rough paragraph breaks */
export function htmlToText(html: string, maxChars = 12_000) {
  const text = html
    .replace(COMMENTS, '')
    .replace(DROP_BLOCKS, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, ' ')
  const decoded = decodeEntities(text)
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return decoded.length > maxChars ? decoded.slice(0, maxChars) : decoded
}

export function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return null
  const title = decodeEntities(match[1]!.replace(/\s+/g, ' ')).trim()
  return title || null
}

function metaContent(tag: string) {
  const content = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const value = content?.[1] ?? content?.[2] ?? content?.[3]
  return value ? decodeEntities(value).trim() || null : null
}

/** plain description wins over og:description wherever they appear */
export function extractMetaDescription(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const key of ['description', 'og:description']) {
    const pattern = new RegExp(
      `\\b(name|property)\\s*=\\s*["']?${key}["']?(?=[\\s/>])`,
      'i',
    )
    for (const tag of metaTags) {
      if (!pattern.test(tag)) continue
      const value = metaContent(tag)
      if (value) return value
    }
  }
  return null
}

const HEX_COLOR = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi

/** expands #abc to #aabbcc and upper-cases the digits */
export function normalizeHex(value: string) {
  const raw = value.replace('#', '').toUpperCase()
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  return `#${full}`
}

/** hex colours from <style> blocks and style="" attributes, most frequent first */
export function extractHexColors(html: string, limit = 12) {
  const sources: string[] = []
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    sources.push(match[1]!)
  }
  for (const match of html.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    sources.push(match[1] ?? match[2] ?? '')
  }
  const counts = new Map<string, number>()
  for (const source of sources) {
    for (const match of source.matchAll(HEX_COLOR)) {
      const hex = normalizeHex(match[0])
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([hex]) => hex)
}
