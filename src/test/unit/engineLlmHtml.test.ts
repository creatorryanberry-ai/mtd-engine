import { describe, expect, it } from 'vitest'

import {
  decodeEntities,
  extractHexColors,
  extractMetaDescription,
  extractTitle,
  htmlToText,
  normalizeHex,
} from '~/features/engine/llm/html'

const page = `<!doctype html>
<html>
<head>
  <title>  Northstar &amp; Co &mdash; Roofing </title>
  <meta charset="utf-8">
  <meta property="og:description" content="Ignored when a plain description exists">
  <meta name="description" content="Family roofers in Leeds since 1998 &#8212; 5&#x2a; rated">
  <style>
    :root { --brand: #1A2B3C; --accent: #fa0; }
    .hero { background: #1a2b3c; color: #FFFFFF; }
  </style>
  <script>var secret = "#DEADBE"; window.x = 1 < 2;</script>
</head>
<body>
  <!-- a comment with #123456 -->
  <nav><a href="/">Home</a><a href="/about">About</a></nav>
  <h1 style="color:#fa0">Roofs that last</h1>
  <p>We have fitted <b>2,000+</b> roofs across Yorkshire.&nbsp;Call us.</p>
  <div style='border-color: #ABCDEF'>Trusted by <span>Leeds United</span></div>
  <noscript>enable js</noscript>
  <svg><path fill="#00FF00" d="M0 0"/></svg>
</body>
</html>`

describe('engine llm html helpers', () => {
  it('strips scripts, styles and tags to readable text with paragraph breaks', () => {
    const text = htmlToText(page)
    expect(text).not.toContain('secret')
    expect(text).not.toContain('--brand')
    expect(text).not.toContain('<')
    expect(text).not.toContain('enable js')
    expect(text).toContain('Roofs that last')
    expect(text).toContain('We have fitted 2,000+ roofs across Yorkshire. Call us.')
    expect(text).toContain('Trusted by Leeds United')
    expect(text).toMatch(/^Home About\n/)
    expect(text).not.toContain('a comment')
  })

  it('caps the text length', () => {
    const long = `<p>${'word '.repeat(5000)}</p>`
    expect(htmlToText(long, 100)).toHaveLength(100)
  })

  it('extracts and decodes the title', () => {
    expect(extractTitle(page)).toBe('Northstar & Co — Roofing')
    expect(extractTitle('<html><body>no title</body></html>')).toBeNull()
  })

  it('prefers the plain meta description and decodes numeric entities', () => {
    expect(extractMetaDescription(page)).toBe(
      'Family roofers in Leeds since 1998 — 5* rated',
    )
    expect(extractMetaDescription('<meta name="keywords" content="x">')).toBeNull()
    expect(
      extractMetaDescription('<meta content="OG text" property="og:description">'),
    ).toBe('OG text')
  })

  it('pulls hex colours from css and style attributes only, most frequent first', () => {
    const colors = extractHexColors(page)
    expect(colors[0]).toBe('#1A2B3C')
    expect(colors).toContain('#FFAA00')
    expect(colors).toContain('#FFFFFF')
    expect(colors).toContain('#ABCDEF')
    expect(colors).not.toContain('#DEADBE')
    expect(colors).not.toContain('#123456')
    expect(colors).not.toContain('#00FF00')
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('respects the colour limit', () => {
    const css = `<style>${Array.from({ length: 20 }, (_, i) => `.c${i}{color:#${String(i).padStart(6, '0')}}`).join('')}</style>`
    expect(extractHexColors(css, 5)).toHaveLength(5)
  })

  it('normalizes short hex codes', () => {
    expect(normalizeHex('#fa0')).toBe('#FFAA00')
    expect(normalizeHex('#1a2b3c')).toBe('#1A2B3C')
  })

  it('decodes named, decimal and hex entities and ignores unknown ones', () => {
    expect(decodeEntities('a &lt; b &amp;&amp; c &gt; d &quot;q&quot; &#39;s&#39;')).toBe(
      'a < b && c > d "q" \'s\'',
    )
    expect(decodeEntities('&#x1F600; &#128512; &bogus;')).toBe('😀 😀 &bogus;')
  })
})
