import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Checks if a given IPv4 string falls within private, reserved, or link-local ranges.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Treat malformed as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private-Use RFC 1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT RFC 6598: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-Local / Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private-Use RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 192.0.2.0/24 (Documentation TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private-Use RFC 1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network Interconnect Device Benchmark)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (Documentation TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (Documentation TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast: 224 - 239)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved: 240 - 255)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if a given IPv6 string falls within private, loopback, or reserved ranges.
 */
export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Loopback ::1 or Unspecified ::
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1" || normalized === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv4-mapped IPv6 address (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const v4Part = normalized.replace(/^.*:ffff:/, "");
    if (net.isIPv4(v4Part)) {
      return isPrivateIpv4(v4Part);
    }
    return true; // Unknown/obfuscated v4 mapped
  }

  // Unique Local Address (fc00::/7 -> fc00 to fdff)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // Link-Local (fe80::/10 -> fe80 to febf)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) {
    return true;
  }

  return false;
}

/**
 * Checks if an IP string (v4 or v6) is private or reserved.
 */
export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true; // If not valid IP syntax, treat as unsafe
}

/**
 * Checks if hostname string is an obfuscated IP or reserved domain.
 */
export function isPrivateOrReservedHost(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, "").trim();

  // Known local/reserved names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".corp") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".arpa")
  ) {
    return true;
  }

  // Obfuscated decimal/hexadecimal/octal IP checks (e.g. 2130706433, 0x7f000001, 0177.0.0.1)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname) || /^0[0-7]+$/i.test(hostname)) {
    return true;
  }

  // Check if direct IP
  if (net.isIP(hostname)) {
    return isPrivateIp(hostname);
  }

  return false;
}

/**
 * Validates a target URL against SSRF and private network attacks.
 * Performs asynchronous DNS resolution to verify destination IP addresses.
 */
export async function assertUrlIsSafe(urlString: string): Promise<URL> {
  if (urlString.startsWith("upi://")) {
    try {
      return new URL(urlString);
    } catch {
      throw new UnsafeUrlError("Malformed or invalid UPI payment format");
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new UnsafeUrlError("Malformed or invalid URL format");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new UnsafeUrlError(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "").trim();

  // 1. Static hostname / reserved name / obfuscated IP check
  if (isPrivateOrReservedHost(hostname)) {
    throw new UnsafeUrlError(`Access to internal/private host (${hostname}) is blocked`);
  }

  // 2. Direct IP check
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError(`Access to internal/private IP address (${hostname}) is blocked`);
    }
    return parsedUrl;
  }

  // 3. Asynchronous DNS resolution check (prevents DNS rebinding and nip.io / localtest.me bypasses)
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      throw new UnsafeUrlError(`Cannot resolve hostname: ${hostname}`);
    }

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        throw new UnsafeUrlError(
          `Host ${hostname} resolves to protected internal IP address (${record.address})`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
    throw new UnsafeUrlError(`DNS lookup failed for host ${hostname}: ${err.message}`);
  }

  return parsedUrl;
}