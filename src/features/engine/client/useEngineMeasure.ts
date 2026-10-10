import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '~/features/auth/client/authClient'

import { engineApi } from './engineApi'
import { engineQueryKeys } from './engineQueryKeys'
import { DEFAULT_CHANNEL_KEYS, periodRange } from './measureDisplay'

import type {
  CreateExperimentInput,
  MetricsRollupInput,
  TransitionExperimentInput,
  UpdateExperimentInput,
} from './engineApi'
import type {
  AttributionModelValue,
  EngineExperimentDto,
  ExperimentResultDto,
} from '~/features/engine/contract'
import type { QueryClient } from '@tanstack/react-query'

const DEFAULT_LOOKBACK_DAYS = 30

function invalidateMeasure(queryClient: QueryClient, workspaceId: string) {
  for (const queryKey of [
    engineQueryKeys.dashboard(workspaceId),
    engineQueryKeys.incrementalAll(workspaceId),
    engineQueryKeys.attributionAll(workspaceId),
  ]) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

function invalidateExperiments(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({
    queryKey: engineQueryKeys.experiments(workspaceId),
  })
  void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
}

export function useEngineExperiments(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.experiments(workspaceId ?? ''),
    queryFn: () => engineApi.listExperiments(workspaceId!),
    enabled: !!workspaceId,
  })
  return {
    experiments: query.data ?? [],
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useEngineExperiment(
  workspaceId: string | undefined,
  experimentId: string | undefined,
) {
  const query = useQuery({
    queryKey: engineQueryKeys.experiment(workspaceId ?? '', experimentId ?? ''),
    queryFn: () => engineApi.getExperiment(workspaceId!, experimentId!),
    enabled: !!workspaceId && !!experimentId,
  })
  return {
    experiment: query.data ?? null,
    isLoading: !!workspaceId && !!experimentId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateExperiment(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateExperimentInput) =>
      engineApi.createExperiment(workspaceId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(engineQueryKeys.experiment(workspaceId, data.id), data)
      invalidateExperiments(queryClient, workspaceId)
    },
  })
}

export function useUpdateExperiment(workspaceId: string, experimentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateExperimentInput) =>
      engineApi.updateExperiment(workspaceId, experimentId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(
        engineQueryKeys.experiment(workspaceId, experimentId),
        data,
      )
      invalidateExperiments(queryClient, workspaceId)
    },
  })
}

export function useTransitionExperiment(workspaceId: string, experimentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TransitionExperimentInput) =>
      engineApi.transitionExperiment(workspaceId, experimentId, input),
    onSuccess: () => {
      // the response shape is not pinned in the contract, so refetch rather than trust it
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.experiment(workspaceId, experimentId),
      })
      invalidateExperiments(queryClient, workspaceId)
      invalidateMeasure(queryClient, workspaceId)
    },
  })
}

export function useRefreshExperiment(workspaceId: string, experimentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => engineApi.refreshExperiment(workspaceId, experimentId),
    onSuccess: (result: ExperimentResultDto) => {
      queryClient.setQueryData<EngineExperimentDto>(
        engineQueryKeys.experiment(workspaceId, experimentId),
        (current) => (current ? { ...current, result } : current),
      )
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.experiment(workspaceId, experimentId),
      })
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.experiments(workspaceId),
      })
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.attributionAll(workspaceId),
      })
    },
  })
}

export function useExperimentAssignment(
  workspaceId: string,
  experimentId: string,
  contactId: string | null,
) {
  const query = useQuery({
    queryKey: engineQueryKeys.assignment(workspaceId, experimentId, contactId ?? ''),
    queryFn: () => engineApi.getAssignment(workspaceId, experimentId, contactId!),
    enabled: !!contactId,
    retry: false,
  })
  return {
    assignment: query.data ?? null,
    isLoading: !!contactId && query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function useGlobalHoldout(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.holdout(workspaceId ?? ''),
    queryFn: () => engineApi.getGlobalHoldout(workspaceId!),
    enabled: !!workspaceId,
  })
  return {
    holdout: query.data ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/** changing the rate restarts the incremental baseline, so every measure view refetches */
export function useUpdateGlobalHoldoutRate(workspaceId: string) {
  const auth = useAuth()
  const userId = auth.user?.id || ''
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rate: number) =>
      engineApi.updateWorkspace(workspaceId, { globalHoldoutRate: rate }),
    onSuccess: (data) => {
      queryClient.setQueryData(engineQueryKeys.workspace(workspaceId), data)
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.workspaces(userId) })
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.holdout(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.experiments(workspaceId),
      })
      invalidateMeasure(queryClient, workspaceId)
    },
  })
}

export function useIncremental(
  workspaceId: string | undefined,
  range: { from: string; to: string },
) {
  const query = useQuery({
    queryKey: engineQueryKeys.incremental(workspaceId ?? '', range.from, range.to),
    queryFn: () => engineApi.getIncremental(workspaceId!, range),
    enabled: !!workspaceId,
  })
  return {
    report: query.data ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useAttribution(
  workspaceId: string | undefined,
  params: {
    from: string
    to: string
    model: AttributionModelValue
    lookbackDays?: number
  },
) {
  const lookbackDays = params.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
  const query = useQuery({
    queryKey: engineQueryKeys.attribution(workspaceId ?? '', { ...params, lookbackDays }),
    queryFn: () => engineApi.getAttribution(workspaceId!, { ...params, lookbackDays }),
    enabled: !!workspaceId,
    placeholderData: (previous) => previous,
  })
  return {
    report: query.data ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useMetricsDaily(
  workspaceId: string | undefined,
  params: { from: string; to: string; channelKey?: string },
) {
  const channelKey = params.channelKey ?? 'all'
  const query = useQuery({
    queryKey: engineQueryKeys.metricsDaily(
      workspaceId ?? '',
      params.from,
      params.to,
      channelKey,
    ),
    queryFn: () =>
      engineApi.listMetricsDaily(workspaceId!, {
        from: params.from,
        to: params.to,
        channelKey,
      }),
    enabled: !!workspaceId,
  })
  return {
    rows: query.data ?? [],
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useRunRollup(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MetricsRollupInput) =>
      engineApi.runMetricsRollup(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.metricsDailyAll(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
      invalidateMeasure(queryClient, workspaceId)
    },
  })
}

/** channel picker options: keys seen in attribution, plus common ones and any extras */
export function useChannelOptions(workspaceId: string, extra: (string | null)[] = []) {
  const { report } = useAttribution(workspaceId, {
    ...periodRange('4w'),
    model: 'last_touch',
  })
  const keys = new Set<string>(DEFAULT_CHANNEL_KEYS)
  for (const channel of report?.channels ?? []) {
    if (channel.channelKey && channel.channelKey !== 'all') keys.add(channel.channelKey)
  }
  for (const key of extra) if (key) keys.add(key)
  return [...keys]
}
