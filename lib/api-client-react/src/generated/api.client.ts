/**
 * Shared fetch client for the CipherScan backend.
 *
 * ## Production (Vercel)
 *   - Requests go to `/api/...` (same-origin).
 *   - The Vercel Serverless Function at `api/proxy.ts` forwards them to the
 *     Render backend and injects `x-api-key` server-side.
 *   - No API key is ever present in the browser or the public JS bundle.
 *
 * ## Local development
 *   - Set `VITE_API_BASE_URL=http://localhost:8080` in .env.
 *   - Set `VITE_DEV_API_KEY=<same value as APP_API_KEY on the backend>` in .env.
 *   - Requests go directly to Express; the dev key is added to the header.
 *   - This key is NOT embedded in Vercel builds (Vite tree-shakes it out when
 *     the env var is absent at build time).
 */

/**
 * Returns true when running in a Vercel production/preview deployment.
 * Vercel always sets VERCEL_ENV to "production" | "preview" | "development".
 * We detect it by checking whether the base URL env var is absent (meaning
 * we're on the deployed site, not running the local Vite dev server).
 */
function isProduction(): boolean {
  // In production builds (Vercel), always use same-origin BFF proxy
  if (import.meta.env.PROD) return true;
  const base = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
  return !base || base.trim() === "";
}

function getBaseUrl(): string {
  if (isProduction()) return ""; // same-origin — Vercel rewrites /api/* to BFF proxy
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined ?? "").replace(/\/$/, "");
}

/**
 * Returns the API key to include in local dev requests.
 * Returns an empty string in production — the BFF adds the key server-side.
 */
function getDevApiKey(): string {
  if (isProduction()) return "";
  return (import.meta.env["VITE_DEV_API_KEY"] as string | undefined) ?? "";
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const devKey = getDevApiKey();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  // Only attach x-api-key in local dev. In production the BFF does this
  // server-side so the key never appears in the browser request.
  if (devKey) {
    headers["x-api-key"] = devKey;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON, fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const query = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  return request<T>(`${path}${query && query !== "?" ? query : ""}`);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}
