# CipherScan — Android Module

Full Android project for the CipherScan MTD (Mobile Threat Defense) client.
Intercepts `http://`, `https://`, and `upi://` intents, analyzes them against
the CipherScan backend, and either forwards silently (safe) or shows a threat
overlay (malicious/suspicious).

## Project structure

```
android/
├── build.gradle                          Root Gradle config (plugin versions)
├── settings.gradle                       Project name + module includes
├── local.properties.example              Copy → local.properties, set server URL
│
└── app/
    ├── build.gradle                      App-level dependencies & BuildConfig
    └── src/main/
        │
        ├── AndroidManifest.xml           Intent filters (http, https, upi://)
        │
        ├── java/com/cipherscan/android/
        │   │
        │   ├── activity/                 ── Android Activities ──────────────
        │   │   ├── index.kt              Package description
        │   │   └── LinkInterceptorActivity.kt
        │   │       Transparent OS-triggered activity. Calls POST /api/analyze,
        │   │       then routes: safe → target app, threat → overlay.
        │   │
        │   ├── ui/                       ── UI Components ───────────────────
        │   │   ├── index.kt              Package description
        │   │   ├── SecurityOverlayBottomSheet.kt
        │   │   │   BottomSheetDialogFragment. Risk gauge, screenshot, redirect
        │   │   │   chain, threat reasons, Abort / Proceed buttons.
        │   │   └── RiskGaugeView.kt
        │   │       Custom semicircular arc View. Animated, color-coded 0–100.
        │   │
        │   ├── api/                      ── Network Layer ───────────────────
        │   │   ├── index.kt              Package description
        │   │   ├── ApiService.kt         Retrofit interface: POST /api/analyze
        │   │   └── RetrofitClient.kt     Singleton OkHttp + Retrofit instance
        │   │
        │   └── model/                    ── Data Models ─────────────────────
        │       ├── index.kt              Package description
        │       └── ScanResult.kt         Parcelable response + AnalyzeRequest
        │
        └── res/
            ├── layout/
            │   ├── layout_security_overlay.xml   Threat overlay bottom sheet
            │   ├── activity_link_interceptor.xml  Loading scrim + spinner
            │   └── item_redirect_hop.xml          Single redirect chain row
            └── values/
                ├── colors.xml            CipherScan palette (mirrors web tokens)
                └── strings.xml           All user-facing strings
```

## Setup

1. Copy `local.properties.example` → `local.properties`
2. Set `cipherscan.server.url` to your deployed backend URL
3. Open in Android Studio → sync Gradle → run on device/emulator

## Dependencies

| Library | Version | Purpose |
|---|---|---|
| Retrofit | 2.9.0 | HTTP client for `/api/analyze` |
| OkHttp | 4.12.0 | Underlying HTTP engine |
| Coil | 2.5.0 | Screenshot preview image loading |
| Material | 1.11.0 | BottomSheetDialogFragment, buttons |
| Coroutines | 1.7.3 | Async network calls on IO dispatcher |

## Intent filter verification

For Android App Links (`autoVerify="true"`) to work in production, you must:
1. Host a `/.well-known/assetlinks.json` on your domain
2. Declare your SHA-256 signing certificate fingerprint there
3. Submit for verification in Google Play Console

See [Android App Links docs](https://developer.android.com/training/app-links).
