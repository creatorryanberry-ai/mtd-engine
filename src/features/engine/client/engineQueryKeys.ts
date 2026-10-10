export const engineQueryKeys = {
  all: ['engine'] as const,
  workspaces: (userId: string) => ['engine', 'workspaces', userId] as const,
  workspace: (workspaceId: string) => ['engine', 'workspace', workspaceId] as const,
  members: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'members'] as const,
  brands: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'brands'] as const,
  brandKit: (workspaceId: string, brandId: string) =>
    ['engine', 'workspace', workspaceId, 'brands', brandId, 'kit'] as const,
  connectors: ['engine', 'connectors'] as const,
  connections: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'connections'] as const,
  audit: (workspaceId: string) => ['engine', 'workspace', workspaceId, 'audit'] as const,
  contacts: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'contacts'] as const,
  orders: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'orders'] as const,
  dashboard: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'dashboard'] as const,
  llmCalls: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'llm-calls'] as const,
  experiments: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'experiments'] as const,
  experiment: (workspaceId: string, experimentId: string) =>
    ['engine', 'workspace', workspaceId, 'experiments', experimentId] as const,
  assignment: (workspaceId: string, experimentId: string, contactId: string) =>
    [
      'engine',
      'workspace',
      workspaceId,
      'experiments',
      experimentId,
      'assignment',
      contactId,
    ] as const,
  holdout: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'holdout'] as const,
  incrementalAll: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'incremental'] as const,
  incremental: (workspaceId: string, from: string, to: string) =>
    ['engine', 'workspace', workspaceId, 'incremental', from, to] as const,
  attributionAll: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'attribution'] as const,
  attribution: (
    workspaceId: string,
    query: { from: string; to: string; model: string; lookbackDays: number },
  ) =>
    [
      'engine',
      'workspace',
      workspaceId,
      'attribution',
      query.from,
      query.to,
      query.model,
      query.lookbackDays,
    ] as const,
  metricsDailyAll: (workspaceId: string) =>
    ['engine', 'workspace', workspaceId, 'metrics-daily'] as const,
  metricsDaily: (workspaceId: string, from: string, to: string, channelKey: string) =>
    ['engine', 'workspace', workspaceId, 'metrics-daily', from, to, channelKey] as const,
}
