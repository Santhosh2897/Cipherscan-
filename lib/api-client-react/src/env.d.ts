interface ImportMetaEnv {
  /** Backend base URL for LOCAL DEV direct calls (e.g. http://localhost:8080). */
  readonly VITE_API_BASE_URL?: string;
  /**
   * Local-dev-only API key (mirrors APP_API_KEY on the backend).
   * Not needed or set in Vercel — the BFF proxy adds the key server-side.
   */
  readonly VITE_DEV_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
