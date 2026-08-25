import { chromium, Browser } from "playwright";
import { logger } from "./logger.js";

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
  screenshotBase64: string | null;
  finalUrl: string;
  redirectChain: string[];
  pageTitle: string | null;
  error?: string;
}

export async function runUrlSandbox(targetUrl: string): Promise<SandboxResult> {
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

    // Abort heavy assets to save memory on 512MB RAM instance
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();
      if (["image", "media", "font"].includes(resourceType)) {
        return route.abort();
      }
      route.continue();
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

    return {
      screenshotBase64: `data:image/jpeg;base64,${screenshotBuffer.toString("base64")}`,
      finalUrl,
      redirectChain,
      pageTitle
    };
  } catch (error: any) {
    if (context) await context.close().catch(() => {});
    logger.warn({ error: error.message, targetUrl }, "Sandbox execution fallback triggered");
    return {
      screenshotBase64: null,
      finalUrl: targetUrl,
      redirectChain,
      pageTitle: null,
      error: error.message
    };
  }
}