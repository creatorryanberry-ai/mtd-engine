import type { ConnectionOptions } from 'node:tls'

/** pg v8+ treats sslmode=require as verify-full unless uselibpqcompat=true */
export function normalizePgConnectionString(connectionString: string): string {
  if (!connectionString.includes('sslmode=')) return connectionString
  if (connectionString.includes('uselibpqcompat=')) return connectionString
  const join = connectionString.includes('?') ? '&' : '?'
  return `${connectionString}${join}uselibpqcompat=true`
}

export function pgPoolSsl(connectionString: string): ConnectionOptions | undefined {
  if (connectionString.includes('sslmode=disable')) return undefined
  if (connectionString.includes('sslmode=') || connectionString.includes('ssl=true')) {
    return { rejectUnauthorized: false }
  }
  return undefined
}
