/** Public sign-up/sign-in UI — only enabled when explicitly opted in at build time. */
export function getIsPublicAuthEnabled(): boolean {
  return (
    import.meta.env.VITE_ALLOW_PUBLIC_AUTH === '1' ||
    import.meta.env.VITE_ALLOW_PUBLIC_AUTH === 'true'
  )
}

export const isPublicAuthEnabled = getIsPublicAuthEnabled()
