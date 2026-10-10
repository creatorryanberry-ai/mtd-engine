/** thrown by connectors for operations the provider (or this phase) cannot do */
export class NotSupportedError extends Error {
  readonly connector: string
  readonly operation: string

  constructor(connector: string, operation: string) {
    super(`${connector} does not support ${operation}`)
    this.name = 'NotSupportedError'
    this.connector = connector
    this.operation = operation
  }
}

/** raised when a provider answers with a non-2xx status */
export class ConnectorHttpError extends Error {
  readonly status: number
  readonly body: string

  constructor(connector: string, status: number, body: string) {
    super(`${connector} request failed (${status}): ${body.slice(0, 300)}`)
    this.name = 'ConnectorHttpError'
    this.status = status
    this.body = body
  }
}
