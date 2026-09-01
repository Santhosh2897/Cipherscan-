# CipherScan — Real-Time Phishing & Malware Threat Prevention Engine

CipherScan is a comprehensive Mobile Threat Defense (MTD) and Web Security Platform designed to intercept, analyze, and neutralize malicious URLs, phishing attacks, and payment scams across Android mobile devices and web platforms before user exposure.

---

## Key Features & Platform Capabilities

### 📱 Android Mobile Threat Defense (MTD)
- **Universal Intent Interception:** Seamlessly intercepts web links (`http://`, `https://`) and payment links (`upi://`) clicked across SMS, WhatsApp, Telegram, and QR Code scanners.
- **WhatsApp Media Pass-Through:** Ignores non-web media actions (e.g. photo/attachment sending in WhatsApp) to avoid unnecessary scanning popups.
- **Standalone Chrome Launch:** Launches verified safe links in a **separate, dedicated Chrome browser window/task** (`FLAG_ACTIVITY_NEW_TASK` and `FLAG_ACTIVITY_NEW_DOCUMENT`), allowing users to return to open links anytime from Android Recent Tasks.
- **Persistent Device Identification:** Automatically generates a persistent hardware UUID (`deviceId`) and detects device model (`deviceName`, e.g. `Samsung SM-G991B`, `Google Pixel 8`) to track and isolate scans per mobile phone.

### 🛡️ Real-Time Analysis & Sandbox Engine
- **Headless Playwright Sandbox:** Renders target pages in an isolated Playwright Chromium instance to record redirect chains, final destinations, and page titles.
- **High-Fidelity Base64 Screenshots:** Captures full visual page snapshots encoded into self-contained `data:image/jpeg;base64,...` Data URIs, guaranteeing reliable display across Android devices, Web Dashboards, and serverless environments.
- **24-Hour Scan Caching:** Automatically deduplicates scans within a 24-hour window, returning cached threat intelligence instantly without redundant Playwright execution.
- **Multi-Engine Threat Intelligence:** Checks domain reputation against VirusTotal v3, Google Safe Browsing v4, and heuristic safety engines.

### 📊 Central Web Command Center & Dashboard
- **Ecosystem Protection Status:** Monitors system health and security levels (`OPTIMAL`, 98% Security Score) across connected mobile interceptors and web analysis engines.
- **Multi-Device Tracking & Filtering:** View scans categorized by specific hardware devices (`📱 Samsung SM-G991B`, `📱 Google Pixel 8`, `🌐 Web Dashboard`), with per-device scan history filtering.
- **Interactive Lightbox Zoom:** Click any live website screenshot preview on the Web Dashboard to expand into a high-resolution full-screen view.
- **Scan History Log:** Complete log of all inspected URLs with verdict pill badges (`SAFE`, `SUSPICIOUS`, `MALICIOUS`), threat category taxonomy, and hop-by-hop redirect tracing.

---

## Repository Structure

```
cipherscan/
├── android/                      Android MTD client application
│   ├── app/src/main/java/        Kotlin source code (Interceptors, Utilities, UI)
│   └── README.md                 Android setup and architecture guide
├── artifacts/
│   ├── api-server/               Node.js / Express threat analysis backend
│   └── cipherscan/               React + Vite + Tailwind Web Dashboard
├── lib/
│   ├── api-spec/                 OpenAPI 3.1 specification & codegen configuration
│   ├── api-client-react/         React Query API hooks & TypeScript schemas
│   ├── api-zod/                  Backend Zod validation schemas
│   └── db/                       Drizzle ORM database schema & connection client
├── package.json                  Workspace root configuration
└── README.md                     This documentation file
```

---

## Local Development & Setup

### Prerequisites
- Node.js >= 18.0.0
- pnpm package manager (`npm install -g pnpm`)
- PostgreSQL database

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run typechecking:
   ```bash
   pnpm run typecheck
   ```

3. Build production artifacts:
   ```bash
   pnpm -r --filter "./artifacts/**" run build
   ```

---

## License

MIT License.
