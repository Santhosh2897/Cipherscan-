# CipherScan — API Routes

All routes are mounted under `/api` by `app.ts`.
Each file exports a single Express `Router` and is registered in `index.ts`.

| File | Mount path(s) | Description |
|---|---|---|
| `health.ts` | `GET /api/healthz` | Liveness probe |
| `analyze.ts` | `POST /api/analyze` | Core analysis endpoint — runs sandbox + reputation in parallel, persists scan to DB |
| `scans.ts` | `GET /api/scans` `GET /api/scans/:id` | Scan history list (paginated, filterable by verdict) and single scan detail |
| `stats.ts` | `GET /api/stats` `GET /api/stats/threats` `GET /api/stats/timeline` | Dashboard KPIs, threat category breakdown, 7-day scan timeline |

## Request / Response contracts

All shapes are code-generated from `lib/api-spec/openapi.yaml`.

- **Zod schemas** (server-side validation): `@workspace/api-zod`
- **React Query hooks** (frontend): `@workspace/api-client-react`

After changing `openapi.yaml`, regenerate with:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Adding a new route

1. Create `artifacts/api-server/src/routes/myfeature.ts`
2. Export a default `Router`
3. Import and register it in `artifacts/api-server/src/routes/index.ts`
4. Add the endpoint to `lib/api-spec/openapi.yaml`
5. Run codegen
