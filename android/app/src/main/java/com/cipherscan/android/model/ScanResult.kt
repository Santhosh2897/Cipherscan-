package com.cipherscan.android.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class AnalyzeRequest(
    @SerializedName("targetUrl")
    val targetUrl: String,

    @SerializedName("triggerType")
    val triggerType: String = "link",

    @SerializedName("deviceId")
    val deviceId: String? = null,

    @SerializedName("deviceName")
    val deviceName: String? = null
) : Serializable

data class ScanResult(
    @SerializedName("id")
    val id: Any? = null,

    @SerializedName("originalUrl")
    val originalUrl: String? = null,

    @SerializedName("finalUrl")
    val finalUrl: String? = null,

    @SerializedName("isSafe")
    val isSafe: Boolean = true,

    @SerializedName("riskScore")
    val riskScore: Int = 0,

    @SerializedName("verdict")
    val verdict: String = "safe",

    @SerializedName("threatCategory")
    val threatCategory: String? = null,

    @SerializedName("redirectChain")
    val redirectChain: List<String>? = null,

    @SerializedName("reasons")
    val reasons: List<String>? = null,

    @SerializedName("previewImageUrl")
    val previewImageUrl: String? = null,

    @SerializedName("triggerType")
    val triggerType: String? = null,

    @SerializedName("deviceId")
    val deviceId: String? = null,

    @SerializedName("deviceName")
    val deviceName: String? = null,

    @SerializedName("virusTotalScore")
    val virusTotalScore: Any? = null,

    @SerializedName("googleSafeBrowsing")
    val googleSafeBrowsing: Boolean? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null,

    // ── Intelligence fields (from smart cache + community intelligence) ─────
    /** true if this result was served from the cross-user url_cache (< 100ms) */
    @SerializedName("fromCache")
    val fromCache: Boolean = false,

    /** true if the device's domain was auto-whitelisted after repeated safe scans */
    @SerializedName("fromTrustedDomain")
    val fromTrustedDomain: Boolean = false,

    /** how many times this device has scanned this domain previously */
    @SerializedName("domainScanCount")
    val domainScanCount: Int? = null,

    /** how many total users hit this URL in the community cache */
    @SerializedName("cacheHitCount")
    val cacheHitCount: Int? = null,

    /** community trust score 0–100, or null if URL is new to the community */
    @SerializedName("communityTrustScore")
    val communityTrustScore: Int? = null,
) : Serializable

data class ReportThreatRequest(
    @SerializedName("url")
    val url: String,

    @SerializedName("deviceId")
    val deviceId: String,

    @SerializedName("reportedVerdict")
    val reportedVerdict: String = "malicious"
) : Serializable

data class ReportThreatResponse(
    @SerializedName("success")
    val success: Boolean = false,

    @SerializedName("message")
    val message: String = ""
) : Serializable