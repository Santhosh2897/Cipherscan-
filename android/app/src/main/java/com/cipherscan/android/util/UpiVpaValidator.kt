package com.cipherscan.android.util

import kotlin.math.max
import kotlin.math.min

/**
 * UpiVpaValidator — UPI VPA fraud detection utility.
 *
 * Detects:
 *  1. Typosquatted VPAs (e.g., "hd-fc@upi" vs "hdfcbank@upi")
 *  2. Suspicious VPA patterns (unusual PSPs, numeric-heavy handles)
 *  3. UPI intent parsing from upi:// deep links
 *
 * Usage:
 *   val result = UpiVpaValidator.analyze("upi://pay?pa=hd-fc@upi&pn=HDFC Bank&am=500")
 *   if (result.isSuspicious) showWarning(result.warning)
 */
object UpiVpaValidator {

    /** Well-known legitimate VPAs and their display names */
    private val TRUSTED_VPAS: Map<String, String> = mapOf(
        "hdfcbank@hdfc" to "HDFC Bank",
        "axisbank@upi" to "Axis Bank",
        "sbibank@sbi" to "State Bank of India",
        "icici@icici" to "ICICI Bank",
        "pnb@upi" to "Punjab National Bank",
        "boi@upi" to "Bank of India",
        "canara@upi" to "Canara Bank",
        "paytm@paytm" to "Paytm",
        "phonepe@ybl" to "PhonePe",
        "gpay@okhdfcbank" to "Google Pay",
        "amazonpay@apl" to "Amazon Pay",
        "yesbank@upi" to "Yes Bank",
        "kotak@kotak" to "Kotak Bank",
        "federal@upi" to "Federal Bank",
        "indusind@indus" to "IndusInd Bank",
    )

    /** Legitimate PSP handles (the part after @) */
    private val TRUSTED_PSP_HANDLES: Set<String> = setOf(
        "upi", "ybl", "oksbi", "okhdfcbank", "okaxis", "okicici",
        "paytm", "apl", "superyes", "waaxis", "wahdfcbank", "waicici",
        "freecharge", "airtel", "jiomoney", "kotak", "indus", "icici",
        "hdfc", "sbi", "ibl", "cnrb", "barodampay", "pnb", "axl",
    )

    data class UpiAnalysisResult(
        val vpa: String,
        val payeeName: String?,
        val amount: String?,
        val isSuspicious: Boolean,
        val isTrustedVpa: Boolean,
        val warning: String?,
        val matchedTrustedVpa: String?,   // The legitimate VPA it most resembles
        val matchedTrustedName: String?,  // Display name of the legitimate VPA
        val levenshteinDistance: Int?,    // How different from the nearest legitimate VPA
    )

    /**
     * Parses a UPI intent URL and analyzes the VPA for fraud signals.
     * Accepts both upi://pay?pa=... and raw VPA strings like user@upi.
     */
    fun analyze(upiStringOrVpa: String): UpiAnalysisResult {
        val vpa = extractVpa(upiStringOrVpa) ?: upiStringOrVpa.trim()
        val payeeName = extractParam(upiStringOrVpa, "pn")
        val amount = extractParam(upiStringOrVpa, "am")

        // Exact match → fully trusted
        val exactMatch = TRUSTED_VPAS[vpa.lowercase()]
        if (exactMatch != null) {
            return UpiAnalysisResult(
                vpa = vpa,
                payeeName = payeeName,
                amount = amount,
                isSuspicious = false,
                isTrustedVpa = true,
                warning = null,
                matchedTrustedVpa = vpa.lowercase(),
                matchedTrustedName = exactMatch,
                levenshteinDistance = 0,
            )
        }

        // PSP validation
        val pspHandle = vpa.substringAfter("@", "").lowercase()
        val isPspKnown = pspHandle in TRUSTED_PSP_HANDLES

        // Find nearest trusted VPA by Levenshtein distance
        var minDist = Int.MAX_VALUE
        var nearestVpa: String? = null
        var nearestName: String? = null

        for ((trustedVpa, trustedName) in TRUSTED_VPAS) {
            val dist = levenshtein(vpa.lowercase(), trustedVpa)
            if (dist < minDist) {
                minDist = dist
                nearestVpa = trustedVpa
                nearestName = trustedName
            }
        }

        // Typosquatting threshold: Levenshtein ≤ 3 → looks too similar to a trusted VPA
        val isTyposquat = minDist <= 3 && minDist > 0

        // Suspicious pattern checks
        val localPart = vpa.substringBefore("@")
        val isNumericHeavy = localPart.count { it.isDigit() } > localPart.length / 2
        val hasHyphen = localPart.contains("-")
        val isVeryShort = localPart.length < 3
        val hasUnknownPsp = !isPspKnown && pspHandle.isNotEmpty()

        val suspiciousSignals = mutableListOf<String>()
        if (isTyposquat && nearestName != null) {
            suspiciousSignals.add("This VPA looks similar to $nearestName ($nearestVpa) — possible fraud")
        }
        if (hasHyphen) suspiciousSignals.add("Contains hyphen — real bank VPAs rarely use hyphens")
        if (isNumericHeavy) suspiciousSignals.add("Unusually numeric VPA handle")
        if (isVeryShort) suspiciousSignals.add("Suspiciously short VPA local part")
        if (hasUnknownPsp) suspiciousSignals.add("Unknown payment provider: @$pspHandle")

        val isSuspicious = suspiciousSignals.isNotEmpty()
        val warning = if (isSuspicious) {
            "⚠️ Suspicious UPI VPA detected:\n" + suspiciousSignals.joinToString("\n• ", prefix = "• ")
        } else null

        return UpiAnalysisResult(
            vpa = vpa,
            payeeName = payeeName,
            amount = amount,
            isSuspicious = isSuspicious,
            isTrustedVpa = false,
            warning = warning,
            matchedTrustedVpa = nearestVpa,
            matchedTrustedName = if (isTyposquat) nearestName else null,
            levenshteinDistance = if (minDist == Int.MAX_VALUE) null else minDist,
        )
    }

    /** Extracts the VPA (pa=...) from a upi:// URI string */
    private fun extractVpa(input: String): String? {
        if (!input.lowercase().startsWith("upi://")) return null
        return extractParam(input, "pa")
    }

    /** Extracts a query parameter from a URI string */
    private fun extractParam(input: String, param: String): String? {
        val regex = Regex("[?&]${Regex.escape(param)}=([^&]*)", RegexOption.IGNORE_CASE)
        return regex.find(input)?.groupValues?.get(1)?.let {
            java.net.URLDecoder.decode(it, "UTF-8")
        }
    }

    /**
     * Computes Levenshtein edit distance between two strings.
     * Uses iterative DP — O(m*n) time, O(n) space.
     */
    fun levenshtein(a: String, b: String): Int {
        val m = a.length
        val n = b.length
        val dp = IntArray(n + 1) { it }
        for (i in 1..m) {
            var prev = dp[0]
            dp[0] = i
            for (j in 1..n) {
                val temp = dp[j]
                dp[j] = if (a[i - 1] == b[j - 1]) prev
                else 1 + min(prev, min(dp[j], dp[j - 1]))
                prev = temp
            }
        }
        return dp[n]
    }
}
