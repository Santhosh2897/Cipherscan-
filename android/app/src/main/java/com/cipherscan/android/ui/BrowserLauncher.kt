package com.cipherscan.android.ui

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import android.widget.Toast

/**
 * BrowserLauncher — Universal Intent Dispatcher & Safe App Router.
 *
 * Intelligently routes verified safe targets according to NPCI payment standards
 * and Android intent specifications:
 * 1. UPI Payment Intents (`upi://pay`): Launches pure NPCI payment intent without
 *    breaking document/browsable flags so PhonePe, Google Pay, and Paytm payments succeed.
 * 2. Native App Links (YouTube, Maps, WhatsApp, Instagram): Hands over to native installed
 *    apps instead of trapping them inside a browser tab.
 * 3. System Protocols (`tel:`, `mailto:`, `market:`): Dispatches to native phone/mail/store handlers.
 * 4. General Web URLs (`http`, `https`): Respects the user's default browser (Samsung Internet,
 *    Brave, Firefox, Edge, or Chrome) with fallback to native Android chooser.
 */
object BrowserLauncher {

    private const val TAG = "BrowserLauncher"

    private val KNOWN_BROWSERS = listOf(
        "com.sec.android.app.sbrowser",         // Samsung Internet
        "com.brave.browser",                    // Brave Browser
        "org.mozilla.firefox",                  // Mozilla Firefox
        "org.mozilla.focus",                    // Firefox Focus
        "com.microsoft.emmx",                   // Microsoft Edge
        "com.opera.browser",                    // Opera
        "com.opera.gx",                         // Opera GX
        "com.duckduckgo.mobile.android",        // DuckDuckGo
        "com.vivaldi.browser",                  // Vivaldi
        "com.android.chrome",                   // Google Chrome
        "com.google.android.apps.chrome",       // Chrome Beta/Dev
        "com.mi.globalbrowser",                 // Xiaomi Mint/Mi Browser
        "com.jio.web",                          // JioPages
        "com.android.browser"                   // AOSP Stock Browser
    )

    /**
     * Primary entrypoint: Safely dispatches any destination URL or payment intent.
     */
    fun openUrl(context: Context, rawUrl: String) {
        val trimmed = rawUrl.trim()
        if (trimmed.isBlank()) {
            Toast.makeText(context, "Cannot open empty destination", Toast.LENGTH_SHORT).show()
            return
        }

        // ── LANE 1: UPI Payment Intent (NPCI Standard) ──────────────────────────
        if (trimmed.startsWith("upi://", ignoreCase = true)) {
            launchUpiPayment(context, trimmed)
            return
        }

        // ── LANE 2: System Protocols (tel:, mailto:, market:, geo:, whatsapp:) ─
        if (trimmed.startsWith("tel:", ignoreCase = true) ||
            trimmed.startsWith("mailto:", ignoreCase = true) ||
            trimmed.startsWith("market:", ignoreCase = true) ||
            trimmed.startsWith("geo:", ignoreCase = true) ||
            trimmed.startsWith("whatsapp:", ignoreCase = true) ||
            trimmed.startsWith("tg:", ignoreCase = true)
        ) {
            launchSystemProtocol(context, trimmed)
            return
        }

        // Normalize web URI
        val destination = if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
            trimmed
        } else {
            "https://$trimmed"
        }

        val uri = try {
            Uri.parse(destination)
        } catch (e: Exception) {
            Log.e(TAG, "Invalid URI: $destination", e)
            Toast.makeText(context, "Invalid link format", Toast.LENGTH_SHORT).show()
            return
        }

        // ── LANE 3: Native App Links (YouTube, Maps, Play Store, Instagram) ────
        if (launchNativeAppIfInstalled(context, uri)) {
            return
        }

