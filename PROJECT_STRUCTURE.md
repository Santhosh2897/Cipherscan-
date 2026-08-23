# CipherScan — Project Structure

Full directory map of every file in the project, grouped by module.
This file is the single source of truth for navigating the codebase.

---

## Top-level layout

```
cipherscan/
├── CIPHERSCAN_PROMPT.md          Original build specification (edit to update)
├── PROJECT_STRUCTURE.md          This file — full file map
├── package.json                  Workspace root (pnpm)
├── pnpm-workspace.yaml           Workspace package discovery + catalog pins
├── tsconfig.base.json            Shared strict TypeScript defaults
├── tsconfig.json                 Solution file for composite libs
│
├── android/                      Android MTD client (see android/README.md)
├── artifacts/                    Runnable applications
│   ├── api-server/               Node.js / Express backend
│   ├── cipherscan/               React + Vite web dashboard
│   └── mockup-sandbox/           Design canvas (Replit internal)
├── lib/                          Shared TypeScript libraries
│   ├── api-spec/                 OpenAPI contract + codegen config
│   ├── api-client-react/         Generated React Query hooks (frontend)
│   ├── api-zod/                  Generated Zod schemas (backend validation)
│   └── db/                       Drizzle ORM schema + DB client
└── scripts/                      Utility scripts
```

---

## android/  — Android MTD Client

> Full docs: `android/README.md`

```
android/
├── README.md                               Module overview + setup guide
├── build.gradle                            Root Gradle (plugin versions)
├── settings.gradle                         Project name, includes :app
├── local.properties.example               Copy → local.properties, set server URL
│
└── app/
    ├── build.gradle                        App dependencies, BuildConfig injection
    └── src/main/
        ├── AndroidManifest.xml             Intent filters: http, https, upi://
        │
        ├── java/com/cipherscan/android/
        │   ├── activity/
        │   │   ├── index.kt                Package description
        │   │   └── LinkInterceptorActivity.kt
        │   │       Transparent OS-triggered activity.
        │   │       Calls POST /api/analyze → routes safe/threat.
        │   │
        │   ├── ui/
        │   │   ├── index.kt                Package description
        │   │   ├── SecurityOverlayBottomSheet.kt
        │   │   │   Threat overlay bottom sheet. Risk gauge, screenshot
        │   │   │   preview, redirect chain, reasons, Abort/Proceed.
        │   │   └── RiskGaugeView.kt
        │   │       Custom View: animated semicircular arc, color-coded.
        │   │
        │   ├── api/
        │   │   ├── index.kt                Package description
        │   │   ├── ApiService.kt           Retrofit interface (POST /api/analyze)
        │   │   └── RetrofitClient.kt       Singleton OkHttp + Retrofit instance
        │   │
        │   └── model/
        │       ├── index.kt                Package description
        │       └── ScanResult.kt           Parcelable response + AnalyzeRequest body
        │
        └── res/
            ├── layout/
            │   ├── layout_security_overlay.xml   Threat bottom sheet layout
            │   ├── activity_link_interceptor.xml  Loading scrim + spinner
            │   └── item_redirect_hop.xml          Single redirect chain row
            └── values/
                ├── colors.xml              CipherScan palette (mirrors web tokens)
                └── strings.xml             All user-facing strings
```

---

## artifacts/api-server/  — Node.js / Express Backend

```
artifacts/api-server/
├── package.json                  Runtime deps: express, drizzle-orm, pino, etc.
├── tsconfig.json
├── build.mjs                     esbuild bundle script
│
└── src/
    ├── index.ts                  Entry point: reads PORT, starts server
    ├── app.ts                    Express app: pino-http, CORS, static /previews, /api router
    │
    ├── lib/                      ── Shared Services ──────────────────────────
    │   ├── README.md             Service documentation (this directory)
    │   ├── index.ts              Barrel export for all lib modules
    │   ├── logger.ts             Singleton pino logger
    │   ├── reputationService.ts  VirusTotal + Google Safe Browsing + heuristics
    │   └── sandboxService.ts     Playwright Chromium sandbox + screenshot capture
    │
    ├── routes/                   ── Route Handlers ───────────────────────────
    │   ├── README.md             Route documentation (this directory)
    │   ├── index.ts              Registers all routers onto root Express router
    │   ├── health.ts             GET  /api/healthz
    │   ├── analyze.ts            POST /api/analyze  ← core analysis endpoint
    │   ├── scans.ts              GET  /api/scans
    │   │                         GET  /api/scans/:id
    │   └── stats.ts              GET  /api/stats
    │                             GET  /api/stats/threats
    │                             GET  /api/stats/timeline
    │
    └── middlewares/              (reserved for future auth / rate-limit middleware)
```

---

## artifacts/cipherscan/  — React + Vite Web Dashboard

