const MTD_STATIC_PATHS = new Set([
  '/privacy-policy',
  '/terms-of-service',
  '/help',
  '/eula',
])

/** Public MTD-styled pages (landing, auth, legal, help). Excludes /home app routes. */
export function isMtdMarketingPath(pathname: string): boolean {
  if (pathname === '/' || pathname.startsWith('/auth')) {
    return true
  }
  return MTD_STATIC_PATHS.has(pathname)
}