        // ── LANE 4: General Web Browsers (Respects Default Browser) ────────────
        launchInWebBrowser(context, uri)
    }

    /**
     * Dedicated UPI payment launcher conforming to NPCI Intent Specifications:
     * - Action: Intent.ACTION_VIEW
     * - Flags: FLAG_ACTIVITY_NEW_TASK only
     * - NO CATEGORY_BROWSABLE (which triggers bank anti-CSRF fraud prevention)
     * - NO FLAG_ACTIVITY_NEW_DOCUMENT (which crashes the NPCI MPIN keypad sandbox)
     */
    private fun launchUpiPayment(context: Context, upiUrl: String) {
        Log.d(TAG, "Dispatching clean NPCI UPI payment intent: $upiUrl")
        try {
            val uri = Uri.parse(upiUrl)
            val upiIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = Intent.createChooser(upiIntent, "Pay with UPI").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(chooser)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch UPI intent: ${e.message}", e)
            Toast.makeText(context, "No UPI payment app (PhonePe, GPay, Paytm) found on device.", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * Checks if a specialized native app (YouTube, Maps, Play Store, Instagram, etc.)
     * is installed on the device to handle this HTTP/HTTPS link.
     */
    private fun launchNativeAppIfInstalled(context: Context, uri: Uri): Boolean {
        try {
            val testIntent = Intent(Intent.ACTION_VIEW, uri)

            val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.queryIntentActivities(
                    testIntent,
                    PackageManager.ResolveInfoFlags.of(0)
                )
            } else {
                context.packageManager.queryIntentActivities(testIntent, 0)
            }

            // Exclude CipherScan itself and exclude generic web browsers
            val nativeApps = resolveInfos.filter { info ->
                val pkg = info.activityInfo.packageName
                pkg != context.packageName && !isKnownBrowserPackage(pkg)
            }

            if (nativeApps.isNotEmpty()) {
                Log.d(TAG, "Found native app handler: ${nativeApps[0].activityInfo.packageName} for $uri")
                val appIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    if (nativeApps.size == 1) {
                        setPackage(nativeApps[0].activityInfo.packageName)
                    }
                }
                context.startActivity(appIntent)
                return true
            }
        } catch (e: Exception) {
            Log.w(TAG, "Native app dispatch failed, falling back to browser: ${e.message}")
        }
        return false
    }

    /**
     * System utility links (calling phone numbers, sending emails, opening Play Store).
     */
    private fun launchSystemProtocol(context: Context, urlString: String) {
        Log.d(TAG, "Dispatching system protocol: $urlString")
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(urlString)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch system protocol: ${e.message}", e)
            Toast.makeText(context, "No application found to handle this action", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Universal Web Browser Launcher — Self-Interception Loop Safe:
     *
     * CipherScan may itself be set as the system default browser. In that case,
     * firing a generic packageless ACTION_VIEW intent would cause Android to route
     * the link back into CipherScan, creating an infinite intercept loop.
     *
     * Safety contract:
     * - ALWAYS use setPackage() with an explicitly resolved non-CipherScan browser.
     * - NEVER fire a generic chooser/packageless intent as a fallback.
     * - If no other browser is installed, guide the user to the Play Store.
     */
    private fun launchInWebBrowser(context: Context, uri: Uri) {
        val defaultBrowser = resolveDefaultBrowser(context)
        Log.d(TAG, "Resolved preferred browser: $defaultBrowser for URL: $uri")

        // GUARD: resolveDefaultBrowser() already excludes CipherScan's own package.
        // If it still returns null, no other browser is installed on this device.
        if (defaultBrowser == null) {
            Log.w(TAG, "No external browser found. CipherScan may be the only browser. Guiding user to Play Store.")
            Toast.makeText(
                context,
                "No other browser installed. Please install Chrome, Firefox, or Samsung Internet to open web links.",
                Toast.LENGTH_LONG
            ).show()
            try {
                // Take the user directly to Play Store to install a browser.
                val storeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=browser")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(storeIntent)
            } catch (_: Exception) {
                // Play Store not available (emulators), open Play Store web fallback
                try {
                    val webStoreIntent = Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/search?q=browser&c=apps")
                    ).apply {
                        // Must explicitly avoid CipherScan to prevent the loop even here.
                        // Try known browsers explicitly rather than a generic chooser.
                        KNOWN_BROWSERS.firstOrNull { pkg ->
                            context.packageManager.getLaunchIntentForPackage(pkg) != null &&
                            pkg != context.packageName
                        }?.let { setPackage(it) }
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(webStoreIntent)
                } catch (_: Exception) {}
            }
            return
        }

        // Launch in the explicitly resolved non-CipherScan browser.
        // setPackage() is MANDATORY — it prevents Android from re-routing to CipherScan.
        try {
            val browserIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                setPackage(defaultBrowser) // Always explicitly target a specific browser
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
                addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
            }
            context.startActivity(browserIntent)
            Log.d(TAG, "Launched URL in $defaultBrowser")
            return
        } catch (e: Exception) {
            Log.w(TAG, "Primary browser ($defaultBrowser) launch failed: ${e.message}")
        }

        // Primary browser failed (e.g., just uninstalled). Find the next available browser.
        // CRITICAL: Do NOT fall back to a packageless intent — that would loop into CipherScan.
        val nextBrowser = KNOWN_BROWSERS.firstOrNull { pkg ->
            pkg != defaultBrowser &&
            pkg != context.packageName &&
            context.packageManager.getLaunchIntentForPackage(pkg) != null
        }

        if (nextBrowser != null) {
            try {
                val fallbackIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    setPackage(nextBrowser) // Explicit package — never leave this blank
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
                    addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
                }
                context.startActivity(fallbackIntent)
                Log.d(TAG, "Launched URL in fallback browser $nextBrowser")
            } catch (e: Exception) {
                Log.e(TAG, "Fallback browser ($nextBrowser) also failed: ${e.message}", e)
                Toast.makeText(context, "Could not open the link in any installed browser.", Toast.LENGTH_SHORT).show()
            }
        } else {
            // No browser at all. Same guidance as above.
            Log.e(TAG, "No browsers available on device.")
            Toast.makeText(
                context,
                "No web browser installed. Please install Chrome or Firefox to open web links.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    /**
     * Finds the user's system default browser without forcing any brand.
     */
    private fun resolveDefaultBrowser(context: Context): String? {
        val testIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://google.com")).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
        }

        // Check if a default handler is already set by the user in Android Settings
        val resolveInfo = context.packageManager.resolveActivity(testIntent, PackageManager.MATCH_DEFAULT_ONLY)
        val defaultPackage = resolveInfo?.activityInfo?.packageName

        if (defaultPackage != null && defaultPackage != "android" && defaultPackage != context.packageName) {
            return defaultPackage
        }

        // Otherwise check all installed browsers and match against known ones
        val installedApps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.queryIntentActivities(
                testIntent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong())
            )
        } else {
            context.packageManager.queryIntentActivities(testIntent, PackageManager.MATCH_ALL)
        }.map { it.activityInfo.packageName }

        return KNOWN_BROWSERS.firstOrNull { installedApps.contains(it) }
            ?: installedApps.firstOrNull { it != context.packageName }
    }

    private fun isKnownBrowserPackage(pkg: String): Boolean {
        val lower = pkg.lowercase()
        return KNOWN_BROWSERS.any { lower == it } ||
                lower.contains("browser") ||
                lower.contains("chrome") ||
                lower.contains("firefox") ||
                lower.contains("opera")
    }
}

