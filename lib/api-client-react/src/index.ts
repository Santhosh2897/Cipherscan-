import { useMutation, useQuery, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "./generated/api.client";
import type {
  AnalyzeInputTriggerType,
  AnalyzeUrlInput,
  ClearScansResponse,
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
  ClearScansResponse,
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

/**
 * DELETE /api/scans — Wipes all scan history records from DB
 */
export function useClearScans(): UseMutationResult<ClearScansResponse, Error, void> {
  return useMutation({
    mutationFn: () => apiDelete<ClearScansResponse>("/api/scans"),
  });
}

// ─── Intelligence Hooks ──────────────────────────────────────────────────────

export interface CommunityStats {
  totalCachedUrls: number;
  totalCommunityFlags: number;
  totalReports: number;
  totalScanHits: number;
  avgUrlScanCount: string;
  verdictBreakdown: { safe: number; suspicious: number; malicious: number };
}

export interface CommunityTrust {
  urlHash: string;
  trustScore: number;
  scanCount: number;
  communityFlags: number;
  verdict: string | null;
  isKnown: boolean;
}

export interface TrendingThreats {
  period: string;
  trendingCategories: Array<{ category: string; count: number; avgRiskScore: number }>;
  topFlaggedUrls: Array<{ urlHash: string; flagCount: number }>;
}

export interface UserPatterns {
  deviceId: string;
  trustedDomains: string[];
  blockedDomains: string[];
  totalDomainsTracked: number;
  totalScansTracked: number;
  topDomains: Array<{ domain: string; scanCount: number; isTrusted: boolean; lastSeen: string }>;
}

/**
 * GET /api/community/stats
 */
export function useGetCommunityStats(): UseQueryResult<CommunityStats> {
  return useQuery({
    queryKey: ["community", "stats"],
    queryFn: () => apiGet<CommunityStats>("/api/community/stats"),
    staleTime: 30_000, // refresh every 30s
  });
}

/**
 * GET /api/community/trust?url=
 */
export function useGetCommunityTrust(
  url: string | null,
  options?: { enabled?: boolean },
): UseQueryResult<CommunityTrust> {
  return useQuery({
    queryKey: ["community", "trust", url],
    queryFn: () => apiGet<CommunityTrust>("/api/community/trust", { url: url ?? undefined }),
    enabled: !!url && (options?.enabled ?? true),
  });
}

/**
 * GET /api/community/trending-threats
 */
export function useGetTrendingThreats(): UseQueryResult<TrendingThreats> {
  return useQuery({
    queryKey: ["community", "trending"],
    queryFn: () => apiGet<TrendingThreats>("/api/community/trending-threats"),
    staleTime: 60_000, // refresh every 60s
  });
}

/**
 * POST /api/community/report
 */
export function useReportThreat(): UseMutationResult<
  { success: boolean; message: string },
  Error,
  { url: string; deviceId: string; reportedVerdict: "malicious" | "suspicious" }
> {
  return useMutation({
    mutationFn: (data) => apiPost("/api/community/report", data),
  });
}

/**
 * GET /api/user/patterns?deviceId=
 */
export function useGetUserPatterns(deviceId: string | null): UseQueryResult<UserPatterns> {
  return useQuery({
    queryKey: ["user", "patterns", deviceId],
    queryFn: () => apiGet<UserPatterns>("/api/user/patterns", { deviceId: deviceId ?? undefined }),
    enabled: !!deviceId,
  });
}

/**
 * POST /api/user/trust
 */
export function useTrustDomain(): UseMutationResult<
  { success: boolean; domain: string; action: string },
  Error,
  { deviceId: string; domain: string; action: "trust" | "block" | "reset" }
> {
  return useMutation({
    mutationFn: (data) => apiPost("/api/user/trust", data),
  });
}
