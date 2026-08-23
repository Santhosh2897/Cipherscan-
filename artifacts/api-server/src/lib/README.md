# CipherScan — API Server lib

Shared services imported by route handlers.

## Files

### `logger.ts`
Singleton [pino](https://github.com/pinojs/pino) logger.

```typescript
import { logger } from "../lib/logger";
// or via barrel:
import { logger } from "../lib";

// App-level (outside request context):
logger.info({ port }, "Server listening");

// Inside a route handler — use req.log (includes request ID):
router.get("/scans", async (req, res): Promise<void> => {
  req.log.info("Fetching scans");
});
```

### `reputationService.ts`
Parallel threat reputation analysis. Export: `analyzeReputation(originalUrl, finalUrl, redirectChain)`.

Signals combined:
| Source | Weight | Requires |
|---|---|---|
| VirusTotal v3 | malicious vendor count → score | `VIRUSTOTAL_API_KEY` env var |
| Google Safe Browsing v4 | flagged → +40 pts | `GOOGLE_SAFE_BROWSING_API_KEY` env var |
| Heuristics | URL shorteners, redirect depth, TLD, UPI VPA | None |

Returns `ReputationResult`:
```typescript
{
  riskScore: number;          // 0–100
  verdict: "safe" | "suspicious" | "malicious";
  threatCategory: string | null;
  reasons: string[];
  virusTotalScore: number | null;
  googleSafeBrowsing: boolean;
}
```

Gracefully degrades if API keys are absent — heuristics still run.

### `sandboxService.ts`
Playwright Chromium headless sandbox. Export: `analyzeSandbox(targetUrl, serverBaseUrl)`.

- Follows all HTTP 3xx + JS redirects
- Captures `finalUrl` and full `redirectChain`
- Screenshots the final page at 1280×720 JPEG → `/public/previews/{hash}.jpg`
- Returns `previewImageUrl` pointing at the public static path

Returns `SandboxResult`:
```typescript
{
  finalUrl: string;
  redirectChain: string[];
  previewImageUrl: string | null;
}
```

Gracefully degrades (returns original URL, no screenshot) if `playwright` is not installed.

To enable: `pnpm --filter @workspace/api-server add playwright`
