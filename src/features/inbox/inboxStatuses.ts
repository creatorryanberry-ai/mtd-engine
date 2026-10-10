export const inboundEmailStatuses = [
  'Received',
  'Processed',
  'PartiallyProcessed',
  'NoValidDocuments',
  'Failed',
] as const

export type InboundEmailStatus = (typeof inboundEmailStatuses)[number]

export const inboxDocumentStatuses = [
  'New',
  'Processing',
  'Processed',
  'Failed',
  'Ignored',
  'Duplicate',
] as const

export type InboxDocumentStatus = (typeof inboxDocumentStatuses)[number]

export const inboxDocumentSources = ['Email', 'Upload', 'Camera', 'Other'] as const

export type InboxDocumentSource = (typeof inboxDocumentSources)[number]
