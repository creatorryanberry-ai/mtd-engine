import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { server } from '~/env'
import { verifyWebhookBasicAuth } from '~/features/inbox/webhookAuth'
import { processPostmarkInbound } from '~/features/inbox/server/processPostmarkInbound'

import type { Endpoint } from 'one'

registerRoute({
  method: 'POST',
  path: '/api/inbound-email/postmark',
  summary: 'Postmark inbound email webhook',
  description:
    'Receives inbound mail from Postmark, stores supported attachments, and creates inbox items. Does not run financial document processing. Authenticate with HTTP Basic.',
  tags: ['inbox'],
  security: 'public',
  output: v.object({
    ok: v.literal(true),
    status: v.string(),
  }),
})

export const POST: Endpoint = async (request) => {
  if (
    !verifyWebhookBasicAuth(
      request.headers.get('authorization'),
      server.POSTMARK_INBOUND_WEBHOOK_USER,
      server.POSTMARK_INBOUND_WEBHOOK_PASSWORD,
    )
  ) {
    if (
      !server.POSTMARK_INBOUND_WEBHOOK_USER ||
      !server.POSTMARK_INBOUND_WEBHOOK_PASSWORD
    ) {
      return Response.json({ error: 'Inbound email is not configured' }, { status: 503 })
    }
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const result = await processPostmarkInbound(payload, server.INBOUND_EMAIL_DOMAIN)
    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error
    console.info('[inbound-email] webhook error', error)
    return Response.json({ error: 'Webhook failed' }, { status: 500 })
  }
}
