export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function isPrivateOrReservedHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }

  // Check private IPv4 ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x, 0.x)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }

  return false;
}

export function assertUrlIsSafe(urlString: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new UnsafeUrlError("Malformed or invalid URL format");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new UnsafeUrlError(`Unsupported URL protocol: ${parsedUrl.protocol}`);
  }

  if (isPrivateOrReservedHost(parsedUrl.hostname)) {
    throw new UnsafeUrlError(`Access to internal/private host (${parsedUrl.hostname}) is blocked`);
  }

  return parsedUrl;
}