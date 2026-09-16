package com.cipherscan.android.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.cipherscan.android.api.RetrofitClient
import com.cipherscan.android.model.AnalyzeRequest
import com.cipherscan.android.util.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.regex.Pattern

/**
 * SmsReceiver: Intercepts incoming SMS messages, extracts web URLs or UPI payment
 * deep links, pre-scans them asynchronously against CipherScan intelligence, and fires
 * an immediate high-priority alert if a phishing/malicious link is detected.
 *
 * Pre-scanned safe links are cached on the server, making future browser clicks instant.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
        // Captures http/https URLs, www. prefixes, and upi:// payment links inside SMS text
        private val URL_PATTERN = Pattern.compile(
            "((?:https?://|www\\.|upi://pay\\?)[^\\s<>\"]+)",
            Pattern.CASE_INSENSITIVE
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // Initialize RetrofitClient so x-device-id is populated on outgoing scans
        RetrofitClient.init(context)

        for (sms in messages) {
            val sender = sms.displayOriginatingAddress ?: "Unknown Sender"
            val body = sms.displayMessageBody ?: continue

            val urls = extractUrls(body)
            if (urls.isNotEmpty()) {
                Log.i(TAG, "Extracted ${urls.size} link(s) from SMS from $sender")
                for (rawUrl in urls) {
                    val targetUrl = normalizeUrl(rawUrl)
                    preScanUrl(context.applicationContext, sender, targetUrl)
                }
            }
        }
    }

    private fun extractUrls(text: String): List<String> {
        val list = mutableListOf<String>()
        val matcher = URL_PATTERN.matcher(text)
        while (matcher.find()) {
            val match = matcher.group(1)?.trim()
            if (!match.isNullOrBlank()) {
                // Strip trailing punctuation common in SMS sentences
                val clean = match.trimEnd('.', ',', ';', ':', '!', '?', ')')
                if (clean.isNotBlank()) {
                    list.add(clean)
                }
            }
        }
        return list
    }

    private fun normalizeUrl(url: String): String {
        return if (url.startsWith("www.", ignoreCase = true)) {
            "https://$url"
        } else {
            url
        }
    }

    private fun preScanUrl(context: Context, sender: String, url: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d(TAG, "Pre-scanning SMS link: $url from $sender")
                val response = RetrofitClient.instance.analyzeUrl(
                    AnalyzeRequest(
                        targetUrl = url,
                        triggerType = "link"
                    )
                )

                if (response.isSuccessful) {
                    val result = response.body()
                    val verdict = result?.verdict?.lowercase()
                    Log.i(TAG, "SMS link verdict for $url: $verdict (riskScore=${result?.riskScore})")

                    // Alert if malicious, suspicious, or high risk score
                    if (verdict == "malicious" || verdict == "suspicious" || (result?.riskScore ?: 0) >= 50) {
                        NotificationHelper.showPhishingAlert(
                            context = context,
                            sender = sender,
                            url = url,
                            threatCategory = result?.threatCategory,
                            riskScore = result?.riskScore ?: 75
                        )
                    }
                } else {
                    Log.w(TAG, "Pre-scan API returned HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error pre-scanning SMS link: ${e.message}", e)
            }
        }
    }
}
