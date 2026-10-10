import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { engineApi } from './engineApi'
import { engineQueryKeys } from './engineQueryKeys'

import type {
  ImportBrandKitInput,
  UpsertBrandInput,
  UpsertBrandKitInput,
} from './engineApi'

export function useEngineBrands(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: engineQueryKeys.brands(workspaceId ?? ''),
    queryFn: () => engineApi.listBrands(workspaceId!),
    enabled: !!workspaceId,
  })
  const brands = query.data ?? []
  return {
    brands,
    defaultBrand: brands.find((brand) => brand.isDefault) ?? brands[0] ?? null,
    isLoading: !!workspaceId && query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function useCreateBrand(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertBrandInput) => engineApi.createBrand(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.brands(workspaceId),
      })
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

export function useEngineBrandKit(
  workspaceId: string | undefined,
  brandId: string | undefined,
) {
  const query = useQuery({
    queryKey: engineQueryKeys.brandKit(workspaceId ?? '', brandId ?? ''),
    queryFn: () => engineApi.getBrandKit(workspaceId!, brandId!),
    enabled: !!workspaceId && !!brandId,
  })
  return {
    kit: query.data ?? null,
    isLoading: !!workspaceId && !!brandId && query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function useSaveBrandKit(workspaceId: string, brandId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertBrandKitInput) =>
      engineApi.saveBrandKit(workspaceId, brandId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(engineQueryKeys.brandKit(workspaceId, brandId), data)
      void queryClient.invalidateQueries({ queryKey: engineQueryKeys.audit(workspaceId) })
    },
  })
}

/** returns a draft; nothing is saved until useSaveBrandKit runs */
export function useImportBrandKit(workspaceId: string, brandId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportBrandKitInput) =>
      engineApi.importBrandKit(workspaceId, brandId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: engineQueryKeys.llmCalls(workspaceId),
      })
    },
  })
}
