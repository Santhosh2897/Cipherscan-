import { logger } from "./logger.js";
import { evaluateIndianFraud, IndianFraudResult } from "./indianFraudEngine.js";

export interface ReputationResult {
  riskScore: number;
  verdict: "safe" | "suspicious" | "malicious";
  threatCategory: string | null;
  reasons: string[];
  virusTotalScore: number | null;
  googleSafeBrowsing: boolean;
  indianFraud?: IndianFraudResult;
}

// VirusTotal v3 URL analysis with customizable timeout
async function checkVirusTotal(
  targetUrl: string,
  apiKey: string,
  timeoutMs = 4000
): Promise<{ score: number; reasons: string[] }> {
  try {
    const urlId = Buffer.from(targetUrl).toString("base64").replace(/=/g, "");

    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      // Submit for analysis if not cached (async fire-and-forget, don't wait)
      if (res.status === 404) {
        fetch("https://www.virustotal.com/api/v3/urls", {
          method: "POST",
          headers: { "x-apikey": apiKey, "content-type": "application/x-www-form-urlencoded" },
          body: `url=${encodeURIComponent(targetUrl)}`,
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      }
      return { score: 0, reasons: [] };
    }

    const data = (await res.json()) as {
      data?: {
        attributes?: {
          last_analysis_stats?: { malicious?: number; suspicious?: number; harmless?: number };
          last_analysis_results?: Record<string, { category: string; engine_name: string }>;
        };
      };
    };
    const stats = data?.data?.attributes?.last_analysis_stats ?? {};
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const harmless = stats.harmless ?? 0;
    const total = malicious + suspicious + harmless;

    const score = total > 0 ? Math.round(((malicious + suspicious * 0.5) / total) * 100) : 0;

    const results = data?.data?.attributes?.last_analysis_results ?? {};
    const flaggedEngines = Object.values(results)
      .filter((r) => r.category === "malicious" || r.category === "suspicious")
      .map((r) => r.engine_name)
      .slice(0, 3);

    const reasons: string[] = [];
    if (malicious > 0) reasons.push(`Flagged by ${malicious} VirusTotal vendor${malicious > 1 ? "s" : ""}`);
    if (flaggedEngines.length) reasons.push(`Detected by: ${flaggedEngines.join(", ")}`);

    return { score, reasons };
  } catch (err: any) {
    logger.debug({ err: err.message }, "VirusTotal check skipped or timed out");
    return { score: 0, reasons: [] };
  }
}

// Google Safe Browsing v4 lookup with customizable timeout
async function checkGoogleSafeBrowsing(
  targetUrl: string,
  apiKey: string,
  timeoutMs = 4000
): Promise<{ flagged: boolean; reasons: string[] }> {
  try {
    const body = {
      client: { clientId: "cipherscan", clientVersion: "1.0.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: targetUrl }],
      },
    };

    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );

    if (!res.ok) return { flagged: false, reasons: [] };

    const data = (await res.json()) as { matches?: { threatType?: string }[] };
    const matches = data.matches ?? [];

    if (matches.length === 0) return { flagged: false, reasons: [] };

    const types = [...new Set(matches.map((m) => m.threatType ?? "Unknown").map((t) => t.replace(/_/g, " ").toLowerCase()))];
    const reasons = [`Google Safe Browsing flagged: ${types.join(", ")}`];

    return { flagged: true, reasons };
  } catch (err: any) {
    logger.debug({ err: err.message }, "Google Safe Browsing check skipped or timed out");
    return { flagged: false, reasons: [] };
  }
}

// Heuristic analysis including Indian Banking & UPI engines
function heuristicAnalysis(
  originalUrl: string,
  finalUrl: string,
  redirectChain: string[],
): { score: number; reasons: string[]; indianFraud: IndianFraudResult } {
  const reasons: string[] = [];
  let score = 0;

  // 1. Evaluate Indian Banking & UPI Fraud Heuristics
  const origIndian = evaluateIndianFraud(originalUrl);
  const finalIndian = finalUrl !== originalUrl ? evaluateIndianFraud(finalUrl) : origIndian;

  // Take the most severe Indian fraud verdict
  const primaryIndian = origIndian.riskScore >= finalIndian.riskScore ? origIndian : finalIndian;

  if (primaryIndian.riskScore > 0) {
    score = Math.max(score, primaryIndian.riskScore);
    reasons.push(...primaryIndian.reasons);
  }

  // 2. URL shortener detection
  const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "rb.gy", "cutt.ly", "shorturl.at"];
  const originalDomain = (() => { try { return new URL(originalUrl).hostname; } catch { return ""; } })();
  if (shorteners.some((s) => originalDomain.includes(s))) {
    score += 20;
    reasons.push("Unrolled obfuscated short link");
  }

  // 3. Redirect chain depth
  if (redirectChain.length > 3) {
    score += Math.min(15 * (redirectChain.length - 3), 30);
    reasons.push(`Suspicious redirect chain (${redirectChain.length} hops)`);
  }

  // 4. Domain mismatch
  const finalDomain = (() => { try { return new URL(finalUrl).hostname; } catch { return ""; } })();
  if (originalDomain && finalDomain && originalDomain !== finalDomain) {
    score += 15;
    reasons.push(`Domain changed: ${originalDomain} → ${finalDomain}`);
  }

  // 5. IP address as host
  if (/^\d+\.\d+\.\d+\.\d+/.test(finalDomain)) {
    score += 25;
    reasons.push("Destination is a raw IP address (no domain)");
  }

  // 6. Suspicious TLDs
  const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click", ".live"];
  if (suspiciousTLDs.some((t) => finalDomain.endsWith(t)) && !reasons.some((r) => r.includes("TLD"))) {
    score += 20;
    reasons.push(`Suspicious TLD detected: ${finalDomain.split(".").slice(-2).join(".")}`);
  }

  return { score: Math.min(score, 100), reasons, indianFraud: primaryIndian };
}

