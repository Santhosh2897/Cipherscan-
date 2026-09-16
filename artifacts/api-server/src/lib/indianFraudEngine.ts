/**
 * indianFraudEngine.ts — Specialized Cyber Fraud Heuristics Engine for India
 *
 * Covers:
 *  1. Indian Banking & Government Services typosquatting, Levenshtein distance,
 *     and brand impersonation (SBI, HDFC, ICICI, Axis, PNB, Kotak, IRCTC, India Post, etc.)
 *  2. Free cloud hosting abuse (.firebaseapp.com, .vercel.app, .pages.dev, etc.)
 *     masquerading as Indian financial institutions.
 *  3. Deep UPI Payment Intent parsing (`upi://pay?`):
 *     - Reverse-payment scam detection ("receive cashback/refund" with `am > 0` debit)
 *     - VPA handle impersonation (consumer handles masquerading as official support)
 *     - Deceptive payee names & zero-amount mandate traps
 */

export interface IndianFraudResult {
  isFraud: boolean;
  riskScore: number;
  threatCategory: string | null;
  reasons: string[];
  bankOrOrg?: string;
  upiDetails?: {
    pa: string;
    pn: string;
    am: string | null;
    tn: string | null;
    isReversePaymentScam: boolean;
    isVpaImpersonation: boolean;
  };
}

// ─── Official Indian Financial & Public Utility Domains ─────────────────────
export interface IndianEntity {
  name: string;
  category: "bank" | "govt" | "utility" | "fintech";
  officialDomains: string[];
  keywords: string[];
}

export const INDIAN_ENTITIES: IndianEntity[] = [
  {
    name: "State Bank of India (SBI)",
    category: "bank",
    officialDomains: ["sbi.co.in", "onlinesbi.sbi", "onlinesbi.com", "sbi.bank"],
    keywords: ["sbi", "onlinesbi", "statebank", "sbiyono", "yono"],
  },
  {
    name: "HDFC Bank",
    category: "bank",
    officialDomains: ["hdfcbank.com", "hdfc.com"],
    keywords: ["hdfc", "hdfcbank", "hdfcnetbanking"],
  },
  {
    name: "ICICI Bank",
    category: "bank",
    officialDomains: ["icicibank.com", "icici.com"],
    keywords: ["icici", "icicibank", "imobile"],
  },
  {
    name: "Axis Bank",
    category: "bank",
    officialDomains: ["axisbank.com"],
    keywords: ["axisbank", "axisnetbanking"],
  },
  {
    name: "Punjab National Bank (PNB)",
    category: "bank",
    officialDomains: ["pnbindia.in", "netpnb.com"],
    keywords: ["pnb", "pnbindia", "netpnb"],
  },
  {
    name: "Kotak Mahindra Bank",
    category: "bank",
    officialDomains: ["kotak.com", "kotak811.com"],
    keywords: ["kotak", "kotak811", "kotakbank"],
  },
  {
    name: "Bank of Baroda",
    category: "bank",
    officialDomains: ["bankofbaroda.in", "bobibanking.com", "bobcards.com"],
    keywords: ["bankofbaroda", "bobibanking", "bobworld"],
  },
  {
    name: "Canara Bank",
    category: "bank",
    officialDomains: ["canarabank.com", "canarabank.in"],
    keywords: ["canarabank"],
  },
  {
    name: "Paytm & Paytm Payments Bank",
    category: "fintech",
    officialDomains: ["paytm.com", "paytmbank.com"],
    keywords: ["paytm", "paytmbank", "paytmkyc"],
  },
  {
    name: "IRCTC (Indian Railways)",
    category: "govt",
    officialDomains: ["irctc.co.in", "indianrail.gov.in", "irctctourism.com"],
    keywords: ["irctc", "indianrail", "railconnect", "confirmtkt"],
  },
  {
    name: "India Post",
    category: "govt",
    officialDomains: ["indiapost.gov.in", "indiapostgdsonline.gov.in", "ippbonline.com"],
    keywords: ["indiapost", "speedpost", "dakpay", "ippb"],
  },
  {
    name: "EPFO (Employees' Provident Fund)",
    category: "govt",
    officialDomains: ["epfindia.gov.in", "unifiedportal-mem.epfindia.gov.in"],
    keywords: ["epfindia", "epfo", "epfokyc", "uanepfo"],
  },
  {
    name: "Traffic Police e-Challan / Parivahan",
    category: "govt",
    officialDomains: ["echallan.parivahan.gov.in", "parivahan.gov.in", "mparivahan.gov.in"],
    keywords: ["echallan", "parivahan", "vahan", "sarathi", "trafficchallan"],
  },
  {
    name: "Electricity Boards (Mahadiscom / UPPCL / BSES / TNEB)",
    category: "utility",
    officialDomains: ["mahadiscom.in", "bsesdelhi.com", "uppcl.org", "tnebnet.org", "pspcl.in", "bescom.karnataka.gov.in"],
    keywords: ["mahadiscom", "bijlibill", "electricitybill", "bsesdelhi", "uppcl", "tangedco", "bescom"],
  },
  {
    name: "Income Tax Department & PAN",
    category: "govt",
    officialDomains: ["incometax.gov.in", "incometaxindiaefiling.gov.in", "tin-nsdl.com", "proteantech.in"],
    keywords: ["incometax", "incometaxindia", "panupdate", "pancard", "pankyc"],
  },
];

