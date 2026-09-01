/**
 * Type definitions consumed by the web dashboard. These mirror the actual
 * JSON shapes returned by the backend (see @workspace/api-zod for the
 * canonical zod schemas the backend validates against — these types are
 * kept in sync with those by hand rather than re-exporting the zod types
 * directly, so this package has no runtime dependency on zod itself).
 *
 * Referenced directly from dashboard components as:
 *   import { ScanResult } from '@workspace/api-client-react/src/generated/api.schemas';
 */

export type ScanResultVerdict = "safe" | "suspicious" | "malicious";

export type ListScansVerdict = ScanResultVerdict;

export type AnalyzeInputTriggerType = "camera" | "link" | "manual";

export interface ScanResult {
  id: number;
  originalUrl: string;
  finalUrl: string;
  isSafe: boolean;
  riskScore: number;
  verdict: ScanResultVerdict;
  threatCategory: string | null;
  redirectChain: string[];
  reasons: string[];
  previewImageUrl: string | null;
  triggerType: AnalyzeInputTriggerType;
  deviceId?: string | null;
  deviceName?: string | null;
  virusTotalScore: number | null;
  googleSafeBrowsing: boolean;
  createdAt: string;
}

export interface ListScansResponse {
  items: ScanResult[];
  total: number;
}

export interface DashboardStats {
  totalScans: number;
  threatsBlocked: number;
  safeLinks: number;
  suspiciousLinks: number;
  mobileScans?: number;
  webScans?: number;
  activeDevicesCount?: number;
  avgRiskScore: number;
  scansTodayCount: number;
  topThreatCategory: string | null;
  securityScore?: number;
  securityLevel?: string;
}

export interface ThreatBreakdownEntry {
  category: string;
  count: number;
}

export interface ScanTimelineEntry {
  date: string;
  total: number;
  threats: number;
}

export interface AnalyzeUrlInput {
  targetUrl: string;
  triggerType: AnalyzeInputTriggerType;
  deviceId?: string;
  deviceName?: string;
}

export interface ListScansParams {
  limit?: number;
  offset?: number;
  verdict?: ListScansVerdict;
  deviceId?: string;
}
