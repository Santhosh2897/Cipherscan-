import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apkPath = path.join(rootDir, "cipherscan-debug.apk");

// Get github token from git credential helper
function getGithubToken() {
  try {
    const credOutput = execSync('git credential fill', {
      cwd: rootDir,
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf-8",
    });
    const match = credOutput.match(/password=(.+)/);
    return match ? match[1].trim() : null;
  } catch (err) {
    console.error("Failed to read git credential:", err.message);
    return null;
  }
}

async function main() {
  const token = getGithubToken();
  if (!token) {
    console.error("Could not obtain GitHub token from git credentials.");
    process.exit(1);
  }

  const repo = "Santhosh2897/Cipherscan-";
  const tagName = "v1.0.0";
  const releaseTitle = "CipherScan v1.0.0 — Production Release";
  const releaseBody = `## 🛡️ CipherScan Mobile Threat Defense (v1.0.0)

Production release for CipherScan real-time Mobile Threat Defense (MTD) and Cloud Sandboxing System.

### 🌟 Key Features
- **Real-Time Link Interception:** Intercepts web URLs at the Android OS level across SMS, WhatsApp, Telegram, Gmail, and Native Camera QR Scanner.
- **Fintech & UPI Fraud Engine:** Detects reverse-payment traps, VPA typosquatting, and impersonation.
- **SSRF Hardened Sandbox:** Validates target IPs and domains against internal network traversal.
- **Loopback Evasion:** Automatically resolves non-CipherScan browsers and Chrome Custom Tabs without infinite loops.

### 📲 Mobile Download & Installation
Download **\`cipherscan-debug.apk\`** below directly to your Android device, tap it, and select **Install / Update**.
`;

  console.log(`Creating GitHub Release for ${repo} on tag ${tagName}...`);

  // 1. Create Release
  const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "CipherScan-Release-Script",
    },
    body: JSON.stringify({
      tag_name: tagName,
      target_commitish: "main",
      name: releaseTitle,
      body: releaseBody,
      draft: false,
      prerelease: false,
    }),
  });

  let releaseData = await createRes.json();
  if (!createRes.ok) {
    if (releaseData.errors?.[0]?.code === "already_exists") {
      console.log("Release already exists, fetching existing release...");
      const getRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tagName}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "CipherScan-Release-Script",
        },
      });
      releaseData = await getRes.json();
    } else {
      console.error("GitHub API error creating release:", releaseData);
      process.exit(1);
    }
  }

  const releaseId = releaseData.id;
  const htmlUrl = releaseData.html_url;
  console.log(`Release created successfully: ${htmlUrl} (ID: ${releaseId})`);

  // 2. Read APK file
  console.log(`Reading APK binary from ${apkPath}...`);
  const apkBuffer = await readFile(apkPath);
  console.log(`APK size: ${(apkBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);

  // Check if asset already uploaded
  if (Array.isArray(releaseData.assets)) {
    const existingAsset = releaseData.assets.find((a) => a.name === "cipherscan-debug.apk");
    if (existingAsset) {
      console.log(`Asset already exists (ID: ${existingAsset.id}), deleting old asset...`);
      await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existingAsset.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "CipherScan-Release-Script",
        },
      });
    }
  }

  // 3. Upload APK asset using curl.exe for robust large binary streaming
  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=cipherscan-debug.apk`;
  console.log(`Uploading cipherscan-debug.apk to GitHub Releases via curl...`);

  let uploadData;
  try {
    const rawResult = execSync(
      `curl.exe -f -s -S --retry 3 --retry-delay 3 -X POST ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-H "Accept: application/vnd.github+json" ` +
      `-H "Content-Type: application/vnd.android.package-archive" ` +
      `-H "User-Agent: CipherScan-Release-Script" ` +
      `--data-binary @"${apkPath}" ` +
      `"${uploadUrl}"`,
      { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
    );
    uploadData = JSON.parse(rawResult);
  } catch (curlErr) {
    console.error("curl upload error, falling back to fetch...", curlErr.message);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/vnd.android.package-archive",
        "User-Agent": "CipherScan-Release-Script",
      },
      body: apkBuffer,
    });
    uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error("Failed to upload APK asset:", uploadData);
      process.exit(1);
    }
  }

  console.log(`\n🎉 SUCCESS! APK asset uploaded successfully!`);
  console.log(`Download URL: ${uploadData.browser_download_url}`);
  console.log(`Release Page: ${htmlUrl}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
