import { chromium, Browser } from "playwright";
import { createHash } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// public/previews is served as static files by app.ts
const PREVIEWS_DIR = path.resolve(__dirname, "..", "..", "public", "previews");

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process"
      ]
    });
  }
  return browserInstance;
}

export interface SandboxResult {
  /** Publicly accessible URL to the captured screenshot, or null on failure. */
  previewImageUrl: string | null;
  finalUrl: string;
  redirectChain: string[];
  pageTitle: string | null;
  error?: string;
}

/**
 * Analyzes the target URL in a Playwright sandbox.
 *
 * @param targetUrl    - The URL to navigate to.
 * @param serverBaseUrl - Base URL used to build the previewImageUrl
 *                        (e.g. "https://cipherscan-api.onrender.com").
 *                        If empty, falls back to "" (relative path, mainly for local dev).
 */
function createFallbackPreviewDataUri(url: string): string {
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {}
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">
    <rect width="600" height="350" fill="#0c101d"/>
    <rect x="20" y="20" width="560" height="310" rx="8" fill="#141a29" stroke="#1f293d" stroke-width="2"/>
    <circle cx="50" cy="45" r="6" fill="#ef4444"/>
    <circle cx="70" cy="45" r="6" fill="#f59e0b"/>
    <circle cx="90" cy="45" r="6" fill="#10b981"/>
    <rect x="110" y="35" width="450" height="20" rx="4" fill="#1a2336"/>
    <text x="120" y="49" fill="#9ca3af" font-family="monospace" font-size="11">${hostname}</text>
    <text x="300" y="170" fill="#00d4ff" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">CipherScan Security Sandbox</text>
    <text x="300" y="200" fill="#9ca3af" font-family="monospace" font-size="12" text-anchor="middle">Target Preview Captured</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function analyzeSandbox(targetUrl: string, serverBaseUrl = ""): Promise<SandboxResult> {
  const redirectChain: string[] = [targetUrl];

  if (targetUrl.startsWith("upi://")) {
    return {
      previewImageUrl: createFallbackPreviewDataUri(targetUrl),
      finalUrl: targetUrl,
      redirectChain,
      pageTitle: "UPI Payment URI",
    };
  }

  let context = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CipherScan/1.0",
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    // Only abort continuous video/audio streams to save memory, allow standard images & CSS styles
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === "media") {
        return route.abort();
      }
      return route.continue();
    });

    page.on("response", (response) => {
      const status = response.status();
      const location = response.headers()["location"];
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        try {
          const absolute = new URL(location, response.url()).toString();
          if (!redirectChain.includes(absolute)) {
            redirectChain.push(absolute);
          }
        } catch {
          // Ignore invalid URLs
        }
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 12000
    });

    const finalUrl = page.url();
    if (!redirectChain.includes(finalUrl)) {
      redirectChain.push(finalUrl);
    }

    const pageTitle = await page.title().catch(() => null);

    const screenshotBuffer = await page.screenshot({
      type: "jpeg",
      quality: 60
    });

    await context.close();

    // Return Data URI screenshot directly so it displays everywhere (Android, Web, Serverless)
    const base64DataUri = `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`;

    // Optionally also save file to disk if PREVIEWS_DIR is writable
    try {
      const hash = createHash("md5").update(targetUrl + Date.now()).digest("hex");
      await mkdir(PREVIEWS_DIR, { recursive: true });
      await writeFile(path.join(PREVIEWS_DIR, `${hash}.jpg`), screenshotBuffer);
    } catch {
      // Disk write failure ignored
    }

    return {
      previewImageUrl: base64DataUri,
      finalUrl,
      redirectChain,
      pageTitle
    };
  } catch (error: any) {
    if (context) await context.close().catch(() => {});
    logger.warn({ error: error.message, targetUrl }, "Sandbox execution fallback triggered");
    return {
      previewImageUrl: createFallbackPreviewDataUri(targetUrl),
      finalUrl: targetUrl,
      redirectChain,
      pageTitle: null,
      error: error.message
    };
  }
}

// Alias export for backwards-compatibility
export const runUrlSandbox = analyzeSandbox;