function classifyThreat(
  riskScore: number,
  vtScore: number | null,
  gsbFlagged: boolean,
  reasons: string[],
  indianThreatCategory: string | null,
): string | null {
  if (riskScore < 30) return null;

  // Prioritize specific Indian fraud categories if detected
  if (indianThreatCategory) {
    return indianThreatCategory;
  }

  if (gsbFlagged) {
    if (reasons.some((r) => r.toLowerCase().includes("social_engineering") || r.toLowerCase().includes("phishing"))) {
      return "Phishing / Social Engineering";
    }
    if (reasons.some((r) => r.toLowerCase().includes("malware"))) return "Malware Distribution";
    return "Google Safe Browsing Threat";
  }

  if (reasons.some((r) => r.includes("UPI"))) return "UPI Payment Fraud";
  if (reasons.some((r) => r.includes("obfuscated"))) return "Phishing / Obfuscated Redirect";
  if (reasons.some((r) => r.includes("IP address"))) return "Direct IP Attack";
  if (vtScore && vtScore > 10) return "Known Malicious Domain";
  if (reasons.some((r) => r.includes("redirect chain"))) return "Redirect Chain Obfuscation";

  return "Suspicious Activity";
}

export async function analyzeReputation(
  originalUrl: string,
  finalUrl: string,
  redirectChain: string[],
  options: { timeoutMs?: number } = {},
): Promise<ReputationResult> {
  const vtApiKey = process.env["VIRUSTOTAL_API_KEY"] ?? "";
  const gsbApiKey = process.env["GOOGLE_SAFE_BROWSING_API_KEY"] ?? "";
  const timeoutMs = options.timeoutMs ?? 4000;

  const isUpi = originalUrl.toLowerCase().startsWith("upi://");
  const allReasons: string[] = [];

  // Run VT and GSB in parallel (with timeout) — skip for UPI schemes as they are mobile intents
  const [vtResult, gsbResult] = await Promise.allSettled([
    !isUpi && vtApiKey ? checkVirusTotal(finalUrl, vtApiKey, timeoutMs) : Promise.resolve({ score: 0, reasons: [] }),
    !isUpi && gsbApiKey ? checkGoogleSafeBrowsing(finalUrl, gsbApiKey, timeoutMs) : Promise.resolve({ flagged: false, reasons: [] }),
  ]);

  const vt = vtResult.status === "fulfilled" ? vtResult.value : { score: 0, reasons: [] };
  const gsb = gsbResult.status === "fulfilled" ? gsbResult.value : { flagged: false, reasons: [] };
  const heuristic = heuristicAnalysis(originalUrl, finalUrl, redirectChain);

  allReasons.push(...heuristic.reasons, ...vt.reasons, ...gsb.reasons);

  // Combine signals
  const baseScore = Math.min(
    Math.max(heuristic.score, vt.score) + (gsb.flagged ? 40 : 0),
    100,
  );
  const riskScore = Math.max(0, Math.min(baseScore, 100));

  const verdict: "safe" | "suspicious" | "malicious" =
    riskScore >= 70 ? "malicious" : riskScore >= 30 ? "suspicious" : "safe";

  const threatCategory = classifyThreat(
    riskScore,
    vt.score || null,
    gsb.flagged,
    allReasons,
    heuristic.indianFraud.threatCategory,
  );

  return {
    riskScore,
    verdict,
    threatCategory,
    reasons: allReasons.length > 0 ? allReasons : ["No known threats detected"],
    virusTotalScore: vt.score || null,
    googleSafeBrowsing: gsb.flagged,
    indianFraud: heuristic.indianFraud,
  };
}

