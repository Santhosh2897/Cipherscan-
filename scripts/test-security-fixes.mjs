import { assertUrlIsSafe, isPrivateIpv4, isPrivateIpv6, isPrivateOrReservedHost, UnsafeUrlError } from "../artifacts/api-server/src/lib/urlSafety.ts";
import crypto from "node:crypto";

console.log("=== Running CipherScan Security Hardening Tests ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function testSsrf() {
  console.log("--- Testing SSRF & IP Validation ---");

  // 1. Direct private IPv4
  assert(isPrivateIpv4("127.0.0.1"), "127.0.0.1 is marked private");
  assert(isPrivateIpv4("10.0.0.1"), "10.0.0.1 is marked private");
  assert(isPrivateIpv4("172.16.0.1"), "172.16.0.1 is marked private");
  assert(isPrivateIpv4("192.168.1.1"), "192.168.1.1 is marked private");
  assert(isPrivateIpv4("169.254.169.254"), "169.254.169.254 (Cloud metadata) is marked private");
  assert(isPrivateIpv4("100.64.0.1"), "100.64.0.1 (CGNAT) is marked private");
  assert(!isPrivateIpv4("8.8.8.8"), "8.8.8.8 (Google DNS) is public");
  assert(!isPrivateIpv4("93.184.216.34"), "93.184.216.34 (example.com) is public");

  // 2. IPv6
  assert(isPrivateIpv6("::1"), "::1 (loopback) is marked private");
  assert(isPrivateIpv6("::"), ":: (unspecified) is marked private");
  assert(isPrivateIpv6("::ffff:127.0.0.1"), "IPv4-mapped IPv6 loopback is marked private");
  assert(isPrivateIpv6("fe80::1"), "fe80::1 (link-local) is marked private");
  assert(isPrivateIpv6("fc00::1"), "fc00::1 (ULA) is marked private");

  // 3. Obfuscated hosts
  assert(isPrivateOrReservedHost("localhost"), "localhost is reserved");
  assert(isPrivateOrReservedHost("test.localhost"), "*.localhost is reserved");
  assert(isPrivateOrReservedHost("myhost.internal"), "*.internal is reserved");
  assert(isPrivateOrReservedHost("2130706433"), "Decimal IP 2130706433 is blocked");
  assert(isPrivateOrReservedHost("0x7f000001"), "Hex IP 0x7f000001 is blocked");

  // 4. Async URL safety checks
  const unsafeUrls = [
    "http://127.0.0.1/admin",
    "http://localhost:8080/api",
    "http://169.254.169.254/latest/meta-data",
    "http://2130706433/test",
    "http://0x7f000001/",
    "http://[::1]:3000",
    "http://[::ffff:127.0.0.1]/",
  ];

  for (const url of unsafeUrls) {
    try {
      await assertUrlIsSafe(url);
      assert(false, `Expected ${url} to be blocked by assertUrlIsSafe`);
    } catch (e) {
      assert(e instanceof UnsafeUrlError, `Correctly blocked unsafe URL: ${url} (${e.message})`);
    }
  }

  // 5. Valid public URL
  try {
    const valid = await assertUrlIsSafe("https://example.com/test");
    assert(valid.hostname === "example.com", "Legitimate public URL allowed: https://example.com/test");
  } catch (e) {
    assert(false, `Valid URL was unexpectedly blocked: ${e.message}`);
  }
}

function testApiKeyTiming() {
  console.log("\n--- Testing API Key Timing & Constant-Time Validation ---");

  const configuredKey = "secret-key-1234567890-abcdef";
  const configuredDigest = crypto.createHash("sha256").update(configuredKey).digest();

  function verifyKey(input) {
    if (!input) return false;
    const providedDigest = crypto.createHash("sha256").update(input).digest();
    return crypto.timingSafeEqual(configuredDigest, providedDigest);
  }

  assert(verifyKey("secret-key-1234567890-abcdef") === true, "Valid key accepted in constant time");
  assert(verifyKey("wrong-key") === false, "Wrong key rejected in constant time");
  assert(verifyKey("secret-key-1234567890-abcdeg") === false, "Key with 1 character diff rejected");
  assert(verifyKey("") === false, "Empty key rejected");
  assert(verifyKey(null) === false, "Null key rejected");
}

async function run() {
  await testSsrf();
  testApiKeyTiming();

  console.log(`\n=== Tests Finished: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
