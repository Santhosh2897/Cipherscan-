package com.cipherscan.android.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

/**
 * CipherScan — ScanResult
 *
 * Mirrors the JSON response from:
 *   POST /api/analyze
 *   GET  /api/scans/:id
 *
 * Implements [Parcelable] so it can be bundled into Fragment arguments
 * (e.g. passed into [SecurityOverlayBottomSheet]).
 */
@Parcelize
data class ScanResult(
    val id: Int,
    val originalUrl: String,
    val finalUrl: String,
    val isSafe: Boolean,
    val riskScore: Int,             // 0–100
    val verdict: String,            // "safe" | "suspicious" | "malicious"
    val threatCategory: String?,
    val redirectChain: List<String>,
    val reasons: List<String>,
    val previewImageUrl: String?,
    val triggerType: String,        // "camera" | "link" | "manual"
    val virusTotalScore: Int?,
    val googleSafeBrowsing: Boolean,
    val createdAt: String,          // ISO-8601
) : Parcelable

/**
 * Request body sent to POST /api/analyze.
 */
data class AnalyzeRequest(
    val targetUrl: String,
    val triggerType: String,        // "camera" | "link" | "manual"
)