// Suspicious/Phishing trigger terms in Indian context
const SENSITIVE_ACTION_TERMS = [
  "kyc", "pan", "aadhaar", "update", "verify", "verification",
  "netbanking", "reward", "rewards", "points", "redeem", "cashback",
  "refund", "unblock", "suspended", "expired", "debitcard", "creditcard",
  "mandate", "cutoff", "bill-due", "lottery", "urgent", "login", "secure",
];

// Free host platforms frequently abused for phishing
const FREE_HOST_DOMAINS = [
  "firebaseapp.com", "web.app", "vercel.app", "netlify.app",
  "pages.dev", "workers.dev", "github.io", "gitlab.io",
  "render.com", "glitch.me", "repl.co", "000webhostapp.com",
  "infinityfree.net", "wixsite.com", "weebly.com", "blogspot.com",
];

// Abused TLDs commonly seen in SMS phishing campaigns
const HIGH_RISK_TLDS = [
  ".xyz", ".top", ".click", ".live", ".online", ".site",
  ".buzz", ".club", ".icu", ".vip", ".work", ".rest",
  ".shop", ".cfd", ".link", ".pw", ".tk", ".ml", ".ga", ".cf", ".gq",
];

// Standard consumer UPI VPA handles (PhonePe, GPay, Paytm, BHIM)
const CONSUMER_UPI_HANDLES = [
  "@ybl", "@ibl", "@axl",
  "@okhdfcbank", "@okaxis", "@oksbi", "@okicici",
  "@paytm", "@apl", "@upi", "@barodampay", "@pingpay",
];

/**
 * Fast Levenshtein distance computation
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Extracts root domain (eTLD+1)
 */
function getRootDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;

  const knownTwoPart = new Set([
    "co.in", "org.in", "gov.in", "net.in", "edu.in", "nic.in",
    "co.uk", "com.au", "gov.uk",
  ]);
  const lastTwo = parts.slice(-2).join(".");
  if (knownTwoPart.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * Evaluates Indian Banking and Public Utility web domain heuristics
 */
export function evaluateIndianWebHeuristics(targetUrl: string): IndianFraudResult {
  const reasons: string[] = [];
  let riskScore = 0;
  let detectedEntity: IndianEntity | undefined;

  let hostname = "";
  let pathname = "";
  try {
    const parsed = new URL(targetUrl);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return { isFraud: false, riskScore: 0, threatCategory: null, reasons: [] };
  }

  const rootDomain = getRootDomain(hostname);

  // 1. Check if domain is genuinely official
  for (const entity of INDIAN_ENTITIES) {
    if (entity.officialDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return {
        isFraud: false,
        riskScore: 0,
        threatCategory: null,
        reasons: [`Verified official portal of ${entity.name}`],
        bankOrOrg: entity.name,
      };
    }
  }

  // 2. Check for free cloud host abuse masquerading as banks
  const isFreeCloud = FREE_HOST_DOMAINS.some((f) => hostname.endsWith(f));

  for (const entity of INDIAN_ENTITIES) {
    for (const kw of entity.keywords) {
      if (hostname.includes(kw) || pathname.includes(kw)) {
        detectedEntity = entity;

        // If on free cloud (e.g. sbi-kyc.web.app or hdfc-rewards.vercel.app) -> INSTANT 100% PHISHING
        if (isFreeCloud) {
          riskScore = 95;
          reasons.push(
            `High-Severity Phishing: Free cloud platform (${rootDomain}) impersonating ${entity.name}. Official institutions never host verification on free subdomains.`
          );
        } else {
          // Brand keyword in an unofficial domain
          riskScore += 45;
          reasons.push(
            `Suspected Impersonation: Domain contains '${kw}' referencing ${entity.name}, but is not an authorized official portal.`
          );
        }
        break;
      }
    }
    if (detectedEntity) break;
  }

  // 3. Check for Typosquatting / Levenshtein edit distance
  if (!detectedEntity) {
    for (const entity of INDIAN_ENTITIES) {
      for (const offDomain of entity.officialDomains) {
        const offBase = offDomain.split(".")[0];
        const hostBase = rootDomain.split(".")[0];

        if (hostBase.length >= 4 && offBase.length >= 4) {
          const dist = levenshteinDistance(hostBase, offBase);
          if (dist === 1 || (dist === 2 && offBase.length >= 6)) {
            detectedEntity = entity;
            riskScore = Math.max(riskScore, 75);
            reasons.push(
              `Typosquatting Detected: '${rootDomain}' is dangerously similar to legitimate ${entity.name} domain '${offDomain}' (Levenshtein distance: ${dist}).`
            );
            break;
          }
        }
      }
      if (detectedEntity) break;
    }
  }

  // 4. Check for sensitive Indian scam action keywords (KYC, PAN, electricity cutoff, reward points)
  const matchedActions = SENSITIVE_ACTION_TERMS.filter(
    (action) => hostname.includes(action) || pathname.includes(action)
  );
  if (matchedActions.length > 0) {
    riskScore += matchedActions.length >= 2 ? 30 : 15;
    reasons.push(`Contains high-risk scam triggers: [${matchedActions.join(", ")}]`);
  }

  // 5. Suspicious/abused TLDs combined with financial or action terms
  const hasSuspiciousTLD = HIGH_RISK_TLDS.some((tld) => hostname.endsWith(tld));
  if (hasSuspiciousTLD) {
    if (detectedEntity || matchedActions.length > 0) {
      riskScore += 25;
      reasons.push(`Suspicious low-cost/disposable TLD (${hostname.split(".").pop()}) used for financial-themed link`);
    } else {
      riskScore += 10;
    }
  }

  // 6. Multiple hyphens in hostname (classic deceptive pattern: `sbi-netbanking-kyc-update.com`)
  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount >= 2 && (detectedEntity || matchedActions.length > 0)) {
    riskScore += 20;
    reasons.push(`Deceptive hyphen-stuffed hostname structure (${hyphenCount} hyphens)`);
  }

  riskScore = Math.min(riskScore, 100);
  const isFraud = riskScore >= 50;
  const threatCategory = isFraud
    ? detectedEntity?.category === "bank"
      ? "Indian Banking Phishing"
      : detectedEntity?.category === "govt"
      ? "Government Portal Impersonation"
      : detectedEntity?.category === "utility"
      ? "Electricity / Utility Scam"
      : "Financial Phishing"
    : null;

  return {
    isFraud,
    riskScore,
    threatCategory,
    reasons,
    bankOrOrg: detectedEntity?.name,
  };
}

/**
 * Evaluates UPI Payment Intent Strings (`upi://pay?...`)
 * Catches Reverse-Payment frauds, VPA spoofing, and fake cashback links.
 */
