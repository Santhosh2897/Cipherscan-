import { useMutation, useQuery, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { apiGet, apiPost } from "./generated/api.client";
import type {
  AnalyzeInputTriggerType,
  AnalyzeUrlInput,
  DashboardStats,
  ListScansParams,
  ListScansResponse,
  ScanResult,
  ScanTimelineEntry,
  ThreatBreakdownEntry,
} from "./generated/api.schemas";

export type {
  AnalyzeInputTriggerType,
  AnalyzeUrlInput,
  DashboardStats,
  ListScansParams,
  ListScansResponse,
  ScanResult,
  ScanTimelineEntry,
  ThreatBreakdownEntry,
} from "./generated/api.schemas";
export { ApiError } from "./generated/api.client";

/**
 * GET /api/stats
 */
export function useGetDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiGet<DashboardStats>("/api/stats"),
  });
}

/**
 * GET /api/stats/timeline
 */
export function useGetScanTimeline(): UseQueryResult<ScanTimelineEntry[]> {
  return useQuery({
    queryKey: ["stats", "timeline"],
    queryFn: () => apiGet<ScanTimelineEntry[]>("/api/stats/timeline"),
  });
}

/**
 * GET /api/stats/threats
 */
export function useGetThreatBreakdown(): UseQueryResult<ThreatBreakdownEntry[]> {
  return useQuery({
    queryKey: ["stats", "threats"],
    queryFn: () => apiGet<ThreatBreakdownEntry[]>("/api/stats/threats"),
  });
}

/**
 * GET /api/scans
 */
export function useListScans(params: ListScansParams = {}): UseQueryResult<ListScansResponse> {
  return useQuery({
    queryKey: ["scans", params],
    queryFn: () =>
      apiGet<ListScansResponse>("/api/scans", {
        limit: params.limit,
        offset: params.offset,
        verdict: params.verdict,
        deviceId: params.deviceId,
      }),
  });
}

/**
 * Builds the query key used to cache/invalidate a single scan lookup.
 * Exposed so callers (e.g. ScanDetail.tsx) can pass a stable key explicitly.
 */
export function getGetScanQueryKey(id: number): readonly unknown[] {
  return ["scans", id] as const;
}

/**
 * GET /api/scans/:id
 */
export function useGetScan(
  id: number,
  options?: { query?: Partial<UseQueryOptions<ScanResult>> },
): UseQueryResult<ScanResult> {
  const { query: queryOptions } = options ?? {};
  return useQuery({
    queryKey: getGetScanQueryKey(id),
    queryFn: () => apiGet<ScanResult>(`/api/scans/${id}`),
    ...queryOptions,
  });
}

/**
 * POST /api/analyze
 * Usage: useAnalyzeUrl().mutate({ data: { targetUrl, triggerType } })
 */
export function useAnalyzeUrl(): UseMutationResult<ScanResult, Error, { data: AnalyzeUrlInput }> {
  return useMutation({
    mutationFn: ({ data }) => apiPost<ScanResult>("/api/analyze", data),
  });
}
