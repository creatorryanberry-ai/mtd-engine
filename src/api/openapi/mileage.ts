import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const mileageEntrySchema = v.object({
  id: v.string(),
  date: v.string(),
  journeyDetails: v.string(),
  miles: v.number(),
  seriesId: v.nullable(v.string()),
  seriesOverride: v.boolean(),
  rateLabel: v.string(),
  claimPounds: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
})

const mileageSeriesSchema = v.object({
  id: v.string(),
  fromLocation: v.nullable(v.string()),
  journeyDetails: v.string(),
  milesPerJourney: v.number(),
  includesReturnJourney: v.boolean(),
  recurrenceType: v.string(),
  selectedWeekdays: v.array(v.number()),
  startDate: v.string(),
  endDate: v.string(),
  excludedDates: v.array(v.string()),
  deletedDates: v.array(v.string()),
  active: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
  journeyCount: v.number(),
  totalMiles: v.number(),
  claimPounds: v.number(),
})

const mileageSeriesInputSchema = v.object({
  fromLocation: v.optional(v.nullable(v.string())),
  journeyDetails: v.string(),
  milesPerJourney: v.union([v.number(), v.string()]),
  includesReturnJourney: v.optional(v.boolean()),
  recurrenceType: v.string(),
  selectedWeekdays: v.optional(v.array(v.union([v.number(), v.string()]))),
  startDate: v.string(),
  endDate: v.string(),
  excludedDates: v.optional(v.array(v.string())),
})

const mileageInputSchema = v.object({
  date: v.string(),
  journeyDetails: v.string(),
  miles: v.union([v.number(), v.string()]),
})

registerRoute({
  method: 'GET',
  path: '/api/mileage',
  summary: 'List mileage entries',
  description:
    'Returns the authenticated user’s mileage entries and calculated claim values. Pass limit and offset to load a page.',
  tags: ['mileage'],
  security: 'bearer',
  input: v.object({
    limit: v.optional(v.union([v.number(), v.string()])),
    offset: v.optional(v.union([v.number(), v.string()])),
  }),
  output: v.object({
    entries: v.array(mileageEntrySchema),
    totalCount: v.optional(v.number()),
    totalClaimPounds: v.optional(v.number()),
    hasMore: v.optional(v.boolean()),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/mileage',
  summary: 'Create a mileage entry',
  description: 'Creates a mileage entry for the authenticated user.',
  tags: ['mileage'],
  security: 'bearer',
  input: mileageInputSchema,
  output: v.object({ entry: mileageEntrySchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/mileage',
  summary: 'Update a mileage entry',
  description:
    'Replaces the date, journey details, and miles for an authenticated user’s entry.',
  tags: ['mileage'],
  security: 'bearer',
  input: v.intersect([v.object({ id: v.string() }), mileageInputSchema]),
  output: v.object({ entry: mileageEntrySchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'DELETE',
  path: '/api/mileage',
  summary: 'Delete a mileage entry',
  description: 'Deletes a mileage entry owned by the authenticated user.',
  tags: ['mileage'],
  security: 'bearer',
  input: v.object({ id: v.string() }),
  output: v.object({ success: v.literal(true) }),
  errorResponses: [
    ...unauthorizedErrorResponse,
    { status: 404, description: 'Mileage entry not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'GET',
  path: '/api/mileage-series',
  summary: 'List or get mileage series',
  description:
    'Returns the authenticated user’s repeating mileage series, or one series when id is provided.',
  tags: ['mileage'],
  security: 'bearer',
  output: v.object({
    series: v.union([mileageSeriesSchema, v.array(mileageSeriesSchema)]),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/mileage-series',
  summary: 'Create a repeating mileage series',
  description:
    'Creates a series and generates an individual mileage entry for each occurrence.',
  tags: ['mileage'],
  security: 'bearer',
  input: mileageSeriesInputSchema,
  output: v.object({ series: mileageSeriesSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/mileage-series',
  summary: 'Update a repeating mileage series',
  description:
    'Updates an entire series or splits it from a given date for this-and-future changes.',
  tags: ['mileage'],
  security: 'bearer',
  input: v.intersect([
    v.object({
      id: v.string(),
      scope: v.optional(v.string()),
      fromDate: v.optional(v.string()),
    }),
    mileageSeriesInputSchema,
  ]),
  output: v.object({ series: mileageSeriesSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'DELETE',
  path: '/api/mileage-series',
  summary: 'Stop or shorten a repeating mileage series',
  description:
    'Deactivates a series while keeping historical entries, or deletes future generated journeys.',
  tags: ['mileage'],
  security: 'bearer',
  input: v.object({
    id: v.string(),
    scope: v.optional(v.string()),
    fromDate: v.optional(v.string()),
  }),
  output: v.object({ success: v.literal(true) }),
  errorResponses: [
    ...unauthorizedErrorResponse,
    { status: 404, description: 'Mileage series not found', schema: errorResponseSchema },
  ],
})
