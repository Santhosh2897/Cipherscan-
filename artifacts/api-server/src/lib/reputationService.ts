import { logger } from "./logger";

export interface ReputationResult {
  riskScore: number;
  verdict: "safe" | "suspicious" | "malicious";
  threatCategory: string | null;
  reasons: string[];
  virusTotalScore: number | null;
  googleSafeBrowsing: boolean;
}

// VirusTotal v3 URL analysis
async function checkVirusTotal(targetUrl: string, apiKey: string): Promise<{ score: number; reasons: string[] }> {
  try {
    const urlId = Buffer.from(targetUrl).toString("base64").replace(/=/g, "");

    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      // Submit for analysis if not cached
      if (res.status === 404) {
        await fetch("https://www.virustotal.com/api/v3/urls", {
          method: "POST",
          headers: { "x-apikey": apiKey, "content-type": "application/x-www-form-urlencoded" },
          body: `url=${encodeURIComponent(targetUrl)}`,
          signal: AbortSignal.timeout(8000),
        });
      }
      return { score: 0, reasons: [] };
    }

    const data = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number; harmless?: number }; last_analysis_results?: Record<string, { category: string; engine_name: string }> } };
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
  } catch (err) {
    logger.warn({ err }, "VirusTotal check failed");
    return { score: 0, reasons: [] };
  }
}

// Google Safe Browsing v4 lookup
async function checkGoogleSafeBrowsing(targetUrl: string, apiKey: string): Promise<{ flagged: boolean; reasons: string[] }> {
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
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) return { flagged: false, reasons: [] };

    const data = (await res.json()) as { matches?: { threatType?: string }[] };
    const matches = data.matches ?? [];

    if (matches.length === 0) return { flagged: false, reasons: [] };

    const types = [...new Set(matches.map((m) => m.threatType ?? "Unknown").map((t) => t.replace(/_/g, " ").toLowerCase()))];
    const reasons = [`Google Safe Browsing flagged: ${types.join(", ")}`];

    return { flagged: true, reasons };
  } catch (err) {
    logger.warn({ err }, "Google Safe Browsing check failed");
    return { flagged: false, reasons: [] };
  }
}

// Heuristic analysis for UPI and obfuscated links
function heuristicAnalysis(originalUrl: string, finalUrl: string, redirectChain: string[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // URL shortener detection
  const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "rb.gy", "cutt.ly", "shorturl.at"];
  const originalDomain = (() => { try { return new URL(originalUrl).hostname; } catch { return ""; } })();
  if (shorteners.some((s) => originalDomain.includes(s))) {
    score += 20;
    reasons.push("Unrolled obfuscated short link");
  }

  // Redirect chain depth
  if (redirectChain.length > 3) {
    score += Math.min(15 * (redirectChain.length - 3), 30);
    reasons.push(`Suspicious redirect chain (${redirectChain.length} hops)`);
  }

  // Domain mismatch
  const finalDomain = (() => { try { return new URL(finalUrl).hostname; } catch { return ""; } })();
  if (originalDomain && finalDomain && originalDomain !== finalDomain) {
    score += 15;
    reasons.push(`Domain changed: ${originalDomain} → ${finalDomain}`);
  }

  // UPI-specific checks
  if (originalUrl.startsWith("upi://")) {
    const params = new URLSearchParams(originalUrl.replace("upi://pay?", ""));
    const pa = params.get("pa") ?? "";
    const suspiciousPAs = ["@paytm", "@ybl", "@oksbi", "@okaxis"];
    if (!suspiciousPAs.some((s) => pa.endsWith(s)) && pa.includes("@")) {
      score += 10;
    }
    if (!params.get("pn")) {
      score += 10;
      reasons.push("UPI payee name missing");
    }
  }

  // IP address as host
  if (/^\d+\.\d+\.\d+\.\d+/.test(finalDomain)) {
    score += 25;
    reasons.push("Destination is a raw IP address (no domain)");
  }

  // Suspicious TLDs
  const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".click", ".live"];
  if (suspiciousTLDs.some((t) => finalDomain.endsWith(t))) {
    score += 20;
    reasons.push(`Suspicious TLD detected: ${finalDomain.split(".").slice(-2).join(".")}`);
  }

  return { score: Math.min(score, 60), reasons };
}

function classifyThreat(riskScore: number, vtScore: number | null, gsbFlagged: boolean, reasons: string[]): string | null {
  if (riskScore < 30) return null;

  if (gsbFlagged) {
    if (reasons.some((r) => r.toLowerCase().includes("social_engineering") || r.toLowerCase().includes("phishing"))) {
      return "Phishing / Social Engineering";
    }
    if (reasons.some((r) => r.toLowerCase().includes("malware"))) return "Malware Distribution";
    return "Google Safe Browsing Threat";
  }

  if (reasons.some((r) => r.includes("obfuscated"))) return "Phishing / Obfuscated Redirect";
  if (reasons.some((r) => r.includes("IP address"))) return "Direct IP Attack";
  if (reasons.some((r) => r.includes("UPI"))) return "UPI Payment Fraud";
  if (vtScore && vtScore > 10) return "Known Malicious Domain";
  if (reasons.some((r) => r.includes("redirect chain"))) return "Redirect Chain Obfuscation";

  return "Suspicious Activity";
}

export async function analyzeReputation(
  originalUrl: string,
  finalUrl: string,
  redirectChain: string[],
): Promise<ReputationResult> {
  const vtApiKey = process.env["VIRUSTOTAL_API_KEY"] ?? "";
  const gsbApiKey = process.env["GOOGLE_SAFE_BROWSING_API_KEY"] ?? "";

  const allReasons: string[] = [];

  // Run VT and GSB in parallel (only if keys provided)
  const [vtResult, gsbResult] = await Promise.allSettled([
    vtApiKey ? checkVirusTotal(finalUrl, vtApiKey) : Promise.resolve({ score: 0, reasons: [] }),
    gsbApiKey ? checkGoogleSafeBrowsing(finalUrl, gsbApiKey) : Promise.resolve({ flagged: false, reasons: [] }),
  ]);

  const vt = vtResult.status === "fulfilled" ? vtResult.value : { score: 0, reasons: [] };
  const gsb = gsbResult.status === "fulfilled" ? gsbResult.value : { flagged: false, reasons: [] };
  const heuristic = heuristicAnalysis(originalUrl, finalUrl, redirectChain);

  allReasons.push(...vt.reasons, ...gsb.reasons, ...heuristic.reasons);

  // Combine signals
  const baseScore = Math.min(vt.score + (gsb.flagged ? 40 : 0) + heuristic.score, 100);
  const riskScore = Math.max(0, Math.min(baseScore, 100));

  const verdict: "safe" | "suspicious" | "malicious" =
    riskScore >= 70 ? "malicious" : riskScore >= 30 ? "suspicious" : "safe";

  const threatCategory = classifyThreat(riskScore, vt.score || null, gsb.flagged, allReasons);

  return {
    riskScore,
    verdict,
    threatCategory,
    reasons: allReasons.length > 0 ? allReasons : ["No known threats detected"],
    virusTotalScore: vt.score || null,
    googleSafeBrowsing: gsb.flagged,
  };
}
