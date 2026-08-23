import { createHash } from "crypto";
import path from "path";
import fs from "fs/promises";
import { logger } from "./logger";

export interface SandboxResult {
  finalUrl: string;
  redirectChain: string[];
  previewImageUrl: string | null;
}

// Try to dynamically import playwright — it's an optional heavy dep
async function getChromium() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch {
    return null;
  }
}

export async function analyzeSandbox(targetUrl: string, serverBaseUrl: string): Promise<SandboxResult> {
  const chromium = await getChromium();

  if (!chromium) {
    logger.warn("Playwright not available, skipping sandbox analysis");
    return {
      finalUrl: targetUrl,
      redirectChain: [targetUrl],
      previewImageUrl: null,
    };
  }

  const redirectChain: string[] = [targetUrl];
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    });

    const page = await context.newPage();

    // Track redirect chain
    page.on("request", (req) => {
      if (req.isNavigationRequest()) {
        const url = req.url();
        if (!redirectChain.includes(url)) {
          redirectChain.push(url);
        }
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const finalUrl = page.url();
    if (!redirectChain.includes(finalUrl)) {
      redirectChain.push(finalUrl);
    }

    // Capture screenshot
    const hash = createHash("md5").update(targetUrl + Date.now()).digest("hex").slice(0, 12);
    const previewsDir = path.join(process.cwd(), "public", "previews");
    await fs.mkdir(previewsDir, { recursive: true });

    const filename = `${hash}.jpg`;
    const filepath = path.join(previewsDir, filename);

    await page.screenshot({ path: filepath, type: "jpeg", quality: 80, fullPage: false });
    await context.close();

    const previewImageUrl = `${serverBaseUrl}/previews/${filename}`;

    logger.info({ finalUrl, hops: redirectChain.length, previewImageUrl }, "Sandbox analysis complete");

    return { finalUrl, redirectChain, previewImageUrl };
  } catch (err) {
    logger.warn({ err, targetUrl }, "Sandbox analysis failed");
    return {
      finalUrl: targetUrl,
      redirectChain,
      previewImageUrl: null,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
