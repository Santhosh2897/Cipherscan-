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
export async function analyzeSandbox(targetUrl: string, serverBaseUrl = ""): Promise<SandboxResult> {
  const redirectChain: string[] = [targetUrl];
  let context = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CipherScan/1.0",
      viewport: { width: 1024, height: 600 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    // Abort heavy assets to save memory on 512 MB RAM instance
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (["image", "media", "font"].includes(resourceType)) {
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
      timeout: 10000
    });

    const finalUrl = page.url();
    if (!redirectChain.includes(finalUrl)) {
      redirectChain.push(finalUrl);
    }

    const pageTitle = await page.title().catch(() => null);

    const screenshotBuffer = await page.screenshot({
      type: "jpeg",
      quality: 50
    });

    await context.close();

    // Derive a stable filename from the URL + a timestamp hash.
    const hash = createHash("md5")
      .update(targetUrl + Date.now())
      .digest("hex");
    const filename = `${hash}.jpg`;

    // Ensure the previews directory exists before writing.
    await mkdir(PREVIEWS_DIR, { recursive: true });
    await writeFile(path.join(PREVIEWS_DIR, filename), screenshotBuffer);

    // Build the public URL for the screenshot.
    const base = serverBaseUrl.replace(/\/$/, "");
    const previewImageUrl = `${base}/previews/${filename}`;

    return {
      previewImageUrl,
      finalUrl,
      redirectChain,
      pageTitle
    };
  } catch (error: any) {
    if (context) await context.close().catch(() => {});
    logger.warn({ error: error.message, targetUrl }, "Sandbox execution fallback triggered");
    return {
      previewImageUrl: null,
      finalUrl: targetUrl,
      redirectChain,
      pageTitle: null,
      error: error.message
    };
  }
}

// Alias export for backwards-compatibility
export const runUrlSandbox = analyzeSandbox;