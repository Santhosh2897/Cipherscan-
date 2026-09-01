package com.cipherscan.android.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.Log
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent

object BrowserLauncher {

    private const val TAG = "BrowserLauncher"

    private val KNOWN_BROWSERS = listOf(
        "com.android.chrome",
        "com.google.android.apps.chrome",
        "org.mozilla.firefox",
        "com.sec.android.app.sbrowser",
        "com.microsoft.emmx",
        "com.opera.browser",
        "com.brave.browser",
        "com.duckduckgo.mobile.android",
        "com.android.browser"
    )

    fun openUrl(context: Context, rawUrl: String) {
        val destination = if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("upi://")) {
            rawUrl
        } else {
            "https://$rawUrl"
        }

        val uri = try {
            Uri.parse(destination)
        } catch (e: Exception) {
            Log.e(TAG, "Invalid URI: $destination", e)
            Toast.makeText(context, "Invalid link format", Toast.LENGTH_SHORT).show()
            return
        }

        val targetBrowser = findBrowserPackage(context)
        Log.d(TAG, "Resolved target browser: $targetBrowser for URL: $destination")

        // 1. Launch standalone external browser intent (creates separate Chrome task in Recents)
        try {
            val browserIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                if (targetBrowser != null) {
                    setPackage(targetBrowser)
                }
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
                addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
            }
            context.startActivity(browserIntent)
            return
        } catch (e: Exception) {
            Log.w(TAG, "Explicit standalone browser launch failed: ${e.message}")
        }

        // 2. Fallback to generic chooser intent with standalone task flags
        try {
            val fallbackIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
                addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
            }
            val chooser = Intent.createChooser(fallbackIntent, "Open link with").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        } catch (e: Exception) {
            Log.e(TAG, "All launch attempts failed: ${e.message}", e)
            Toast.makeText(context, "Unable to open browser", Toast.LENGTH_SHORT).show()
        }
    }

    private fun findBrowserPackage(context: Context): String? {
        val testIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://google.com")).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
        }

        val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.queryIntentActivities(
                testIntent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong())
            )
        } else {
            context.packageManager.queryIntentActivities(testIntent, PackageManager.MATCH_ALL)
        }

        val availablePackages = resolveInfos
            .map { it.activityInfo.packageName }
            .filter { it != context.packageName }
            .distinct()

        // Match against known browsers first
        for (known in KNOWN_BROWSERS) {
            if (availablePackages.contains(known)) {
                return known
            }
        }

        // Otherwise pick any browser package
        return availablePackages.firstOrNull { pkg ->
            pkg.contains("chrome") || pkg.contains("browser") || pkg.contains("firefox") || pkg.contains("opera")
        } ?: availablePackages.firstOrNull()
    }
}
