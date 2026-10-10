import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const signalTypeSchema = v.picklist([
  'vat',
  'company_number',
  'postcode',
  'phone',
  'domain',
  'address_norm',
  'ocr_raw_norm',
])

const processKindSchema = v.picklist(['receipt', 'invoice', 'cis', 'landlord'])

const fingerprintSchema = v.object({
  id: v.string(),
  signalType: signalTypeSchema,
  signalValue: v.string(),
  canonicalName: v.string(),
  sourceSuggestedName: v.nullable(v.string()),
  processKind: v.nullable(processKindSchema),
  privateUsePercent: v.nullable(v.number()),
  hitCount: v.number(),
  updatedAt: v.string(),
})

registerRoute({
  method: 'GET',
  path: '/api/merchant-fingerprints',
  summary: 'List merchant fingerprints',
  description:
    'Returns the authenticated user’s learned merchant fingerprint signals (VAT, company number, process kind, private use, etc.).',
  tags: ['merchant'],
  security: 'bearer',
  output: v.object({ fingerprints: v.array(fingerprintSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/merchant-fingerprints',
  summary: 'Learn merchant fingerprints from a save',
  description:
    'Upserts one fingerprint signal from OCR on every save, including process kind and optional private-use percent.',
  tags: ['merchant'],
  security: 'bearer',
  input: v.object({
    canonicalName: v.string(),
    processKind: processKindSchema,
    sourceSuggestedName: v.optional(v.nullable(v.string())),
    privateUsePercent: v.optional(v.nullable(v.number())),
    ocrText: v.optional(v.string()),
    signals: v.optional(
      v.array(
        v.object({
          type: signalTypeSchema,
          value: v.string(),
        }),
      ),
    ),
  }),
  output: v.object({ fingerprints: v.array(fingerprintSchema) }),
  errorResponses: unauthorizedErrorResponse,
})
