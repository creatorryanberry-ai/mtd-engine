export type DuplicateCharacterClassFinding = {
  path: string
  line: number
  column: number
  char: string
}

const REGEX_START_CHARS = new Set('=([,:;!&|?{~^%*+-'.split(''))
const REGEX_START_WORDS = new Set([
  'return',
  'case',
  'throw',
  'typeof',
  'void',
  'new',
  'in',
  'of',
  'delete',
  'await',
  'yield',
])

function lineColumn(source: string, index: number) {
  let line = 1
  let lastBreak = -1
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') {
      line++
      lastBreak = i
    }
  }
  return { line, column: index - lastBreak }
}

function lastWord(source: string, index: number) {
  let i = index - 1
  while (i >= 0 && /\s/.test(source[i]!)) i--
  const end = i
  while (i >= 0 && /[A-Za-z]/.test(source[i]!)) i--
  return source.slice(i + 1, end + 1)
}

function prevNonWs(source: string, index: number) {
  let i = index - 1
  while (i >= 0 && /\s/.test(source[i]!)) i--
  return i < 0 ? '' : source[i]!
}

function startsRegexLiteral(source: string, index: number) {
  const prev = prevNonWs(source, index)
  if (prev === '' || REGEX_START_CHARS.has(prev)) return true
  return REGEX_START_WORDS.has(lastWord(source, index))
}

function skipEscape(source: string, index: number) {
  return source[index] === '\\' ? index + 2 : index + 1
}

function findDuplicateCharsInClass(body: string) {
  const seen = new Set<string>()
  const dupes: string[] = []
  const chars = [...body]
  let i = 0
  while (i < chars.length) {
    if (chars[i] === '\\' && i + 1 < chars.length) {
      const escaped = chars[i + 1]!
      if (seen.has(escaped)) dupes.push(escaped)
      else seen.add(escaped)
      i += 2
      continue
    }
    if (i + 2 < chars.length && chars[i + 1] === '-') {
      const start = chars[i]!
      const end = chars[i + 2]!
      if (seen.has(start)) dupes.push(start)
      else seen.add(start)
      if (seen.has(end)) dupes.push(end)
      else seen.add(end)
      i += 3
      continue
    }
    const ch = chars[i]!
    if (seen.has(ch)) dupes.push(ch)
    else seen.add(ch)
    i++
  }
  return dupes
}

function findRegexLiteralRanges(source: string) {
  const ranges: { start: number; end: number }[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    if (ch === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i)
      if (i < 0) break
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      i++
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    if (ch === '/' && startsRegexLiteral(source, i)) {
      const start = i
      i++
      while (i < source.length) {
        const next = source[i]!
        if (next === '\n') break
        if (next === '\\') {
          i = skipEscape(source, i)
          continue
        }
        if (next === '[') {
          i++
          while (i < source.length && source[i] !== ']' && source[i] !== '\n') {
            i = skipEscape(source, i)
          }
          if (source[i] === ']') i++
          continue
        }
        if (next === '/') {
          i++
          while (i < source.length && /[a-z]/i.test(source[i]!)) i++
          ranges.push({ start, end: i })
          break
        }
        i++
      }
      continue
    }
    i++
  }
  return ranges
}

export function findDuplicateCharacterClassChars(
  source: string,
  path: string,
): DuplicateCharacterClassFinding[] {
  const findings: DuplicateCharacterClassFinding[] = []
  for (const range of findRegexLiteralRanges(source)) {
    const literal = source.slice(range.start, range.end)
    const bodyStart = 1
    const flagsStart = literal.lastIndexOf('/')
    const pattern = literal.slice(bodyStart, flagsStart)
    let i = 0
    while (i < pattern.length) {
      const ch = pattern[i]!
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch !== '[') {
        i++
        continue
      }
      const classStart = range.start + bodyStart + i
      i++
      let body = ''
      while (i < pattern.length && pattern[i] !== ']') {
        if (pattern[i] === '\\') {
          body += pattern.slice(i, i + 2)
          i += 2
          continue
        }
        body += pattern[i]
        i++
      }
      for (const char of findDuplicateCharsInClass(body)) {
        const { line, column } = lineColumn(source, classStart)
        findings.push({ path, line, column, char })
      }
      if (pattern[i] === ']') i++
    }
  }
  return findings
}
