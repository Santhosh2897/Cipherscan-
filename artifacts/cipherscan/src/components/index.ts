/**
 * CipherScan — components index
 *
 * Re-exports every custom domain component.
 * UI primitives (shadcn/ui) live in ./ui/ and are imported directly.
 *
 * Component → File → Purpose
 * ────────────────────────────────────────────────────────────────────────
 * RiskGauge          RiskGauge.tsx        Semicircular SVG arc gauge (0–100).
 *                                         Color zones: green/amber/red.
 *                                         Animated fill on mount.
 *
 * VerdictBadge       VerdictBadge.tsx     Pill badge: SAFE / SUSPICIOUS / MALICIOUS
 *                                         with matching color and icon.
 *
 * RedirectChain      RedirectChain.tsx    Numbered hop list showing each URL in
 *                                         the redirect chain. Collapsible.
 *
 * ThreatReasonsList  ThreatReasonsList.tsx  Bulleted list of threat reason strings
 *                                           with warning icons.
 *
 * ScanResultCard     ScanResultCard.tsx   Full result card: gauge + badge + chain
 *                                         + reasons + screenshot thumbnail.
 *
 * StatsCard          StatsCard.tsx        KPI tile: large number, label, optional
 *                                         trend indicator.
 *
 * Charts             Charts.tsx           Recharts wrappers:
 *                                           ScanTimelineChart  — area/bar, 7-day volume
 *                                           ThreatCategoryChart — horizontal bar
 *                                           RiskDistributionChart — donut
 *
 * layout/Layout      layout/Layout.tsx    Root shell: sidebar + main content area.
 * layout/Sidebar     layout/Sidebar.tsx   Left navigation: Dashboard, Analyzer, History.
 */

export { RiskGauge }         from "./RiskGauge";
export { VerdictBadge }      from "./VerdictBadge";
export { RedirectChain }     from "./RedirectChain";
export { ThreatReasonsList } from "./ThreatReasonsList";
export { ScanResultCard }    from "./ScanResultCard";
export { StatsCard }         from "./StatsCard";
export * from "./Charts";
