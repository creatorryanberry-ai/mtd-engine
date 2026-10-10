import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const uploadErrorResponses = [
  {
    status: 400,
    description: 'Invalid multipart form data',
    schema: errorResponseSchema,
  },
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
  { status: 500, description: 'File upload failed', schema: errorResponseSchema },
]

registerRoute({
  method: 'POST',
  path: '/api/file/receipt',
  summary: 'Upload a private receipt',
  description:
    'Uploads the multipart `file` to private receipt storage for the authenticated user.',
  tags: ['file'],
  security: 'bearer',
  requestContentType: 'multipart/form-data',
  output: v.object({
    message: v.literal('Receipt uploaded successfully'),
    url: v.string(),
    key: v.string(),
    attachmentRef: v.string(),
  }),
  errorResponses: uploadErrorResponses,
})

registerRoute({
  method: 'POST',
  path: '/api/file/upload',
  summary: 'Upload a file',
  description:
    'Uploads the multipart `file` to the authenticated user’s generic object storage.',
  tags: ['file'],
  security: 'bearer',
  requestContentType: 'multipart/form-data',
  output: v.object({
    message: v.literal('File uploaded successfully'),
    url: v.string(),
    key: v.string(),
  }),
  errorResponses: uploadErrorResponses,
})
