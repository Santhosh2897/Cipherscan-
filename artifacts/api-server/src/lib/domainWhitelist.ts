/**
 * CipherScan Global Safe Whitelist
 * ==================================
 * A curated, hard-coded list of universally trusted domains.
 *
 * PURPOSE:
 *   Short-circuit the entire analysis pipeline for popular, globally-reputable
 *   domains (Google, YouTube, Wikipedia, etc.) returning an instant SAFE
 *   result in 0ms with zero API calls, zero latency, and zero cost.
 *
 * HOW IT WORKS:
 *   isGlobalWhitelistedDomain(url) checks if the URL eTLD+1 (effective root domain)
 *   matches any entry in the master set. Subdomains are automatically covered:
 *   e.g., "mail.google.com" and "drive.google.com" both match "google.com".
 *
 * STUDENT PROJECT NOTE (Future Improvements):
 *   - Load this list from a remote JSON config (S3/GitHub) for hot-updates.
 *   - Add a Bloom filter for O(1) membership at massive scale.
 *   - Track per-domain hit counts to measure whitelist effectiveness.
 *
 * MAINTENANCE RULES:
 *   - Only add globally trusted domains — no regional/niche exceptions.
 *   - Use root eTLD+1 only (e.g., "google.com" not "www.google.com").
 *   - Never add banking domains here — they must go through the full scan pipeline.
 */

// Tier 1: Tech Giants
const TECH_GIANTS: string[] = [
  "google.com", "googleapis.com", "googleusercontent.com", "gstatic.com",
  "googlevideo.com", "googletagmanager.com",
  "youtube.com", "youtu.be", "ytimg.com",
  "microsoft.com", "microsoftonline.com", "live.com", "outlook.com",
  "office.com", "sharepoint.com", "onedrive.com", "azure.com",
  "azurewebsites.net", "bing.com", "msn.com",
  "apple.com", "icloud.com",
  "amazon.com", "amazonaws.com", "amazon.in", "amazon.co.uk",
  "meta.com", "facebook.com", "instagram.com", "whatsapp.com",
  "messenger.com", "fbcdn.net", "cdninstagram.com",
  "twitter.com", "x.com", "t.co", "twimg.com",
  "linkedin.com", "licdn.com",
  "github.com", "githubusercontent.com", "githubassets.com", "gitlab.com",
  "cloudflare.com",
  "netflix.com", "nflximg.com",
  "spotify.com", "scdn.co",
  "zoom.us", "zoom.com",
  "slack.com", "notion.so", "dropbox.com", "box.com", "adobe.com", "salesforce.com",
];

// Tier 2: Search Engines & Browsers
const SEARCH_BROWSERS: string[] = [
  "google.co.in", "google.co.uk", "google.de", "google.fr",
  "google.com.au", "google.co.jp", "google.com.br",
  "duckduckgo.com", "yahoo.com", "yahoo.in", "ymail.com",
  "baidu.com", "yandex.com", "yandex.ru",
  "brave.com", "ecosia.org", "startpage.com",
];

// Tier 3: Indian Payment & Government Ecosystem
const INDIA_OFFICIAL: string[] = [
  "gpay.app", "pay.google.com", "phonepe.com", "paytm.com",
  "bhimupi.org.in", "upi.npci.org.in", "npci.org.in",
  "amazonpay.in",
  "incometax.gov.in", "efiling.incometax.gov.in",
  "mca.gov.in", "irdai.gov.in", "sebi.gov.in", "rbi.org.in",
  "nic.in", "gov.in", "uidai.gov.in", "epfindia.gov.in",
  "india.gov.in", "digitalindia.gov.in",
];

// Tier 4: News & Information
const NEWS_INFO: string[] = [
  "wikipedia.org", "wikimedia.org", "wikidata.org", "wikihow.com",
  "bbc.com", "bbc.co.uk", "reuters.com", "apnews.com",
  "nytimes.com", "theguardian.com", "washingtonpost.com",
  "thehindu.com", "ndtv.com", "timesofindia.com", "indiatimes.com",
  "hindustantimes.com", "indianexpress.com", "theprint.in",
  "scroll.in", "livemint.com", "economictimes.com",
];

// Tier 5: Education & Research
const EDUCATION: string[] = [
  "coursera.org", "udemy.com", "edx.org", "khanacademy.org",
  "mit.edu", "stanford.edu", "harvard.edu",
  "arxiv.org", "researchgate.net",
  "springer.com", "sciencedirect.com", "ieee.org", "acm.org",
  "stackoverflow.com", "superuser.com", "askubuntu.com", "stackexchange.com",
];

