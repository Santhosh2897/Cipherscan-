/**
 * Shared fetch client for the CipherScan backend.
 *
 * Base URL and API key are read from Vite env vars, which must be set in
 * the web dashboard's .env (see artifacts/cipherscan/.env.example):
 *
 *   VITE_API_BASE_URL=http://localhost:8080
 *   VITE_API_KEY=<same value as APP_API_KEY on the backend>
 *
 * The API key requirement was added when /api/* was locked down — without
 * it every request here will get a 401 from the backend.
 */

function getBaseUrl(): string {
  const url = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
  return (url ?? "").replace(/\/$/, "");
}

function getApiKey(): string {
  return (import.meta.env["VITE_API_KEY"] as string | undefined) ?? "";
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
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": getApiKey(),
      ...(init?.headers ?? {}),
    },
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
