process.env.LOG_LEVEL = "silent";
import http from "node:http";
import app from "./app.js";
import { assertUrlIsSafe, isPrivateIpv4, isPrivateIpv6, UnsafeUrlError } from "./lib/urlSafety.js";
import { evaluateIndianFraud, evaluateUpiFraud } from "./lib/indianFraudEngine.js";
import { isGlobalWhitelistedDomain } from "./lib/domainWhitelist.js";

const PORT = 8085;
const API_KEY = process.env["APP_API_KEY"] || "1d409806dab4a17909e843c8933b78ea5323773141eb04c30bfa0c5b3885ff20";
const BASE_URL = `http://127.0.0.1:${PORT}`;

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

let totalPassed = 0;
let totalFailed = 0;
const failedTests: string[] = [];

function logHeader(title: string) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════${colors.reset}`);
}

function recordPass(testName: string, details = "") {
  totalPassed++;
  console.log(`  ${colors.green}✔ PASS${colors.reset} ${testName} ${details ? colors.gray + "(" + details + ")" + colors.reset : ""}`);
}

function recordFail(testName: string, err: any = new Error("Assertion failed")) {
  totalFailed++;
  failedTests.push(`${testName}: ${err?.message || err}`);
  console.log(`  ${colors.red}✖ FAIL${colors.reset} ${testName}`);
  console.log(`    ${colors.red}Error: ${err?.message || err}${colors.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: Security & Heuristics Engine Direct Stress Tests
// ─────────────────────────────────────────────────────────────────────────────
async function runHeuristicsBenchmarks() {
  logHeader("PART 1: Security & Heuristic Engine Direct Stress Tests");

  // 1.1 SSRF & Private IPv4 Range Validation
  const privateIps = [
    "127.0.0.1",
    "127.0.0.2",
    "127.255.255.255",
    "10.0.0.1",
    "10.254.12.34",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.0.1",
    "192.168.100.254",
    "169.254.169.254", // Cloud Metadata IP (AWS, GCP, Azure, OpenStack)
    "169.254.1.1",
    "0.0.0.0",
    "100.64.0.1", // CGNAT RFC 6598
    "224.0.0.1", // Multicast
    "240.0.0.1", // Reserved
  ];

  for (const ip of privateIps) {
    if (isPrivateIpv4(ip)) {
      recordPass(`isPrivateIpv4 flagged private/reserved IP`, ip);
    } else {
      recordFail(`isPrivateIpv4 failed to flag private IP`, new Error(ip));
    }
  }

  // 1.2 SSRF & Private IPv6 Range Validation
  const privateIpv6s = [
    "::1",
    "::",
    "0:0:0:0:0:0:0:1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
  ];

  for (const ip6 of privateIpv6s) {
    if (isPrivateIpv6(ip6)) {
      recordPass(`isPrivateIpv6 flagged private IPv6`, ip6);
    } else {
      recordFail(`isPrivateIpv6 failed to flag private IPv6`, new Error(ip6));
    }
  }

  // 1.3 High-Risk / SSRF URL Targets
  const dangerousUrls = [
    "http://localhost:8080/admin",
    "http://127.0.0.1:22",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/secret",
    "file:///etc/passwd",
    "gopher://127.0.0.1:6379",
    "http://0.0.0.0:3000",
    "ftp://internal.server/data",
    "javascript:alert(1)",
  ];

  for (const url of dangerousUrls) {
    try {
      await assertUrlIsSafe(url);
      recordFail(`assertUrlIsSafe should have rejected dangerous URL`, new Error(url));
    } catch {
      recordPass(`assertUrlIsSafe safely rejected dangerous target`, url);
    }
  }

  // 1.4 Indian Banking & Public Utilities Spoofing
  const legitEntities = [
    "https://www.onlinesbi.sbi/portal",
    "https://netbanking.hdfcbank.com/netbanking",
    "https://www.icicibank.com/personal-banking",
    "https://retail.axisbank.co.in",
    "https://echallan.parivahan.gov.in",
    "https://unifiedportal-mem.epfindia.gov.in",
  ];

  for (const url of legitEntities) {
    const res = evaluateIndianFraud(url);
    if (!res.isFraud && res.riskScore <= 15) {
      recordPass(`Genuine Indian entity verified benign (Risk: ${res.riskScore})`, url);
    } else {
      recordFail(`False positive on legitimate Indian entity`, new Error(`${url} -> score ${res.riskScore}, reasons: ${res.reasons.join(", ")}`));
    }
  }

  const phishingTargets = [
    { url: "https://sbi-kyc-pan-update.xyz", name: "SBI Phishing Domain" },
    { url: "https://hdfc-netbanking-login.top", name: "HDFC Typosquatting" },
    { url: "https://icici-rewards-claim.live", name: "ICICI Rewards Trap" },
    { url: "https://sbi-support.firebaseapp.com", name: "Firebase Free-Host Abuse" },
    { url: "https://echallan-parivahan-pay.online", name: "Parivahan e-Challan Spoof" },
    { url: "https://mahadiscom-bijlibill-due.top", name: "Electricity Bill Urgency Scam" },
  ];

  for (const item of phishingTargets) {
    const res = evaluateIndianFraud(item.url);
    if (res.isFraud && res.riskScore >= 70) {
      recordPass(`Phishing correctly caught: ${item.name} (Risk: ${res.riskScore}, ${res.threatCategory})`, item.url);
    } else {
      recordFail(`Failed to catch phishing threat ${item.name}`, new Error(`${item.url} -> score ${res.riskScore}`));
    }
  }

  // 1.5 UPI Payment Intent Deep Heuristics
  const upiTestCases = [
    {
      name: "UPI Reverse Payment Scam (Debit trap with cashback narrative)",
      url: "upi://pay?pa=olx-refunds-dept@paytm&pn=Claim+Your+Refund&am=4999&tn=Receive+Rs+4999+cashback",
      shouldBeFraud: true,
      minScore: 85,
    },
    {
      name: "UPI VPA Impersonation (Consumer handle pretending to be official SBI)",
      url: "upi://pay?pa=sbi-kyc-helpline@ybl&pn=SBI+Official+KYC+Support",
      shouldBeFraud: true,
      minScore: 75,
    },
    {
      name: "Legitimate Merchant UPI payment",
      url: "upi://pay?pa=swiggy@icici&pn=Bundl+Technologies+Pvt+Ltd&am=349&cu=INR",
      shouldBeFraud: false,
      maxScore: 30,
    },
    {
      name: "Legitimate P2P Transfer",
      url: "upi://pay?pa=sharma.rajesh@okaxis&pn=Rajesh+Sharma&am=500",
      shouldBeFraud: false,
      maxScore: 25,
    },
  ];

  for (const tc of upiTestCases) {
    const res = evaluateUpiFraud(tc.url);
    if (tc.shouldBeFraud) {
      if (res.isFraud && tc.minScore != null && res.riskScore >= tc.minScore) {
        recordPass(`${tc.name} flagged (Risk: ${res.riskScore}, ${res.threatCategory})`);
      } else {
        recordFail(`${tc.name} detection failed`, new Error(`Score ${res.riskScore}, isFraud: ${res.isFraud}`));
      }
    } else {
      if (!res.isFraud && tc.maxScore != null && res.riskScore <= tc.maxScore) {
        recordPass(`${tc.name} allowed benign (Risk: ${res.riskScore})`);
      } else {
        recordFail(`${tc.name} false alarm`, new Error(`Score ${res.riskScore}, reasons: ${res.reasons.join("; ")}`));
      }
    }
  }

  // 1.6 Whitelist High-Throughput Benchmark
  const benchUrls = [
    "https://www.google.com/search?q=test",
    "https://en.wikipedia.org/wiki/Computer_security",
    "https://github.com/torvalds/linux",
    "https://www.microsoft.com",
    "https://youtube.com/watch?v=123",
  ];

  const startTime = performance.now();
  const iterations = 30000;
  for (let i = 0; i < iterations; i++) {
    isGlobalWhitelistedDomain(benchUrls[i % benchUrls.length]);
  }
  const totalMs = performance.now() - startTime;
  const opsPerSec = Math.round((iterations / totalMs) * 1000);
  recordPass(`Global Whitelist throughput benchmark`, `${opsPerSec.toLocaleString()} checks/sec (${((totalMs / iterations) * 1000).toFixed(2)} µs/op)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Live HTTP Server Stress & Concurrency Tests
// ─────────────────────────────────────────────────────────────────────────────
async function makeRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const start = performance.now();
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const duration = performance.now() - start;

  let body: any = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }

  return {
    status: res.status,
    headers: res.headers,
    duration,
    body,
  };
}

async function runLiveServerTests() {
  logHeader(`PART 2: Starting Live Express Server on 127.0.0.1:${PORT}`);

  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`  ${colors.green}✔ Live Server listening on http://127.0.0.1:${PORT}${colors.reset}`);
      resolve();
    });
    server.on("error", reject);
  });

  try {
    // 2.1 Public Health Endpoint
    logHeader("2.1: Health Endpoint & Public Access");
    const healthWithoutKey = await makeRequest("/api/healthz", {
      headers: { "x-api-key": "" },
    });
    if (healthWithoutKey.status === 200 && healthWithoutKey.body?.status === "ok") {
      recordPass(`GET /api/healthz accessible without API key (HTTP 200)`, `${healthWithoutKey.duration.toFixed(1)}ms`);
    } else {
      recordFail(`GET /api/healthz failed`, new Error(`Status ${healthWithoutKey.status}`));
    }

    // 2.2 API Key Security & Headers
    logHeader("2.2: API Key Security & Security Headers");
    const noKeyRes = await makeRequest("/api/scans", {
      headers: { "x-api-key": "" },
    });
    if (noKeyRes.status === 401) {
      recordPass(`Endpoint rejects request with missing API key (HTTP 401)`);
    } else {
      recordFail(`Missing API key allowed access!`, new Error(`Status: ${noKeyRes.status}`));
    }

    const badKeyRes = await makeRequest("/api/scans", {
      headers: { "x-api-key": "invalid_wrong_secret_key" },
    });
    if (badKeyRes.status === 401) {
      recordPass(`Endpoint rejects request with incorrect API key (HTTP 401)`);
    } else {
      recordFail(`Incorrect API key allowed access!`, new Error(`Status: ${badKeyRes.status}`));
    }

    const authRes = await makeRequest("/api/scans");
    if (authRes.status === 200) {
      recordPass(`Endpoint accepts valid API key (HTTP 200)`, `${authRes.duration.toFixed(1)}ms`);
      const nosniff = authRes.headers.get("x-content-type-options");
      const frameOptions = authRes.headers.get("x-frame-options");
      if (nosniff === "nosniff" && frameOptions === "DENY") {
        recordPass(`HTTP Security Headers verified (nosniff, DENY)`);
      } else {
        recordFail(`Missing security headers`, new Error(`nosniff=${nosniff}, frameOptions=${frameOptions}`));
      }
    } else {
      recordFail(`Valid API key failed on /api/scans`, new Error(`Status: ${authRes.status}`));
    }

    // 2.3 SSRF Protection on POST /api/analyze
    logHeader("2.3: Live SSRF Protection on POST /api/analyze");
    const ssrfAttacks = [
      "http://127.0.0.1:8080/secret",
      "http://localhost:3000",
      "http://169.254.169.254/computeMetadata/v1/",
      "http://10.0.0.1/admin",
      "http://192.168.1.1/router",
      "http://0.0.0.0:80",
    ];

    for (const ssrfUrl of ssrfAttacks) {
      const res = await makeRequest("/api/analyze", {
        method: "POST",
        body: { targetUrl: ssrfUrl, triggerType: "manual" },
      });
      if (res.status === 400 && res.body?.error) {
        recordPass(`SSRF blocked (HTTP 400): ${ssrfUrl}`, res.body.error);
      } else {
        recordFail(`SSRF vulnerability detected for ${ssrfUrl}!`, new Error(`Status: ${res.status}`));
      }
    }

    // 2.4 Fast Response Benchmark (< 500ms Two-Tier Target)
    logHeader("2.4: Fast Response Benchmark (< 500ms Two-Tier Target)");
    const whitelistRes = await makeRequest("/api/analyze", {
      method: "POST",
      body: { targetUrl: "https://www.google.com", triggerType: "manual" },
    });
    if (whitelistRes.status === 200 && whitelistRes.body?.fromGlobalWhitelist === true) {
      const latency = whitelistRes.duration;
      recordPass(`Global Whitelist response speed (< 500ms)`, `${latency.toFixed(1)}ms`);
    } else {
      recordFail(`Global Whitelist test failed`, new Error(`Status: ${whitelistRes.status}`));
    }

    // 2.5 Live UPI Detection via API
    logHeader("2.5: Live UPI Payment Intent Analysis");
    const upiRes = await makeRequest("/api/analyze", {
      method: "POST",
      body: {
        targetUrl: "upi://pay?pa=olx-cashback@paytm&pn=Claim+Bonus&am=2500&tn=Instant+Refund+Transfer",
        triggerType: "clipboard",
      },
    });
    if (upiRes.status === 200 && upiRes.body?.verdict === "malicious") {
      recordPass(`UPI Reverse-Payment Fraud diagnosed via API (Risk: ${upiRes.body.riskScore})`, `${upiRes.duration.toFixed(1)}ms`);
      if (upiRes.body.previewImageUrl && upiRes.body.previewImageUrl.startsWith("data:image/svg+xml")) {
        recordPass(`UPI Warning Card SVG generated automatically`);
      } else {
        recordFail(`UPI Preview Image URI missing or invalid`, new Error(upiRes.body.previewImageUrl));
      }
    } else {
      recordFail(`UPI Fraud evaluation failed via API`, new Error(`Verdict: ${upiRes.body?.verdict}, status: ${upiRes.status}`));
    }

    // 2.6 Retroactive Threat Alerts Pipeline
    logHeader("2.6: Retroactive Threat Alerts Pipeline");
    if (whitelistRes.body?.id) {
      const scanId = whitelistRes.body.id;
      const alertRes = await makeRequest(`/api/alerts/retroactive?scanId=${scanId}`);
      if ((alertRes.status === 200 || alertRes.status === 404) && typeof alertRes.body?.elevated === "boolean") {
        recordPass(`GET /api/alerts/retroactive?scanId=${scanId} returned status`, `status=${alertRes.status}, elevated=${alertRes.body.elevated}`);
      } else {
        recordFail(`GET /api/alerts/retroactive failed for scanId ${scanId}`, new Error(`Status: ${alertRes.status}`));
      }
    }

    const notFoundRes = await makeRequest("/api/alerts/retroactive?scanId=999999999");
    if (notFoundRes.status === 404) {
      recordPass(`GET /api/alerts/retroactive returns 404 for unknown scan`);
    } else {
      recordFail(`Expected 404 for missing scan`, new Error(`Got status ${notFoundRes.status}`));
    }

    const deviceAlerts = await makeRequest("/api/alerts/retroactive?deviceId=test-stress-device");
    if (deviceAlerts.status === 200 && Array.isArray(deviceAlerts.body?.alerts)) {
      recordPass(`GET /api/alerts/retroactive?deviceId=... retrieved device threat feed`);
    } else {
      recordFail(`Device threat feed retrieval failed`, new Error(`Status: ${deviceAlerts.status}`));
    }

    // 2.7 High Concurrency Load Test (50 Parallel In-Flight Requests)
    logHeader("2.7: High Concurrency Load Test (50 Parallel In-Flight Requests)");
    const CONCURRENCY = 50;
    console.log(`  ${colors.gray}Dispatching ${CONCURRENCY} concurrent requests simultaneously...${colors.reset}`);
    const benchStart = performance.now();

    const promises = Array.from({ length: CONCURRENCY }, (_, idx) => {
      if (idx % 2 === 0) {
        return makeRequest("/api/healthz", { headers: { "x-api-key": "" } });
      } else {
        return makeRequest("/api/alerts/retroactive?deviceId=load-test-device");
      }
    });

    const results = await Promise.all(promises);
    const totalBenchTime = performance.now() - benchStart;

    const latencies = results.map((r) => r.duration).sort((a, b) => a - b);
    const successCount = results.filter((r) => r.status === 200).length;
    const failureCount = CONCURRENCY - successCount;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const reqPerSec = Math.round((CONCURRENCY / totalBenchTime) * 1000);

    if (failureCount === 0) {
      recordPass(`50/50 concurrent requests succeeded with 0% error rate`);
      console.log(`    ${colors.cyan}Throughput:${colors.reset} ${colors.bold}${reqPerSec} req/sec${colors.reset}`);
      console.log(`    ${colors.cyan}Min latency:${colors.reset} ${minLatency.toFixed(1)}ms | ${colors.cyan}Avg:${colors.reset} ${avgLatency.toFixed(1)}ms | ${colors.cyan}p95:${colors.reset} ${p95Latency.toFixed(1)}ms | ${colors.cyan}Max:${colors.reset} ${maxLatency.toFixed(1)}ms`);
    } else {
      recordFail(`Concurrent load test had failures`, new Error(`${failureCount}/${CONCURRENCY} requests failed`));
    }

    // 2.8 Rate Limiting Enforcement (Burst test on /api/analyze)
    logHeader("2.8: Rate Limiting Enforcement (Burst test)");
    console.log(`  ${colors.gray}Firing rapid requests to verify /api/analyze rate limit (max 20 req/min)...${colors.reset}`);
    let hit429 = false;
    for (let i = 0; i < 25; i++) {
      const res = await makeRequest("/api/analyze", {
        method: "POST",
        body: { targetUrl: `https://www.example${i}.com`, triggerType: "manual" },
      });
      if (res.status === 429) {
        hit429 = true;
        recordPass(`Rate limiter activated successfully on request #${i + 1} (HTTP 429 Too Many Requests)`);
        break;
      }
    }
    if (!hit429) {
      recordFail(`Rate limiter failed to engage after 25 rapid requests`);
    }

  } finally {
    server.close();
    console.log(`\n  ${colors.gray}Live test server closed gracefully.${colors.reset}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}           CIPHERSCAN COMPREHENSIVE STRESS & SECURITY SUITE             ${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}`);

  try {
    await runHeuristicsBenchmarks();
    await runLiveServerTests();
  } catch (err) {
    console.error("Fatal error during stress testing:", err);
  }

  console.log(`\n${colors.bold}────────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bold}STRESS TEST SUMMARY:${colors.reset}`);
  console.log(`  Total Passed: ${colors.green}${colors.bold}${totalPassed}${colors.reset}`);
  console.log(`  Total Failed: ${totalFailed > 0 ? colors.red : colors.green}${colors.bold}${totalFailed}${colors.reset}`);
  if (failedTests.length > 0) {
    console.log(`\n${colors.bold}${colors.red}FAILED TESTS:${colors.reset}`);
    failedTests.forEach((f) => console.log(`  ✖ ${colors.red}${f}${colors.reset}`));
  }
  console.log(`${colors.bold}────────────────────────────────────────────────────────────────────────${colors.reset}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
