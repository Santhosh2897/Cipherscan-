# 🛡️ CipherScan 2.0 — Real-Time Mobile Threat Defense (MTD) & Cloud Sandboxing Ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform: Android](https://img.shields.io/badge/Platform-Android%2011%2B-3DDC84.svg?logo=android&logoColor=white)](https://github.com/Santhosh2897/Cipherscan-/releases/tag/v1.0.0)
[![Backend: Node.js & TypeScript](https://img.shields.io/badge/Backend-Node.js%20%7C%20TypeScript%20%7C%20Express-3178C6.svg?logo=typescript&logoColor=white)](https://render.com)
[![Database: Neon Serverless Postgres](https://img.shields.io/badge/Database-Neon%20Postgres%20%7C%20Drizzle%20ORM-00E599.svg?logo=postgresql&logoColor=white)](https://neon.tech)
[![Frontend: React + Vite + Tailwind](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind%20CSS-06B6D4.svg?logo=react&logoColor=white)](https://cipherscan-dashboard.vercel.app)
[![Release: v1.0.0](https://img.shields.io/badge/Release-v1.0.0%20(Production)-6366F1.svg)](https://github.com/Santhosh2897/Cipherscan-/releases/tag/v1.0.0)

> **CipherScan 2.0** is an enterprise-grade Mobile Threat Defense (MTD) and cloud sandboxing architecture engineered to intercept, sandbox, analyze, and neutralize zero-day web phishing, fintech scams, and malicious payment links on mobile endpoints **before user exposure**.

---

## 📲 Download CipherScan for Android

Get the pre-built, production-ready Android APK directly from GitHub Releases:

👉 **[Download CipherScan v1.0.0 APK](https://github.com/Santhosh2897/Cipherscan-/releases/download/v1.0.0/cipherscan-debug.apk)**  
📦 **[View GitHub Releases](https://github.com/Santhosh2897/Cipherscan-/releases/tag/v1.0.0)**

---

## ⚡ The 3-Gate Threat Defense Pipeline

CipherScan replaces slow, monolithic antivirus scans with a high-performance **Tri-Gate Pipeline** that delivers instant verdicts (< 500ms) without ever stalling user navigation:

```mermaid
flowchart TD
    A["📱 User Clicks Link in SMS / WhatsApp / QR"] --> B["Gate 1: Edge-first On-Device Interceptor\n(0ms Instant Decision Engine)"]
    
    B -->|"Globally Trusted (Google, GitHub)"| PASS["🟢 0ms Fast Pass -> Chrome Custom Tabs"]
    B -->|"Uncached / Unknown Domain"| C["Gate 2: Lightweight Redirect Stream Engine\n(Headless Sandboxing & Multi-Hop Trace)"]
    B -->|"Payment Intent (upi://pay)"| D["Gate 3: LegalTech & FinTech Sentinel\n(Indian Banking Heuristics & VPA Fraud Engine)"]
    
    C --> E["24h Deduplication Cache + Cloud Reputation\n(VirusTotal v3 + Google Safe Browsing v4)"]
    D --> F["Reverse-Debit Trap & Brand Spoof Evaluator\n(Section 65B Forensic Evidence Dossier)"]
    
    E --> G{"Risk Score Engine\n(0 - 100)"}
    F --> G
    
    G -->|"Score <= 20 (Safe)"| H["🟢 Verified Safe Badge -> Dedicated Browser Launch"]
    G -->|"Score 21-69 (Suspicious)"| I["🟡 Security Overlay Warning + Screenshot Lightbox"]
    G -->|"Score >= 70 (Malicious)"| J["🔴 Hard Block Overlay + 1-Tap 1930 Cybercrime Dossier Export"]
```

### 1. Gate 1: Edge-First On-Device Interceptor (0ms)
- **Zero-Latency Whitelist:** Universally trusted domains (Google, Wikipedia, GitHub) pass in **0ms** without wasting network battery or API quotas.
- **System Intent Interception:** Transparent `LinkInterceptorActivity` catches Android `ACTION_VIEW` (`http`, `https`, `upi`) system-wide across WhatsApp, Telegram, Gmail, SMS (Smishing), and Native Camera QR scanners.
- **Loopback Evasion Architecture:** `BrowserLauncher` explicitly queries non-CipherScan browsers and launches them with `setPackage()`. Clicking *"Proceed Anyway"* **never** traps the phone in recursive infinite loops.

### 2. Gate 2: Lightweight Redirect Stream Engine
- **Multi-Hop Unrolling:** Traces obfuscated short links (`bit.ly`, `tinyurl.com`, `t.co`) through 3+ HTTP 301/302 redirects to unmask the terminal landing page.
- **Asynchronous Two-Tier Sandboxing:** Returns an instant Tier 1 heuristic verdict in `< 500ms` with a high-tech SVG Domain Shield card, while asynchronously running Tier 2 background Playwright Chromium sandboxing for live full-page screenshots.
- **Retroactive Threat Monitoring:** If Tier 2 background sandboxing discovers delayed zero-day cloaking or payload execution after the user proceeded, the mobile app receives an emergency heads-up notification to immediately exit the site.

### 3. Gate 3: LegalTech & FinTech Sentinel
- **Reverse-Debit UPI Fraud Guard:** Scammers claim to send *"Cashback / Refunds"*, but send `upi://pay?am=4999` debit requests. CipherScan parses parameters on-device, detects positive debit amounts paired with reward lures, and flags a **Critical 95 Risk Alert**.
- **VPA Impersonation Detection:** Detects consumer UPI handles (`@paytm`, `@ybl`, `@okhdfcbank`) masquerading as official financial institutions (e.g. `sbi.customercare@okhdfcbank`).
- **Subdomain-Brand Abuse Engine:** Catches malicious phishing landing pages abusing free cloud providers (e.g. `*.firebaseapp.com`, `*.pages.dev`, `*.vercel.app`) using Levenshtein distance typosquatting checks against major Indian banks (SBI, HDFC, ICICI, Axis, PNB, Kotak, IRCTC, Mahadiscom).
- **Section 65B Forensic Dossier Export:** Automatically structures scan telemetry (timestamp, full redirect chain, IP addresses, screenshot hash, and threat indicators) into a forensic dossier ready for filing on the **National Cyber Crime Reporting Portal (cybercrime.gov.in)** and dialing the **1930 Financial Fraud Helpline**.

---

## 🏛️ System Architecture

```
cipherscan/
├── android/                         Native Android Mobile Threat Defense (Kotlin)
│   ├── app/src/main/                AndroidManifest intent filters, Activities, Custom Views
│   │   ├── java/com/cipherscan/android/
│   │   │   ├── activity/            LinkInterceptorActivity (SingleTask OS Gatekeeper)
│   │   │   ├── ui/                  SecurityOverlayBottomSheet, RiskGaugeView, BrowserLauncher
│   │   │   └── util/                UpiVpaValidator, DeviceUtils, NotificationHelper
│   └── README.md                    Android module build & deployment documentation
│
├── artifacts/
│   ├── api-server/                  Node.js / Express Cloud Threat Engine (TypeScript)
│   │   ├── src/
│   │   │   ├── lib/                 reputationService, sandboxService, indianFraudEngine, urlSafety
│   │   │   └── routes/              analyze, scans, stats, health
│   │   └── package.json             Runtime dependencies & Playwright config
│   │
│   └── cipherscan/                  React + Vite + Tailwind CSS Web Command Center
│       ├── api/                     Serverless Vercel BFF Proxy (proxy.js, auth.js)
│       └── src/                     Dashboard, ScanHistory, Analyze, Lightbox components
│
├── docs/
│   └── reports/                     Academic papers, project reports, and IEEE base papers
│
├── lib/
│   ├── api-zod/                     Runtime Zod request/response validation contracts
│   ├── api-client-react/            Auto-generated TanStack React Query client hooks
│   └── db/                          Drizzle ORM schema & Neon PostgreSQL database client
│
├── scripts/                         Automated release and testing utility scripts
└── package.json                     PNPM workspace root configuration
```

---

## 🛡️ Enterprise Security Hardening

- **SSRF (Server-Side Request Forgery) Filter:** `urlSafety.ts` strictly validates destination addresses before connection. Rejects IPv4 private ranges (RFC1918), IPv6 loopback (`::1`), cloud metadata IPs (`169.254.169.254`), and performs asynchronous DNS lookups to block DNS rebinding attacks (`nip.io`, `localtest.me`).
- **Serverless BFF (Backend-For-Frontend) Proxy:** Client browsers never communicate directly with the backend API key. The Vercel serverless proxy (`proxy.js`) validates 1-hour HMAC tokens, enforces IP rate limiting (10 req/min on `/api/analyze`), and injects secrets server-to-server.
- **SQL Injection & XSS Defense:** Parameterized queries via Drizzle ORM, strict Zod schema validation, and complete DOM escaping prevent payload injection through target URL parameters.

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- Node.js >= 20.0.0
- pnpm package manager (`npm install -g pnpm`)
- Android Studio Iguana+ (for Android client builds)
- Neon PostgreSQL connection string

### 1. Clone & Install
```bash
git clone https://github.com/Santhosh2897/Cipherscan-.git
cd Cipherscan-
pnpm install
```

### 2. Configure Environment Variables
Create `.env` in `artifacts/api-server/`:
```env
PORT=8080
DATABASE_URL=postgresql://user:pass@ep-host.neon.tech/neondb?sslmode=require
APP_API_KEY=your_generated_shared_secret_key
VIRUSTOTAL_API_KEY=your_virustotal_v3_key
GOOGLE_SAFE_BROWSING_API_KEY=your_google_safe_browsing_v4_key
ALLOWED_ORIGIN=http://localhost:5173
```

### 3. Verify Codebase Integrity
Run the comprehensive workspace typecheck and test suite:
```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run test:stress
```

### 4. Run Development Servers
```bash
# Start backend API server
pnpm --filter @workspace/api-server run dev

# Start Web Command Center (http://localhost:5173)
pnpm --filter cipherscan run dev
```

### 5. Build Android APK
```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📑 Research Papers & Project Reports

All foundational academic research, architecture specs, and IEEE base papers are archived in the [`docs/reports/`](file:///c:/Users/yoges/Downloads/cipherscan-final-with-env/cipherscan/docs/reports) directory:

- [Project Report (Full Technical Specification)](file:///c:/Users/yoges/Downloads/cipherscan-final-with-env/cipherscan/docs/reports/CIPHERSCAN_PROJECT_REPORT.html)
- [IEEE Research Base Paper](file:///c:/Users/yoges/Downloads/cipherscan-final-with-env/cipherscan/docs/reports/CIPHERSCAN_IEEE_RESEARCH_BASE_PAPER.md)
- [Hackathon Idea & Innovation Proposal](file:///c:/Users/yoges/Downloads/cipherscan-final-with-env/cipherscan/docs/reports/CIPHERSCAN_HACKATHON_IDEA_PROPOSAL.html)
- [Research Paper Draft](file:///c:/Users/yoges/Downloads/cipherscan-final-with-env/cipherscan/docs/reports/CIPHERSCAN_PAPER.html)

---

## ⚖️ License & Intellectual Property

Licensed under the [MIT License](LICENSE).  
Developed by the CipherScan Engineering Team. All rights reserved.
