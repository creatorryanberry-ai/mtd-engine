// demo mode is enabled only when explicitly opted in at build time
export function getIsDemoMode(): boolean {
  return (
    import.meta.env.VITE_DEMO_MODE === '1' || import.meta.env.VITE_DEMO_MODE === 'true'
  )
}

export const isDemoMode = getIsDemoMode()
