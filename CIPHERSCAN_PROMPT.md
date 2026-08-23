# CipherScan — Build Prompt (Reference)

This file contains the original system prompt for CipherScan — a zero-friction Mobile Threat Defense (MTD) platform. Modify this file to update the build specification and share it with the agent for future sessions.

---

### SYSTEM ROLE & INSTRUCTIONS
Act as a Principal Full-Stack Cybersecurity Engineer and Lead Android Architect. Your task is to provide modular, production-ready code upgrades for Phase 1 of "CipherScan"—a zero-friction Mobile Threat Defense (MTD) platform.

### ARCHITECTURAL CORE & WORKFLOW
CipherScan must act as an invisible security layer on Android devices.
1. The Android client intercepts URLs from native camera scans (`http/https`) and payment intents (`upi://`) before the default browser or target app executes.
2. The client sends a fast background payload to our Node.js/Express backend.
3. The backend runs parallel lookups: third-party reputation APIs (VirusTotal + Google Safe Browsing) and an active Playwright headless browser instance that follows JS redirect chains and captures a DOM screenshot preview.
4. Conditional Routing:
   - IF SAFE: Android auto-forwards the intent seamlessly to the destination application (e.g., Google Chrome, GPay, PhonePe) with sub-second latency.
   - IF MALICIOUS/SUSPICIOUS: Android displays a `BottomSheetDialogFragment` (Floating Overlay Card) directly over the current screen showing a color-coded Risk Gauge, expanded redirect chains, threat reasons, and the sandboxed screenshot preview.

---

### DELIVERABLES & CODE MODIFICATIONS REQUIRED

#### 1. ANDROID CLIENT INTERCEPTION & OVERLAY (`/android`)
* `AndroidManifest.xml`: Add auto-verifying Intent Filters to intercept web browsing links (`http`, `https`) and deep-link payment schemes (`upi`).
* `LinkInterceptorActivity.kt` (NEW):
  - A transparent, non-blocking activity triggered by the OS intent.
  - Displays a micro-loading indicator ("Verifying link safety...").
  - Dispatches `POST /api/analyze` request to the backend via Retrofit (`ApiService.kt`).
  - Handles response routing:
    * If `isSafe == true`: Resolves target app intent (e.g., launches `GPay` for `upi://` or `Chrome` for web links) and immediately finishes.
    * If `isSafe == false`: Displays `SecurityOverlayBottomSheet.kt`.
* `SecurityOverlayBottomSheet.kt` & `layout_security_overlay.xml` (NEW):
  - A Floating Bottom Sheet Overlay displaying:
    * Risk Score Gauge (Green/Yellow/Red).
    * `ImageView` displaying the sandboxed screenshot thumbnail fetched via Coil/Glide (`previewImageUrl`).
    * Full expandable redirect chain text list.
    * Action buttons: "Abort & Go Back" (Default) vs "Proceed Anyway".

#### 2. NODE.JS BACKEND SANDBOX & ROUTING ENGINE (`/backend`)
* `sandboxService.js` (NEW):
  - Use `playwright` (Chromium) to launch a headless browser context.
  - Navigate to the incoming URL, follow all HTTP 30x and JavaScript redirects, and extract the final resolved destination URL.
  - Capture a 1280x720 JPEG screenshot, save it to `/public/previews/{hash}.jpg`, and return the public thumbnail URL.
* `reputationService.js`:
  - Implement asynchronous API fetch wrappers for VirusTotal (v3 URL API) and Google Safe Browsing.
  - Combine reputation signals into a normalized Risk Score (0 to 100).
* `routes/analyze.js`:
  - Update `POST /api/analyze` to accept `{ targetUrl: string, triggerType: "camera" | "link" }`.
  - Execute `reputationService` and `sandboxService` concurrently using `Promise.allSettled()`.
  - Return JSON structure:
    ```json
    {
      "originalUrl": "http://bit.ly/scam-sample",
      "finalUrl": "https://suspicious-domain.com/login",
      "isSafe": false,
      "riskScore": 88,
      "threatCategory": "Phishing / Obfuscated Redirect",
      "redirectChain": ["http://bit.ly/scam-sample", "https://suspicious-domain.com/login"],
      "previewImageUrl": "http://SERVER_IP/previews/hash123.jpg",
      "reasons": ["Unrolled obfuscated link", "Flagged on VirusTotal vendor list"]
    }
    ```

---

### STEP-BY-STEP EXECUTION REQUEST
1. Provide the exact XML code for `AndroidManifest.xml` intent filters and `layout_security_overlay.xml`.
2. Provide the full Kotlin code for `LinkInterceptorActivity.kt` (including auto-forwarding logic for `upi://` and web URLs).
3. Provide the full Node.js code for `sandboxService.js` using Playwright.
4. Provide the update for `routes/analyze.js`.

---

### FUTURE PHASES (Planned)

#### Phase 2 — Intelligence Layer
- ML-based phishing classifier trained on redirect chain patterns
- Behavioral fingerprinting of landing pages (form field detection, credential harvesting signals)
- Community threat feed integration

#### Phase 3 — Enterprise MDM
- Remote policy enforcement via MDM API
- Per-app allowlists/blocklists
- Audit log export (SIEM integration)

#### Phase 4 — iOS Parity
- Safari Content Blocker extension
- iOS Share Extension for URL interception
- Parity with Android risk overlay (SwiftUI bottom sheet)

---

### COLOR SYSTEM & DESIGN TOKENS

The CipherScan design language uses a "dark intelligence" aesthetic:

| Token | Value | Usage |
|---|---|---|
| Background | `#0A0E1A` | App background |
| Surface | `#111827` | Cards, panels |
| Border | `#1F2937` | Dividers |
| Accent Cyan | `#00D4FF` | Primary brand, links |
| Accent Purple | `#7C3AED` | Secondary, badges |
| Safe Green | `#10B981` | Safe verdicts |
| Warning Yellow | `#F59E0B` | Suspicious verdicts |
| Danger Red | `#EF4444` | Malicious verdicts |
| Text Primary | `#F9FAFB` | Headlines |
| Text Muted | `#6B7280` | Labels, captions |
