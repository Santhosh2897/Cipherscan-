package com.cipherscan.android.util

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.util.Log
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * ClipboardMonitor — Background & Foreground Clipboard URL Auto-Scanner.
 *
 * Automatically inspects copied text across WhatsApp, Telegram, browsers, and SMS.
 * When a web URL or UPI intent is detected:
 * 1. Deduplicates against recent scans to avoid repeated alerts on re-copy.
 * 2. Pre-scans against CipherScan's Tier 1 heuristic / cache pipeline with triggerType = "clipboard".
 * 3. Immediately triggers a high-priority heads-up warning notification if the copied link
 *    is flagged as suspicious or malicious before the user taps into Chrome or payment apps.
 */
object ClipboardMonitor {

    private const val TAG = "ClipboardMonitor"
    private val URL_REGEX = Regex("(?i)\\b((?:https?://|www\\.|upi://pay\\?)[^\\s<>'\"`]+)")

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isStarted = AtomicBoolean(false)

    private var lastScannedUrl: String? = null
    private var lastScannedTimestamp: Long = 0L
    private const val DEDUPLICATION_WINDOW_MS = 15_000L

    private var clipListener: ClipboardManager.OnPrimaryClipChangedListener? = null

    /**
     * Registers the Clipboard listener with the application context.
     */
    fun start(context: Context) {
        if (isStarted.getAndSet(true)) return

        val appContext = context.applicationContext
        val clipboard = appContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return

        val listener = ClipboardManager.OnPrimaryClipChangedListener {
            inspectClipboard(appContext, clipboard)
        }
        clipListener = listener

        try {
            clipboard.addPrimaryClipChangedListener(listener)
            Log.i(TAG, "Clipboard monitor listener registered successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register clipboard listener: ${e.message}")
        }
    }

    /**
     * Unregisters the Clipboard listener.
     */
    fun stop(context: Context) {
        if (!isStarted.getAndSet(false)) return

        val appContext = context.applicationContext
        val clipboard = appContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        clipListener?.let {
            try {
                clipboard.removePrimaryClipChangedListener(it)
            } catch (_: Exception) {}
        }
        clipListener = null
    }

    /**
     * On-demand check for foreground focus transitions (e.g. MainActivity.onResume).
     * Automatically extracts the copied URL and invokes callback if present.
     */
    fun checkClipboardNow(context: Context, onUrlFound: ((String) -> Unit)? = null) {
        val appContext = context.applicationContext
        val clipboard = appContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        inspectClipboard(appContext, clipboard, onUrlFound)
    }

    private fun inspectClipboard(
        context: Context,
        clipboard: ClipboardManager,
        onUrlFound: ((String) -> Unit)? = null
    ) {
        try {
            if (!clipboard.hasPrimaryClip()) return

            val description = clipboard.primaryClipDescription
            if (description == null ||
                (!description.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) &&
                 !description.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML))
            ) {
                return
            }

            val clipData = clipboard.primaryClip ?: return
            if (clipData.itemCount <= 0) return

            val text = clipData.getItemAt(0)?.coerceToText(context)?.toString()?.trim() ?: return
            val match = URL_REGEX.find(text) ?: return
            var targetUrl = match.value.trim()

            if (targetUrl.startsWith("www.", ignoreCase = true)) {
                targetUrl = "https://$targetUrl"
            }

            // Report URL found to UI if listener is attached
            onUrlFound?.invoke(targetUrl)

            // Deduplication check
            val now = System.currentTimeMillis()
            if (targetUrl == lastScannedUrl && (now - lastScannedTimestamp) < DEDUPLICATION_WINDOW_MS) {
                Log.d(TAG, "Skipping duplicate clipboard scan: $targetUrl")
                return
            }

            lastScannedUrl = targetUrl
            lastScannedTimestamp = now

            scanClipboardUrlAsync(context, targetUrl)
        } catch (e: Exception) {
            Log.d(TAG, "Error inspecting clipboard: ${e.message}")
        }
    }

    private fun scanClipboardUrlAsync(context: Context, url: String) {
        scope.launch {
            try {
                Log.d(TAG, "Pre-scanning copied URL: $url")
                val devId = DeviceUtils.getDeviceId(context)
                val devName = DeviceUtils.getDeviceName()
                val request = AnalyzeRequest(
                    targetUrl = url,
                    triggerType = "clipboard",
                    deviceId = devId,
                    deviceName = devName
                )

                val response = RetrofitClient.instance.analyzeUrl(request)
                if (response.isSuccessful && response.body() != null) {
                    val result = response.body()!!
                    val isThreat = !result.isSafe ||
                            result.verdict == "malicious" ||
                            result.verdict == "suspicious" ||
                            result.riskScore >= 50

                    if (isThreat) {
                        Log.w(TAG, "Clipboard threat detected! Risk score: ${result.riskScore}, category: ${result.threatCategory}")
                        NotificationHelper.showClipboardThreatAlert(
                            context = context,
                            url = url,
                            threatCategory = result.threatCategory ?: "Suspicious Link",
                            riskScore = result.riskScore
                        )
                    } else {
                        Log.d(TAG, "Clipboard URL verified safe: $url")
                    }
                }
            } catch (e: Exception) {
                Log.d(TAG, "Clipboard scan failed: ${e.message}")
            }
        }
    }
}