export function evaluateUpiFraud(upiUrl: string): IndianFraudResult {
  const reasons: string[] = [];
  let riskScore = 0;

  if (!upiUrl.toLowerCase().startsWith("upi://pay")) {
    return { isFraud: false, riskScore: 0, threatCategory: null, reasons: [] };
  }

  let pa = "";
  let pn = "";
  let am = "";
  let tn = "";
  let cu = "INR";

  try {
    const parsed = new URL(upiUrl.replace("upi://", "http://fake-host/"));
    pa = (parsed.searchParams.get("pa") || "").trim().toLowerCase();
    pn = (parsed.searchParams.get("pn") || "").trim();
    am = (parsed.searchParams.get("am") || "").trim();
    tn = (parsed.searchParams.get("tn") || "").trim();
    cu = (parsed.searchParams.get("cu") || "INR").trim();
  } catch {
    return {
      isFraud: true,
      riskScore: 80,
      threatCategory: "Malformed UPI Payment Intent",
      reasons: ["Malformed or obfuscated UPI payment string"],
    };
  }

  if (!pa || !pa.includes("@")) {
    return {
      isFraud: true,
      riskScore: 85,
      threatCategory: "Invalid UPI Payment Target",
      reasons: ["UPI intent is missing a valid Virtual Payment Address (VPA / 'pa')"],
    };
  }

  let isReversePaymentScam = false;
  let isVpaImpersonation = false;

  const parsedAmount = parseFloat(am);
  const hasDebitAmount = !isNaN(parsedAmount) && parsedAmount > 0;

  // 1. REVERSE-PAYMENT / COLLECT SCAM DETECTION
  // Scammer claims you are "receiving" money (refund, prize, cashback),
  // but `am=` will DEBIT money from the victim's account!
  const reverseKeywords = [
    "refund", "cashback", "cash-back", "cash_back", "prize", "reward", "rewards",
    "lottery", "bonus", "claim", "claim_now", "received", "winner", "win",
    "gift", "olx", "advance", "settlement", "reimbursement", "govt_scheme", "pm_kisan",
  ];

  const noteLower = tn.toLowerCase();
  const nameLower = pn.toLowerCase();
  const matchedReverseKeywords = reverseKeywords.filter(
    (kw) => noteLower.includes(kw) || nameLower.includes(kw)
  );

  if (hasDebitAmount && matchedReverseKeywords.length > 0) {
    isReversePaymentScam = true;
    riskScore = 95;
    reasons.push(
      `CRITICAL UPI REVERSE-PAYMENT SCAM: Note/Name references '${matchedReverseKeywords.join(", ")}' but link will DEBIT ₹${parsedAmount} from your account! UPI never requires a PIN or pay link to receive funds.`
    );
  }

  // 2. VPA IMPERSONATION DETECTION
  // Scammer creates a consumer handle like `sbi.customercare@ybl` or `paytm.refund@okhdfcbank`
  const [vpaUsername, vpaHandle] = pa.split("@");
  const isConsumerHandle = CONSUMER_UPI_HANDLES.some((h) => `@${vpaHandle}` === h);

  const impersonatedBrands = [
    "sbi", "hdfc", "icici", "axis", "pnb", "kotak", "paytm", "phonepe",
    "gpay", "googlepay", "irctc", "support", "care", "customercare",
    "refund", "helpdesk", "police", "challan", "electricity", "discom", "airtel",
  ];

  const matchedBrandInVpa = impersonatedBrands.filter((b) => vpaUsername.includes(b));

  if (isConsumerHandle && matchedBrandInVpa.length > 0) {
    isVpaImpersonation = true;
    riskScore = Math.max(riskScore, 85);
    reasons.push(
      `Suspicious VPA Impersonation: VPA '${pa}' uses official service terms [${matchedBrandInVpa.join(", ")}] on a personal consumer UPI handle (@${vpaHandle}).`
    );
  }

  // 3. DECEPTIVE PAYEE NAME
  // `pn` claims to be official (e.g. "State Bank of India Helpdesk") but VPA is a personal string
  if (pn) {
    const isOfficialClaimedInName = impersonatedBrands.some((b) => nameLower.includes(b));
    if (isOfficialClaimedInName && isConsumerHandle && !isVpaImpersonation) {
      riskScore = Math.max(riskScore, 75);
      reasons.push(
        `Deceptive Payee Name: Payee claims to be '${pn}' but transfers money to consumer VPA '${pa}'.`
      );
    }
  } else {
    // Missing payee name in UPI link
    riskScore += 15;
    reasons.push("Payee name ('pn') is omitted from UPI intent string");
  }

  // 4. ZERO OR EMPTY AMOUNT DECEPTIVE PROMPT
  if (!am || parsedAmount === 0) {
    if (matchedReverseKeywords.length > 0) {
      riskScore = Math.max(riskScore, 80);
      reasons.push(
        "Deceptive Open-Amount Intent: Link claims refund/reward with open amount to trick user into entering payment or auto-mandate."
      );
    }
  }

  riskScore = Math.min(riskScore, 100);
  const isFraud = riskScore >= 50;
  const threatCategory = isReversePaymentScam
    ? "UPI Reverse-Payment Fraud"
    : isVpaImpersonation
    ? "UPI VPA Impersonation"
    : isFraud
    ? "Suspicious UPI Payment Intent"
    : null;

  return {
    isFraud,
    riskScore,
    threatCategory,
    reasons: reasons.length > 0 ? reasons : ["Valid UPI payment intent with standard parameters"],
    upiDetails: {
      pa,
      pn,
      am: am || null,
      tn: tn || null,
      isReversePaymentScam,
      isVpaImpersonation,
    },
  };
}

/**
 * Master evaluator: seamlessly routes web URLs or UPI intents through Indian heuristics
 */
export function evaluateIndianFraud(url: string): IndianFraudResult {
  if (url.toLowerCase().startsWith("upi://")) {
    return evaluateUpiFraud(url);
  }
  return evaluateIndianWebHeuristics(url);
}
