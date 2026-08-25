import { logger } from "./logger.js";

interface CachedReputation {
  data: any;
  timestamp: number;
}

const reputationCache = new Map<string, CachedReputation>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function analyzeReputation(domain: string) {
  const cached = reputationCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info({ domain }, "Serving domain reputation from cache");
    return cached.data;
  }

  const result: {
    domain: string;
    virustotalScore: number | null;
    googleSafeBrowsingMatch: boolean;
    creationDate: string | null;
    registrar: string | null;
  } = {
    domain,
    virustotalScore: 0,
    googleSafeBrowsingMatch: false,
    creationDate: null,
    registrar: null
  };

  const vtKey = process.env.VIRUSTOTAL_API_KEY;
  if (vtKey) {
    try {
      const vtRes = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
        headers: { "x-apikey": vtKey }
      });
      if (vtRes.ok) {
        const json: any = await vtRes.json();
        result.virustotalScore = json?.data?.attributes?.last_analysis_stats?.malicious || 0;
        const creationUnix = json?.data?.attributes?.creation_date;
        if (creationUnix) {
          result.creationDate = new Date(creationUnix * 1000).toISOString();
        }
        result.registrar = json?.data?.attributes?.registrar || null;
      }
    } catch (err: any) {
      logger.warn({ err: err.message, domain }, "VirusTotal query failed");
    }
  }

  const gsbKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (gsbKey) {
    try {
      const gsbRes = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${gsbKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "cipherscan", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: `http://${domain}/` }]
          }
        })
      });
      if (gsbRes.ok) {
        const json: any = await gsbRes.json();
        result.googleSafeBrowsingMatch = Boolean(json?.matches && json.matches.length > 0);
      }
    } catch (err: any) {
      logger.warn({ err: err.message, domain }, "Google Safe Browsing query failed");
    }
  }

  reputationCache.set(domain, { data: result, timestamp: Date.now() });
  return result;
}

// Alias export for backwards-compatibility
export const checkDomainReputation = analyzeReputation;