```
artifacts/cipherscan/
├── package.json                  Frontend deps (all devDependencies — static build)
├── tsconfig.json
├── vite.config.ts                Vite: BASE_PATH, PORT, aliases, plugins
├── index.html                    HTML shell
│
└── src/
    ├── main.tsx                  React root mount
    ├── App.tsx                   QueryClientProvider, wouter Router, page routes
    ├── index.css                 Design tokens (CSS variables), dark theme, Tailwind
    │
    ├── pages/                    ── Routed Pages ─────────────────────────────
    │   ├── index.ts              Barrel export for all pages
    │   ├── Dashboard.tsx         /           Command Center (stats + charts)
    │   ├── Analyze.tsx           /analyze    URL Analyzer (manual submission)
    │   ├── ScanHistory.tsx       /scans      Paginated scan history table
    │   ├── ScanDetail.tsx        /scans/:id  Full scan detail view
    │   └── not-found.tsx         *           404 fallback
    │
    ├── components/               ── Domain Components ────────────────────────
    │   ├── index.ts              Barrel export for all domain components
    │   ├── RiskGauge.tsx         Semicircular SVG arc gauge (0–100, animated)
    │   ├── VerdictBadge.tsx      SAFE / SUSPICIOUS / MALICIOUS pill badge
    │   ├── RedirectChain.tsx     Collapsible numbered redirect hop list
    │   ├── ThreatReasonsList.tsx Bulleted threat reasons with icons
    │   ├── ScanResultCard.tsx    Full result card (gauge+badge+chain+reasons+screenshot)
    │   ├── StatsCard.tsx         KPI tile (number + label + trend)
    │   ├── Charts.tsx            Recharts wrappers (timeline, taxonomy, distribution)
    │   ├── layout/
    │   │   ├── Layout.tsx        Root shell: sidebar + main content area
    │   │   └── Sidebar.tsx       Left nav: Dashboard, URL Analyzer, Scan History
    │   └── ui/                   shadcn/ui primitives (button, badge, card, etc.)
    │
    ├── hooks/                    ── Custom Hooks ─────────────────────────────
    │   ├── use-mobile.tsx        Breakpoint detection
    │   └── use-toast.ts          Toast notification state
    │
    └── lib/
        └── utils.ts              cn() helper (clsx + tailwind-merge)
```

---

## lib/  — Shared TypeScript Libraries

```
lib/
├── api-spec/
│   ├── openapi.yaml              ★ OpenAPI 3.1 spec — source of truth for ALL API shapes
│   └── orval.config.ts           Codegen config (Orval → React Query hooks + Zod schemas)
│
├── api-client-react/             Generated by codegen — DO NOT edit manually
│   └── src/generated/
│       ├── api.ts                React Query hooks: useAnalyzeUrl, useListScans, etc.
│       └── api.schemas.ts        TypeScript types for all API shapes
│
├── api-zod/                      Generated by codegen — DO NOT edit manually
│   └── src/generated/
│       └── api.ts                Zod schemas: AnalyzeUrlBody, ListScansQueryParams, etc.
│
└── db/
    ├── drizzle.config.ts         Drizzle Kit config (DATABASE_URL, push/migrate)
    └── src/
        ├── index.ts              Exports: db client, pool, all schema tables
        └── schema/
            ├── index.ts          Barrel export for all tables
            └── scans.ts          scansTable — all scan records persisted here
```

---

## API Hooks Quick Reference

Import from `@workspace/api-client-react`:

| Hook | Type | Endpoint |
|---|---|---|
| `useAnalyzeUrl` | Mutation | `POST /api/analyze` |
| `useListScans(params?)` | Query | `GET /api/scans` |
| `useGetScan(id)` | Query | `GET /api/scans/:id` |
| `useGetDashboardStats()` | Query | `GET /api/stats` |
| `useGetThreatBreakdown()` | Query | `GET /api/stats/threats` |
| `useGetScanTimeline()` | Query | `GET /api/stats/timeline` |

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| Background | `#0A0E1A` | App background |
| Surface | `#111827` | Cards, panels |
| Border | `#1F2937` | Dividers |
| Accent Cyan | `#00D4FF` | Primary brand |
| Accent Purple | `#7C3AED` | Secondary |
| Safe Green | `#10B981` | Safe verdict |
| Warning Amber | `#F59E0B` | Suspicious verdict |
| Danger Red | `#EF4444` | Malicious verdict |
| Text Primary | `#F9FAFB` | Headlines |
| Text Muted | `#6B7280` | Labels, captions |

## Codegen workflow

After editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates both `lib/api-client-react` and `lib/api-zod` and runs `typecheck:libs`.

## Environment variables

| Key | Required | Used by | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | api-server, db | Postgres connection string |
| `SESSION_SECRET` | Yes | api-server | Express session signing |
| `VIRUSTOTAL_API_KEY` | No | reputationService | VirusTotal v3 lookups |
| `GOOGLE_SAFE_BROWSING_API_KEY` | No | reputationService | GSB v4 threat lookups |
| `SERVER_BASE_URL` | No | sandboxService | Base URL for preview image URLs |
