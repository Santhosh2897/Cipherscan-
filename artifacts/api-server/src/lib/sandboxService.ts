import { chromium, Browser } from "playwright";
import { createHash } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import { assertUrlIsSafe } from "./urlSafety.js";
import { evaluateIndianFraud } from "./indianFraudEngine.js";

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

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Creates an instant rich visual card for web URLs while deep sandbox captures live screenshot.
 */
export function createDomainShieldPreviewDataUri(url: string, verdict = "safe"): string {
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {}

  const isSafe = verdict === "safe";
  const isMalicious = verdict === "malicious";
  const badgeBg = isMalicious ? "#ef4444" : isSafe ? "#10b981" : "#f59e0b";
  const badgeText = isMalicious ? "MALICIOUS DETECTED" : isSafe ? "SAFE VERIFIED" : "SUSPICIOUS THREAT";
  const indicatorColor = isMalicious ? "#f87171" : isSafe ? "#34d399" : "#fbbf24";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="600" height="350" fill="#040711"/>
    <rect x="20" y="20" width="560" height="310" rx="14" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="2"/>
    <rect x="44" y="44" width="160" height="28" rx="6" fill="${badgeBg}"/>
    <text x="124" y="63" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${badgeText}</text>
    <circle cx="530" cy="58" r="8" fill="${indicatorColor}"/>
    <text x="512" y="62" fill="#94a3b8" font-family="sans-serif" font-size="11" text-anchor="end">Live Threat Defense</text>
    <text x="44" y="130" fill="#94a3b8" font-family="sans-serif" font-size="13">Inspected Destination Host:</text>
    <text x="44" y="170" fill="#f8fafc" font-family="sans-serif" font-size="24" font-weight="bold">${escapeXml(hostname)}</text>
    <text x="44" y="210" fill="#38bdf8" font-family="monospace" font-size="12">Verified by CipherScan Heuristic Core &amp; Intelligence</text>
    <line x1="44" y1="250" x2="556" y2="250" stroke="#334155" stroke-width="1"/>
    <text x="300" y="285" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">Deep Sandbox Capture Running in Background</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Creates a rich visual card for UPI payment requests with fraud warnings.
 */
export function createUpiPreviewDataUri(url: string): string {
  const fraudEval = evaluateIndianFraud(url);
  const isDanger = fraudEval.isFraud;

  let payee = "Merchant / Payee";
  let pa = "";
  let am = "";
  let tn = "";
  try {
    const parsed = new URL(url.replace("upi://", "http://fake-upi/"));
    pa = parsed.searchParams.get("pa") || "";
    const pn = parsed.searchParams.get("pn") || "";
    am = parsed.searchParams.get("am") || "";
    tn = parsed.searchParams.get("tn") || "";
    if (pn) payee = pn;
    else if (pa) payee = pa;
  } catch {}

  const badgeBg = isDanger ? "#ef4444" : "#0284c7";
  const badgeText = isDanger
    ? fraudEval.threatCategory === "UPI Reverse-Payment Fraud"
      ? "REVERSE-PAYMENT FRAUD"
      : "SUSPICIOUS UPI INTENT"
    : "UPI PAYMENT";
  const statusText = isDanger ? "CRITICAL RISK" : "Secure Gateway";
  const statusColor = isDanger ? "#ef4444" : "#10b981";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">
    <defs>
      <linearGradient id="upiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${isDanger ? "#2a0808" : "#0f172a"}"/>
        <stop offset="100%" stop-color="${isDanger ? "#180606" : "#1e293b"}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="350" fill="#090d16"/>
    <rect x="24" y="24" width="552" height="302" rx="12" fill="url(#upiGrad)" stroke="${isDanger ? "#ef4444" : "#334155"}" stroke-width="2"/>
    <rect x="44" y="44" width="180" height="28" rx="6" fill="${badgeBg}"/>
    <text x="134" y="63" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${escapeXml(badgeText)}</text>
    <circle cx="530" cy="58" r="8" fill="${statusColor}"/>
    <text x="512" y="62" fill="${statusColor}" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="end">${escapeXml(statusText)}</text>
    <text x="44" y="125" fill="#94a3b8" font-family="sans-serif" font-size="13">Payee / Target:</text>
    <text x="44" y="155" fill="#f8fafc" font-family="sans-serif" font-size="20" font-weight="bold">${escapeXml(payee)}</text>
    ${pa ? `<text x="44" y="185" fill="#38bdf8" font-family="monospace" font-size="13">VPA: ${escapeXml(pa)}</text>` : ''}
    ${am ? `<text x="44" y="225" fill="${isDanger ? "#ef4444" : "#34d399"}" font-family="sans-serif" font-size="20" font-weight="bold">Debit Amount: ₹${escapeXml(am)}</text>` : ''}
    ${isDanger ? `<text x="44" y="255" fill="#f87171" font-family="sans-serif" font-size="12" font-weight="bold">⚠️ WARNING: This will DEBIT money from your bank account!</text>` : (tn ? `<text x="44" y="255" fill="#94a3b8" font-family="sans-serif" font-size="12">Note: ${escapeXml(tn)}</text>` : '')}
    <line x1="44" y1="275" x2="556" y2="275" stroke="${isDanger ? "#7f1d1d" : "#334155"}" stroke-width="1"/>
    <text x="300" y="305" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">CipherScan Deep Payment Inspector</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Backwards compatibility fallback generator.
 */
export function createFallbackPreviewDataUri(url: string, verdict = "safe"): string {
  if (url.startsWith("upi://")) {
    return createUpiPreviewDataUri(url);
  }
  return createDomainShieldPreviewDataUri(url, verdict);
}

/**
 * Fetches a genuine screenshot of a website using high-reliability cloud rendering services
 * (Microlink API and S-Shot CDN).
 * Returns a data:image/png;base64,... or data:image/jpeg;base64,... string, or null on failure.
 */
export async function fetchCloudScreenshot(targetUrl: string): Promise<string | null> {
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return null;
  }

  try {
    await assertUrlIsSafe(targetUrl);
  } catch {
    logger.warn({ targetUrl }, "fetchCloudScreenshot blocked unsafe target URL");
    return null;
  }

  const endpoints = [
    `https://api.microlink.io?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false&embed=screenshot.url`,
    `https://mini.s-shot.ru/1024x768/JPEG/1024/Z100/?${encodeURIComponent(targetUrl)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "image/jpeg,image/png,image/*"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1000) {
          const contentType = response.headers.get("content-type") || "image/jpeg";
          const mime = contentType.includes("png") ? "image/png" : "image/jpeg";
          const base64DataUri = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;

          try {
            const hash = createHash("md5").update(targetUrl + Date.now()).digest("hex");
            await mkdir(PREVIEWS_DIR, { recursive: true });
            await writeFile(path.join(PREVIEWS_DIR, `${hash}.jpg`), Buffer.from(buffer));
          } catch {
            // Ignore disk write errors
          }

          return base64DataUri;
        }
      }
    } catch (err: any) {
      logger.debug({ endpoint, error: err.message }, "Cloud screenshot attempt failed, trying next");
    }
  }

  return null;
}

export async function analyzeSandbox(targetUrl: string, serverBaseUrl = ""): Promise<SandboxResult> {
  const redirectChain: string[] = [targetUrl];

  if (targetUrl.startsWith("upi://")) {
    return {
      previewImageUrl: createUpiPreviewDataUri(targetUrl),
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

    // Intercept all requests: block continuous streams and strictly enforce SSRF safety on all navigations & subresources
    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      const resourceType = route.request().resourceType();

      if (resourceType === "media") {
        return route.abort();
      }

      // Allow data URIs
      if (requestUrl.startsWith("data:")) {
        return route.continue();
      }

      try {
        await assertUrlIsSafe(requestUrl);
        return route.continue();
      } catch (err: any) {
        logger.warn({ requestUrl, error: err.message }, "Playwright sandbox blocked request to unsafe/internal address");
        return route.abort("blockedbyclient");
      }
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
    logger.warn({ error: error.message, targetUrl }, "Playwright local sandbox failed, fetching cloud screenshot");

    // Seamlessly capture real visual screenshot using Cloud Screenshot CDN
    const cloudScreenshot = await fetchCloudScreenshot(targetUrl);

    return {
      previewImageUrl: cloudScreenshot,
      finalUrl: targetUrl,
      redirectChain,
      pageTitle: null,
      error: error.message
    };
  }
}

// Alias export for backwards-compatibility
export const runUrlSandbox = analyzeSandbox;