package com.cipherscan.android.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class AnalyzeRequest(
    @SerializedName("url")
    val url: String
) : Serializable

data class ScanResult(
    @SerializedName("id")
    val id: String? = null,

    @SerializedName("targetUrl")
    val targetUrl: String,

    @SerializedName("finalUrl")
    val finalUrl: String? = null,

    @SerializedName("verdict")
    val verdict: String,

    @SerializedName("riskScore")
    val riskScore: Int,

    @SerializedName("threatTypes")
    val threatTypes: List<String>? = null,

    @SerializedName("threatReasons")
    val threatReasons: List<String>? = null,

    @SerializedName("redirectChain")
    val redirectChain: List<String>? = null,

    @SerializedName("screenshotBase64")
    val screenshotBase64: String? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null
) : Serializable