// Tier 6: Developer & Open Source
const DEVELOPER: string[] = [
  "npmjs.com", "pypi.org", "crates.io", "nuget.org",
  "docker.com", "kubernetes.io",
  "nodejs.org", "python.org", "rust-lang.org", "go.dev",
  "react.dev", "vuejs.org", "angular.io",
  "developer.android.com", "developer.apple.com",
  "developer.mozilla.org", "w3.org", "web.dev",
  "vercel.com", "vercel.app", "netlify.com", "netlify.app",
  "heroku.com", "railway.app", "render.com",
  "supabase.com", "firebase.google.com", "digitalocean.com",
];

// Tier 7: Entertainment & Streaming
const ENTERTAINMENT: string[] = [
  "hotstar.com", "disneyplus.com", "primevideo.com",
  "jiocinema.com", "sonyliv.com", "zee5.com", "mxplayer.in",
  "twitch.tv", "reddit.com", "redd.it", "redditmedia.com",
  "imgur.com", "pinterest.com", "pinimg.com", "tumblr.com",
];

// Tier 8: E-Commerce (Global + India)
const ECOMMERCE: string[] = [
  "flipkart.com", "myntra.com", "meesho.com", "snapdeal.com",
  "jiomart.com", "nykaa.com", "ajio.com", "tatacliq.com",
  "ebay.com", "alibaba.com", "aliexpress.com",
  "shopify.com", "etsy.com",
];

// Tier 9: Communication & Productivity
const COMMUNICATION: string[] = [
  "gmail.com", "protonmail.com", "proton.me", "tutanota.com",
  "telegram.org", "t.me",
  "discord.com", "discordapp.com",
  "skype.com", "webex.com", "signal.org", "line.me", "viber.com",
];

// Tier 10: CDN & Infrastructure
const CDN_INFRA: string[] = [
  "akamaized.net", "akamai.com", "fastly.net",
  "jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
  "bootstrapcdn.com", "fontawesome.com",
  "fonts.googleapis.com", "fonts.gstatic.com",
  "gravatar.com", "wp.com", "wordpress.com", "wordpress.org",
];

// Master Set — O(1) lookup
const ALL_SAFE_DOMAINS: Set<string> = new Set([
  ...TECH_GIANTS,
  ...SEARCH_BROWSERS,
  ...INDIA_OFFICIAL,
  ...NEWS_INFO,
  ...EDUCATION,
  ...DEVELOPER,
  ...ENTERTAINMENT,
  ...ECOMMERCE,
  ...COMMUNICATION,
  ...CDN_INFRA,
]);

/**
 * Extracts the eTLD+1 (effective root domain) from a hostname.
 * Covers subdomains automatically:
 *   "mail.google.com"  → "google.com"
 *   "abc.co.in"        → "abc.co.in"  (2-part SLD)
 *
 * For production: replace with the `tldts` npm package for full PSL support.
 */
function extractRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");

  // Known 2-part SLDs (second-level domains)
  const knownSLDs = new Set([
    "co.in", "co.uk", "com.au", "com.br", "com.sg", "co.jp", "co.nz",
    "org.in", "gov.in", "edu.in", "net.in",
    "ac.uk", "org.uk", "gov.uk", "net.uk",
    "com.hk", "com.tw", "com.mx", "com.ar",
  ]);

  const lastTwo = parts.slice(-2).join(".");
  if (knownSLDs.has(lastTwo)) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}

/**
 * Returns true if the URL's root domain is in the Global Safe Whitelist.
 * Subdomains are automatically covered via eTLD+1 extraction.
 *
 * @param url - Full URL string, e.g. "https://mail.google.com/inbox"
 */
export function isGlobalWhitelistedDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const rootDomain = extractRootDomain(hostname);
    return ALL_SAFE_DOMAINS.has(rootDomain);
  } catch {
    return false;
  }
}

/**
 * Returns the whitelist entry that matched, or null if no match.
 * Useful for logging which rule triggered.
 */
export function getWhitelistMatch(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    const rootDomain = extractRootDomain(hostname);
    return ALL_SAFE_DOMAINS.has(rootDomain) ? rootDomain : null;
  } catch {
    return null;
  }
}

/** Total number of whitelisted root domains — for /health stats. */
export const WHITELIST_SIZE = ALL_SAFE_DOMAINS.size;
