import dns from "node:dns/promises";
import net from "node:net";

/**
 * Blocks SSRF (Server-Side Request Forgery) attempts before the Playwright
 * sandbox is ever launched. Without this, an attacker could submit URLs
 * pointing at internal infrastructure (localhost, private IP ranges, cloud
 * metadata endpoints) and have the backend fetch/screenshot them.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS/GCP/Azure cloud metadata endpoint
  "metadata.google.internal",
]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "upi:"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;

  return (
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local / cloud metadata
    a === 0 // 0.0.0.0/8
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower.startsWith("fc") || // unique local
    lower.startsWith("fd") || // unique local
    lower.startsWith("fe80") // link-local
  );
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Validates that a URL is safe to fetch server-side. Throws UnsafeUrlError
 * if the URL points at a blocked scheme, hostname, or resolves (via DNS,
 * to guard against DNS-rebinding) to a private/internal IP address.
 */
export async function assertUrlIsSafe(targetUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new UnsafeUrlError("Malformed URL");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(`Blocked scheme: ${url.protocol}`);
  }

  // upi:// links (e.g. upi://pay?pa=merchant@bank&pn=Name) have no
  // navigable network host — they're a payment-intent identifier, not a
  // URL Playwright will ever fetch (sandboxService's page.goto fails
  // gracefully on them). The SSRF risk this function guards against only
  // applies to schemes that actually get fetched, so skip host validation.
  if (url.protocol === "upi:") {
    return;
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError(`Blocked host: ${hostname}`);
  }

  // If the hostname is already a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateIpv4(hostname)) {
      throw new UnsafeUrlError(`Blocked private IPv4 address: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateIpv6(hostname)) {
      throw new UnsafeUrlError(`Blocked private IPv6 address: ${hostname}`);
    }
    return;
  }

  // Resolve DNS and check the *actual* IP(s) the hostname points to.
  // This blocks DNS-rebinding tricks where a public-looking domain
  // resolves to a private IP.
  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
  }

  for (const address of addresses) {
    if (net.isIPv4(address) && isPrivateIpv4(address)) {
      throw new UnsafeUrlError(`Host resolves to blocked private IP: ${address}`);
    }
    if (net.isIPv6(address) && isPrivateIpv6(address)) {
      throw new UnsafeUrlError(`Host resolves to blocked private IP: ${address}`);
    }
  }
}
