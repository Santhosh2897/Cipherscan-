package com.cipherscan.android.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import android.widget.Toast
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AlertAcknowledgeRequest
import com.cipherscan.android.util.DeviceUtils
import com.cipherscan.android.util.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

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
     * Optionally takes scanId to schedule retroactive checks against Tier 2 deep analysis.
     */
    fun openUrl(context: Context, rawUrl: String, scanId: Long? = null) {
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

        // ── RETROACTIVE THREAT MONITORING ──────────────────────────────────────
        // If scanId was provided, schedule delayed checks against Tier 2 Playwright
        // deep sandbox to catch zero-day stealth threats elevating after user entered
        if (scanId != null) {
            scheduleRetroactiveThreatCheck(context.applicationContext, scanId, destination)
        }
    }

    /**
     * Dedicated UPI payment launcher conforming to NPCI Intent Specifications.
     *
     * KEY FIX — WHY NO createChooser():
     * When Intent.createChooser() wraps the UPI intent, Android's ChooserActivity
     * becomes the calling entity — NOT CipherScan. PhonePe, GPay, and Paytm all
     * pass the caller's package identity to NPCI servers for transaction validation.
     * If the caller is ChooserActivity (unknown/unsigned app), NPCI rejects the
     * transaction AFTER PIN entry — causing the "error" the user sees.
     *
     * CORRECT approach: Query UPI apps ourselves → launch directly with setPackage()
     * so the calling app identity stays as "com.cipherscan.android" throughout.
     *
     * - Action: Intent.ACTION_VIEW
     * - Flags: FLAG_ACTIVITY_NEW_TASK only
     * - NO CATEGORY_BROWSABLE (triggers bank anti-CSRF fraud prevention)
     * - NO FLAG_ACTIVITY_NEW_DOCUMENT (crashes the NPCI MPIN keypad sandbox)
     */
    fun launchUpiPayment(context: Context, upiUrl: String) {
        Log.d(TAG, "Dispatching clean NPCI UPI payment intent: $upiUrl")
        try {
            val uri = Uri.parse(upiUrl.trim())

            // Probe to discover installed UPI payment apps (exclude CipherScan itself)
            val probeIntent = Intent(Intent.ACTION_VIEW, uri)
            val upiApps: List<android.content.pm.ResolveInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.queryIntentActivities(
                    probeIntent,
                    PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.queryIntentActivities(probeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            }.filter { it.activityInfo.packageName != context.packageName }

            if (upiApps.isEmpty()) {
                Log.w(TAG, "No UPI payment apps found on device")
                Toast.makeText(context, "No UPI payment app (PhonePe, GPay, Paytm) found on device.", Toast.LENGTH_LONG).show()
                return
            }

            // Single UPI app → launch directly, no picker needed
            if (upiApps.size == 1) {
                val pkg = upiApps[0].activityInfo.packageName
                Log.d(TAG, "Single UPI app found, launching directly: $pkg")
                val directIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    setPackage(pkg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(directIntent)
                return
            }

            // Multiple UPI apps → show AlertDialog picker so CipherScan stays the caller.
            // setPackage() on the chosen app preserves our package identity at NPCI level.
            // AlertDialog requires an Activity context — if context is Application-level
            // (e.g. called from ClipboardMonitor), fall back to launching the first UPI app.
            val activity = context as? Activity
            if (activity == null || activity.isFinishing || activity.isDestroyed) {
                Log.w(TAG, "No Activity context available for UPI picker — launching first UPI app directly")
                val fallbackPkg = upiApps[0].activityInfo.packageName
                try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                        setPackage(fallbackPkg)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                } catch (ex: Exception) {
                    Log.e(TAG, "Fallback UPI launch failed: ${ex.message}", ex)
                    Toast.makeText(context, "No UPI payment app (PhonePe, GPay, Paytm) found on device.", Toast.LENGTH_LONG).show()
                }
                return
            }

            val pm = context.packageManager
            val appNames = upiApps.map {
                pm.getApplicationLabel(it.activityInfo.applicationInfo).toString()
            }.toTypedArray()

            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    android.app.AlertDialog.Builder(activity)
                        .setTitle("Pay with UPI")
                        .setItems(appNames) { _, which ->
                            val chosenPkg = upiApps[which].activityInfo.packageName
                            Log.d(TAG, "User selected UPI app: $chosenPkg")
                            try {
                                val chosenIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                                    setPackage(chosenPkg)
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                context.startActivity(chosenIntent)
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to open $chosenPkg: ${e.message}", e)
                                Toast.makeText(context, "Could not open ${appNames[which]}. Try again.", Toast.LENGTH_SHORT).show()
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                } catch (e: Exception) {
                    // Fallback: dialog failed unexpectedly
                    Log.w(TAG, "Picker dialog failed, falling back to first UPI app: ${e.message}")
                    val fallbackPkg = upiApps[0].activityInfo.packageName
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                            setPackage(fallbackPkg)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        })
                    } catch (ex: Exception) {
                        Log.e(TAG, "Fallback UPI launch failed: ${ex.message}", ex)
                        Toast.makeText(context, "No UPI payment app (PhonePe, GPay, Paytm) found on device.", Toast.LENGTH_LONG).show()
                    }
                }
            }
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

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private fun scheduleRetroactiveThreatCheck(context: Context, scanId: Long, destinationUrl: String) {
        val devId = DeviceUtils.getDeviceId(context)
        scope.launch {
            try {
                // Check 1: 6 seconds after opening (Tier 2 background Playwright analysis usually finishes in 4-7s)
                delay(6000)
                if (checkAndAlertRetroactive(context, scanId, devId, destinationUrl)) return@launch

                // Check 2: 13 seconds after opening (for slower sites / deep multi-redirect chains)
                delay(7000)
                checkAndAlertRetroactive(context, scanId, devId, destinationUrl)
            } catch (e: Exception) {
                Log.w(TAG, "Retroactive threat monitor error: ${e.message}")
            }
        }
    }

    private suspend fun checkAndAlertRetroactive(
        context: Context,
        scanId: Long,
        deviceId: String,
        url: String
    ): Boolean {
        return try {
            val response = RetrofitClient.instance.checkRetroactiveAlert(scanId = scanId, deviceId = deviceId)
            if (response.isSuccessful && response.body() != null) {
                val alert = response.body()!!
                if (alert.elevated || alert.verdict == "malicious" || (!alert.isSafe && (alert.riskScore ?: 0) >= 70)) {
                    val domain = try {
                        Uri.parse(url).host ?: url
                    } catch (_: Exception) {
                        url
                    }
                    NotificationHelper.showRetroactiveEmergencyAlert(
                        context = context,
                        domain = domain,
                        threatCategory = alert.threatCategory ?: "Stealth Phishing",
                        url = alert.finalUrl ?: alert.originalUrl ?: url
                    )
                    try {
                        RetrofitClient.instance.acknowledgeAlert(AlertAcknowledgeRequest(scanId = scanId, deviceId = deviceId))
                    } catch (_: Exception) {}
                    return true
                }
            }
            false
        } catch (e: Exception) {
            Log.d(TAG, "Check retroactive alert error: ${e.message}")
            false
        }
    }
}

