/**
 * CipherScan — pages index
 *
 * All routed page components. Registered in App.tsx via wouter <Switch>.
 *
 * Route → File → Purpose
 * ────────────────────────────────────────────────────────────────────────
 * /              Dashboard.tsx     Command Center: live stats, 7-day
 *                                  timeline chart, threat taxonomy chart,
 *                                  recent scans feed.
 *
 * /analyze       Analyze.tsx       URL Analyzer: manually submit a URL or
 *                                  UPI string; renders full ScanResultCard
 *                                  with risk gauge, redirect chain, reasons,
 *                                  screenshot preview.
 *
 * /scans         ScanHistory.tsx   Paginated, filterable scan history table
 *                                  with verdict badges and risk scores.
 *
 * /scans/:id     ScanDetail.tsx    Full detail view for a single scan —
 *                                  risk gauge, redirect chain, VirusTotal
 *                                  score, Google Safe Browsing status.
 *
 * *              not-found.tsx     404 fallback.
 */

export { default as Dashboard }   from "./Dashboard";
export { default as Analyze }     from "./Analyze";
export { default as ScanHistory } from "./ScanHistory";
export { default as ScanDetail }  from "./ScanDetail";
