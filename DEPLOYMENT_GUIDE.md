# CipherScan — Complete Deployment Guide

This guide covers deploying all three components of the CipherScan platform:
1. **Cloud Backend API Server** (`artifacts/api-server`) → **Render**
2. **Web Command Center & Dashboard** (`artifacts/cipherscan`) → **Vercel**
3. **Android Mobile App** (`android/`) → **Android Phone / Device**

---

## 1. Deploying Backend API Server (Render)

The backend is a Node.js + Express service with Playwright Chromium, Neon PostgreSQL, and threat intelligence APIs.

### Step 1.1: Push Project to GitHub
Make sure your latest code is pushed to your GitHub repository:
```bash
git add .
git commit -m "CipherScan upgrade with collaborative cache, QR camera, and UPI fraud detection"
git push origin main
```

### Step 1.2: Create a Web Service on Render
1. Log in to [Render](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Fill in the service configuration:
   - **Name**: `cipherscan-api` (or your preferred name)
   - **Region**: Closest to your users (e.g., Singapore, Frankfurt, Oregon)
   - **Branch**: `main`
   - **Root Directory**: (Leave blank — repository root)
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-zod run build && pnpm --filter @workspace/db run build && pnpm --filter @workspace/api-server run build && npx playwright install chromium --with-deps
     ```
   - **Start Command**:
     ```bash
     node artifacts/api-server/dist/index.mjs
     ```

### Step 1.3: Configure Environment Variables on Render
In the **Environment** tab of your Render service, add these variables:

| Key | Value / Description | Example |
|---|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string | `postgresql://neondb_owner:***@ep-***.neon.tech/neondb?sslmode=require` |
| `APP_API_KEY` | Shared secret key for API requests | `1d409806dab4a17909e843c8933b78ea5323773141eb04c30bfa0c5b3885ff20` |
| `ALLOWED_ORIGIN` | Allowed web origins | `*` (or your Vercel URL: `https://cipherscan-dashboard.vercel.app`) |
| `PORT` | Listening port | `8080` (or leave default `$PORT`) |
| `SERVER_BASE_URL` | Public Render service URL | `https://cipherscan-ecjs.onrender.com` |
| `VIRUSTOTAL_API_KEY` | *(Optional)* VirusTotal API Key | (From your VirusTotal account) |
| `GOOGLE_SAFE_BROWSING_API_KEY` | *(Optional)* Google Safe Browsing API Key | (From Google Cloud Console) |

Click **Save Changes** and **Deploy**. Once finished, your backend URL will be live at `https://<your-service>.onrender.com`.

---

## 2. Deploying Web Dashboard (Vercel)

The frontend is a React + Vite + Tailwind CSS Single Page Application with a secure Serverless BFF (Backend-For-Frontend) Proxy at `/api/proxy`.

### Step 2.1: Import into Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** → **Project**.
3. Select your GitHub repository.
4. Set the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and choose `artifacts/cipherscan` (or leave root if relying on `artifacts/cipherscan/vercel.json`)
   - **Output Directory**: `dist/public`

### Step 2.2: Set Environment Variables on Vercel
Under **Environment Variables**, add:

| Key | Value | Notes |
|---|---|---|
| `BACKEND_URL` | `https://cipherscan-ecjs.onrender.com` | Your live Render backend URL |
| `APP_API_KEY` | `1d409806dab4a17909e843c8933b78ea5323773141eb04c30bfa0c5b3885ff20` | Must match `APP_API_KEY` set on Render |

Click **Deploy**. Vercel will build the frontend and deploy it to `https://<project-name>.vercel.app`.

---

## 3. Installing & Deploying the Android Mobile App

The Android app is already built and ready to install.

### Option A: Install via Direct File Transfer (Simplest)
1. Locate the compiled APK file on your computer:
   ```
   cipherscan\android\app\build\outputs\apk\debug\app-debug.apk
   ```
2. Send this `app-debug.apk` file to your Android phone using:
   - WhatsApp / Telegram (attach file)
   - Google Drive
   - USB Cable (copy to `Downloads` folder on phone)
3. Open the file on your phone and tap **Install**.
   *(If prompted by Android, tap "Allow from this source" in Settings).*

### Option B: Install via USB Cable using ADB
1. Connect your phone to your PC via USB.
2. Enable **Developer Options** and **USB Debugging** on your phone.
3. Run this command in your terminal:
   ```bash
   adb install -r cipherscan/android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Option C: Rebuilding a Fresh APK with a Custom Backend URL
If your Render backend URL changes, update `android/local.properties`:
```properties
cipherscan.server.url=https://your-backend.onrender.com/
cipherscan.api.key=your_secret_key_here
```
Then rebuild the APK:
```bash
cd android
./gradlew.bat assembleDebug
```
The new APK will be output at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 4. Testing the Full System After Deployment

1. **Open the Web Dashboard**:
   - Go to your Vercel URL: `https://<your-dashboard>.vercel.app/analyze`
   - Enter `https://example.com` and click **Scan**.
   - Verify the risk score, verdict, and live website preview screenshot appear.
2. **Open the Android App**:
   - Launch **CipherScan** on your phone.
   - Tap **📷 Scan QR Code with Camera** and point at any QR code to test instant square reticle scanning.
   - Tap **Inspect & Analyze Threat** with any URL or `upi://pay?pa=test@upi` to test UPI verification and live bottom-sheet overlay.
3. **Verify Community Telemetry**:
   - Go to `/threat-intel` on your web dashboard to see real-time cache hits, trending threats, and cross-device intelligence.
