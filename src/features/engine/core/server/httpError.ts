/** throwable json error; defineRoute returns Response instances as-is */
export function httpError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function requireParam(params: Record<string, string>, name: string) {
  const value = params[name]
  if (!value) throw httpError(400, `Missing ${name}`)
  return value
}
