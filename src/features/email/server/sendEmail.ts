import { ServerClient } from 'postmark'

import { APP_NAME } from '~/constants/app'
import { server } from '~/env'

export type SendEmailParams = {
  to: string
  subject: string
  textBody: string
  htmlBody?: string
}

let client: ServerClient | null = null

export function isUsablePostmarkToken(token: string) {
  const trimmed = token.trim()
  return trimmed.length > 0 && trimmed !== 'your-postmark-server-token'
}

export function isEmailConfigured() {
  return (
    isUsablePostmarkToken(server.POSTMARK_SERVER_TOKEN) &&
    Boolean(server.POSTMARK_FROM_EMAIL)
  )
}

function getClient() {
  const token = server.POSTMARK_SERVER_TOKEN
  if (!token) {
    throw new Error('POSTMARK_SERVER_TOKEN is not set')
  }
  if (!client) {
    client = new ServerClient(token)
  }
  return client
}

export async function sendEmail({ to, subject, textBody, htmlBody }: SendEmailParams) {
  const from = server.POSTMARK_FROM_EMAIL
  if (!from) {
    throw new Error('POSTMARK_FROM_EMAIL is not set')
  }

  const fromHeader = from.includes('<') ? from : `${APP_NAME} <${from}>`

  return getClient().sendEmail({
    From: fromHeader,
    To: to,
    Subject: subject,
    TextBody: textBody,
    ...(htmlBody ? { HtmlBody: htmlBody } : {}),
    MessageStream: 'outbound',
  })
}
