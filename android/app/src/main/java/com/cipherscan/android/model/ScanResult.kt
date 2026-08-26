package com.cipherscan.android.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class AnalyzeRequest(
    @SerializedName("targetUrl")
    val targetUrl: String,

    @SerializedName("triggerType")
    val triggerType: String = "link"
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

    @SerializedName("virusTotalScore")
    val virusTotalScore: Any? = null,

    @SerializedName("googleSafeBrowsing")
    val googleSafeBrowsing: Boolean? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null
) : Serializable